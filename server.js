const { loadEnvConfig } = require("@next/env");
loadEnvConfig(process.cwd());

const { createServer } = require("http");
const next = require("next");
const { Server } = require("socket.io");
const crypto = require("crypto");

const dev = process.env.NODE_ENV !== "production";
const port = Number(process.env.PORT || 3000);

if (!process.env.COACH_PASSWORD) {
  throw new Error("COACH_PASSWORD is missing.");
}

const app = next({ dev });
const handle = app.getRequestHandler();

// An authenticated session becomes invalid on server restart.
const sessionToken = crypto.randomBytes(32).toString("hex");

const createScore = () => ({
  games: [0, 0],
  points: [0, 0],
  tiebreak: false,
  finished: false,
  winner: null,
});

const createCourt = (id) => ({
  id,
  teams: [[], []],
  score: createScore(),
  history: [],
  final: false,
});

const tournament = {
  round: 1,
  phase: "setup",
  mode: "advantage",
  players: [],
  courts: Array.from({ length: 6 }, (_, i) => createCourt(i + 1)),
};

function snapshot() {
  return {
    round: tournament.round,
    phase: tournament.phase,
    mode: tournament.mode,
    players: tournament.players,
    courts: tournament.courts.map(({ history, ...court }) => court),
  };
}

function checkAuth(token) {
  if (typeof token !== "string") return false;
  const a = Buffer.from(token);
  const b = Buffer.from(sessionToken);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function safePasswordMatch(password) {
  if (typeof password !== "string") return false;
  const a = crypto.createHash("sha256").update(password).digest();
  const b = crypto.createHash("sha256")
    .update(process.env.COACH_PASSWORD).digest();
  return crypto.timingSafeEqual(a, b);
}

function awardPoint(score, team, mode) {
  if (score.finished) return;

  const other = 1 - team;
  const p = score.points;

  if (score.tiebreak) {
    p[team]++;

    if (p[team] >= 7 && p[team] - p[other] >= 2) {
      score.games[team]++;
      score.finished = true;
      score.winner = team;
    }
    return;
  }

  // Golden point: first point won after 40-40 wins the game.
  if (mode === "golden" && p[team] >= 3 && p[other] >= 3) {
    winGame(score, team);
    return;
  }

  p[team]++;

  if (p[team] >= 4 && p[team] - p[other] >= 2) {
    winGame(score, team);
  }
}

function winGame(score, team) {
  score.games[team]++;
  score.points = [0, 0];

  const a = score.games[0];
  const b = score.games[1];

  if (a === 6 && b === 6) {
    score.tiebreak = true;
    return;
  }

  if (score.games[team] >= 6 &&
      score.games[team] - score.games[1 - team] >= 2) {
    score.finished = true;
    score.winner = team;
  }
}

function emitState(io) {
  io.emit("tournament:state", snapshot());
}

function error(ack, message) {
  if (typeof ack === "function") {
    ack({ ok: false, error: message });
  }
}

function success(ack) {
  if (typeof ack === "function") ack({ ok: true });
}

function protectedEvent(socket, io, eventName, handler) {
  socket.on(eventName, (payload = {}, ack) => {
    try {
      if (!checkAuth(payload.token)) {
        return error(ack, "Unauthorized. Please log in again.");
      }

      handler(payload);
      emitState(io);
      success(ack);
    } catch (e) {
      error(ack, e.message || "Something went wrong.");
    }
  });
}

app.prepare().then(() => {
  const httpServer = createServer((req, res) => handle(req, res));

  const io = new Server(httpServer, {
    transports: ["websocket", "polling"],
  });

  io.on("connection", (socket) => {
    socket.emit("tournament:state", snapshot());

    socket.on("coach:login", ({ password } = {}, ack) => {
      if (!safePasswordMatch(password)) {
        return error(ack, "Incorrect password.");
      }
      ack?.({ ok: true, token: sessionToken });
    });

    protectedEvent(socket, io, "player:add", ({ name }) => {
      if (tournament.phase !== "setup") {
        throw new Error("Players can only be added during setup.");
      }

      const clean = String(name || "").trim().replace(/\s+/g, " ");

      if (clean.length < 3 || clean.length > 80) {
        throw new Error("Enter a valid full name (3–80 characters).");
      }

      if (tournament.players.length >= 24) {
        throw new Error("Maximum 24 players.");
      }

      if (tournament.players.some(
        p => p.name.toLowerCase() === clean.toLowerCase()
      )) {
        throw new Error("This player already exists.");
      }

      tournament.players.push({
        id: crypto.randomUUID(),
        name: clean,
      });
    });

    protectedEvent(socket, io, "player:remove", ({ playerId }) => {
      if (tournament.phase !== "setup") {
        throw new Error("Cannot remove players after starting.");
      }

      tournament.players = tournament.players.filter(p => p.id !== playerId);

      for (const court of tournament.courts) {
        court.teams = court.teams.map(
          team => team.filter(id => id !== playerId)
        );
      }
    });

    protectedEvent(socket, io, "court:assign", ({ courtId, team, slot, playerId }) => {
      if (tournament.phase !== "setup") {
        throw new Error("Court assignments are locked.");
      }

      const court = tournament.courts.find(c => c.id === Number(courtId));

      if (!court || ![0, 1].includes(team) ||
          ![0, 1].includes(slot)) {
        throw new Error("Invalid court assignment.");
      }

      if (playerId && !tournament.players.some(p => p.id === playerId)) {
        throw new Error("Player not found.");
      }

      // Remove this player from any previous assignment.
      if (playerId) {
        for (const c of tournament.courts) {
          c.teams = c.teams.map(t => t.filter(id => id !== playerId));
        }
      }

      // Represent unassigned slots with null.
      while (court.teams[team].length < 2) {
        court.teams[team].push(null);
      }

      court.teams[team][slot] = playerId || null;
    });

    protectedEvent(socket, io, "tournament:mode", ({ mode }) => {
      if (tournament.phase !== "setup") {
        throw new Error("Scoring mode is locked.");
      }

      if (!["advantage", "golden"].includes(mode)) {
        throw new Error("Invalid scoring mode.");
      }

      tournament.mode = mode;
    });

    protectedEvent(socket, io, "tournament:start", () => {
      if (tournament.phase !== "setup") {
        throw new Error("Tournament already started.");
      }

      if (tournament.players.length !== 24) {
        throw new Error("Exactly 24 players are required.");
      }

      const assigned = tournament.courts.flatMap(
        c => c.teams.flatMap(t => t)
      );

      if (assigned.length !== 24 ||
          assigned.some(id => !id) ||
          new Set(assigned).size !== 24) {
        throw new Error("Assign all 24 unique players before starting.");
      }

      tournament.phase = "live";
    });

    protectedEvent(socket, io, "score:point", ({ courtId, team }) => {
      if (tournament.phase !== "live") {
        throw new Error("Tournament is not live.");
      }

      const court = tournament.courts.find(c => c.id === Number(courtId));

      if (!court || ![0, 1].includes(team) ||
          court.final || court.score.finished) {
        throw new Error("Scoring is unavailable.");
      }

      court.history.push(structuredClone(court.score));
      awardPoint(court.score, team, tournament.mode);
    });

    protectedEvent(socket, io, "score:undo", ({ courtId }) => {
      const court = tournament.courts.find(c => c.id === Number(courtId));

      if (tournament.phase !== "live" || !court || court.final) {
        throw new Error("Cannot undo this court.");
      }

      if (!court.history.length) {
        throw new Error("No previous point to undo.");
      }

      court.score = court.history.pop();
    });

    protectedEvent(socket, io, "score:finalize", ({ courtId }) => {
      if (tournament.phase !== "live") {
        throw new Error("Tournament is not live.");
      }

      const court = tournament.courts.find(c => c.id === Number(courtId));

      if (!court || !court.score.finished || court.final) {
        throw new Error("Match must be completed first.");
      }

      court.final = true;
    });

    protectedEvent(socket, io, "score:reopen", ({ courtId }) => {
      if (tournament.phase !== "live") {
        throw new Error("Tournament is not live.");
      }

      const court = tournament.courts.find(c => c.id === Number(courtId));

      if (!court || !court.final) {
        throw new Error("Match is not finalized.");
      }

      court.final = false;
    });

    protectedEvent(socket, io, "tournament:advance", () => {
      if (tournament.phase !== "live" ||
          !tournament.courts.every(c => c.final)) {
        throw new Error("All six matches must be finalized.");
      }

      const nextTeams = Array.from({ length: 6 }, () => []);

      for (const court of tournament.courts) {
        const index = court.id - 1;
        const winner = court.teams[court.score.winner];
        const loser = court.teams[1 - court.score.winner];

        const up = Math.max(0, index - 1);
        const down = Math.min(5, index + 1);

        nextTeams[up].push([...winner]);
        nextTeams[down].push([...loser]);
      }

      if (nextTeams.some(teams => teams.length !== 2)) {
        throw new Error("Court advancement failed validation.");
      }

      tournament.courts = nextTeams.map((teams, i) => ({
        ...createCourt(i + 1),
        teams,
      }));

      tournament.round++;
    });

    protectedEvent(socket, io, "tournament:reset", () => {
      tournament.round = 1;
      tournament.phase = "setup";
      tournament.mode = "advantage";
      tournament.players = [];
      tournament.courts = Array.from(
        { length: 6 }, (_, i) => createCourt(i + 1)
      );
    });
  });

  httpServer.listen(port, "0.0.0.0", () => {
    console.log(`Tournament running on port ${port}`);
  });
});
