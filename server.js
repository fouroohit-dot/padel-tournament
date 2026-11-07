const { loadEnvConfig } = require("@next/env");
loadEnvConfig(process.cwd());

const { createServer } = require("http");
const next = require("next");
const { Server } = require("socket.io");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const dev = process.env.NODE_ENV !== "production";
const port = Number(process.env.PORT || 3000);

if (!process.env.COACH_PASSWORD) {
  throw new Error("COACH_PASSWORD is missing.");
}

const app = next({ dev });
const handle = app.getRequestHandler();

const GROUPS = ["A", "B", "C"];
const RATINGS = ["D-", "D", "D+", "C-", "C", "C+"];
const COURT_COUNT = 6;
const GROUP_ROUNDS = 4;
const MATCH_DURATION_MS = 10 * 60 * 1000;

const STATE_FILE =
  process.env.TOURNAMENT_STATE_FILE ||
  path.join(process.cwd(), "tournament-state.json");

const sessionToken = crypto.randomBytes(32).toString("hex");

function newScore() {
  return {
    points: [0, 0],
    games: [0, 0],
    tiebreak: false,
    finished: false,
    winner: null,
  };
}

function newCourt(
  id,
  teams = [[null, null], [null, null]],
  active = true
) {
  return {
    id,
    teams: teams.map((team) => [...team]),
    active,
    score: newScore(),
    history: [],
    final: false,
  };
}

function newTimer(start = false) {
  const now = Date.now();

  return {
    durationMs: MATCH_DURATION_MS,
    startedAt: start ? now : null,
    endsAt: start ? now + MATCH_DURATION_MS : null,
  };
}

function newGroup(group) {
  const players = Array.from({ length: 24 }, (_, i) => ({
    id: `${group}-${String(i + 1).padStart(2, "0")}`,
    name: `${group} Player ${String(i + 1).padStart(2, "0")}`,
    rating: RATINGS[i % RATINGS.length],
    group,
  }));

  const courts = Array.from({ length: COURT_COUNT }, (_, i) => {
    const ids = players
      .slice(i * 4, i * 4 + 4)
      .map((p) => p.id);

    return newCourt(i + 1, [
      ids.slice(0, 2),
      ids.slice(2, 4),
    ]);
  });

  return { players, courts };
}

function newTournament() {
  return {
    version: 3,
    phase: "setup",
    stage: "groups",
    group: "A",
    round: 1,
    slotIndex: 0,

    groups: Object.fromEntries(
      GROUPS.map((group) => [group, newGroup(group)])
    ),

    courts: Array.from(
      { length: COURT_COUNT },
      (_, i) => newCourt(i + 1)
    ),

    timer: newTimer(),

    results: [],

    bracket: {
      quarterfinals: [],
      semifinals: [],
      final: [],
    },

    startedAt: null,
    completedAt: null,
  };
}

function loadTournament() {
  if (!fs.existsSync(STATE_FILE)) {
    return newTournament();
  }

  let parsed;

  try {
    parsed = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
  } catch (e) {
    throw new Error(`Unable to read tournament state: ${e.message}`);
  }

  // Version 2 from the previous implementation can be migrated
  // because its roster, results and bracket structure is compatible.
  if (parsed.version === 2) {
    parsed.version = 3;

    // If a match was actively running, preserve its original clock.
    // If the previous server had just loaded the next stage,
    // a coach can reset the timer using the new workflow only
    // after resetting the tournament.
    return parsed;
  }

  if (parsed.version !== 3) {
    throw new Error(
      "Tournament state version is incompatible. Back up the " +
      "existing state before creating a new tournament."
    );
  }

  return parsed;
}

let tournament = loadTournament();

function persist() {
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });

  const temp = `${STATE_FILE}.tmp`;

  fs.writeFileSync(
    temp,
    JSON.stringify(tournament, null, 2)
  );

  fs.renameSync(temp, STATE_FILE);
}

function allPlayers() {
  return GROUPS.flatMap(
    (group) => tournament.groups[group].players
  );
}

function findPlayer(id) {
  return allPlayers().find((p) => p.id === id);
}

function teamKey(team) {
  return [...team].sort().join("|");
}

function getMatchKey() {
  if (tournament.stage === "groups") {
    return `group-${tournament.group}-round-${tournament.round}`;
  }

  return tournament.stage;
}

function teamName(team) {
  return team
    .map((id) => findPlayer(id)?.name || "Unknown")
    .join(" / ");
}

function initialTeams() {
  return GROUPS.flatMap((group) =>
    tournament.groups[group].courts.flatMap((court) =>
      court.teams.map((team) => ({
        key: teamKey(team),
        team: [...team],
        group,
      }))
    )
  );
}

function standings() {
  const records = new Map();

  for (const team of initialTeams()) {
    records.set(team.key, {
      ...team,
      name: teamName(team.team),
      wins: 0,
      losses: 0,
      pointsFor: 0,
      pointsAgainst: 0,
    });
  }

  for (const result of tournament.results) {
    // Knockout results don't influence group-stage seeding.
    if (result.stage !== "groups") continue;

    result.teams.forEach((team, side) => {
      const record = records.get(teamKey(team));
      if (!record) return;

      record.pointsFor += result.points[side];
      record.pointsAgainst += result.points[1 - side];

      if (result.winner === side) record.wins++;
      else record.losses++;
    });
  }

  return [...records.values()]
    .map((record) => ({
      ...record,
      differential:
        record.pointsFor - record.pointsAgainst,
    }))
    .sort(
      (a, b) =>
        b.wins - a.wins ||
        b.differential - a.differential ||
        b.pointsFor - a.pointsFor ||
        a.key.localeCompare(b.key)
    );
}

function snapshot() {
  const roster = allPlayers();

  const stats = new Map(
    roster.map((p) => [
      p.id,
      { wins: 0, losses: 0 },
    ])
  );

  for (const result of tournament.results) {
    result.teams.forEach((team, side) => {
      for (const playerId of team) {
        const row = stats.get(playerId);
        if (!row) continue;

        if (result.winner === side) row.wins++;
        else row.losses++;
      }
    });
  }

  const activeCourts = tournament.courts.filter(
    (court) => court.active
  );

  const confirmedCount = activeCourts.filter(
    (court) => court.final
  ).length;

  const timerStarted = tournament.timer.startedAt !== null;
  const timeExpired =
    timerStarted &&
    Date.now() >= tournament.timer.endsAt;

  return {
    phase: tournament.phase,
    stage: tournament.stage,
    group: tournament.group,
    round: tournament.round,
    slotIndex: tournament.slotIndex,
    matchKey: getMatchKey(),

    timer: tournament.timer,
    timerStarted,
    timeExpired,

    activeMatchCount: activeCourts.length,
    confirmedCount,

    awaitingStart:
      tournament.phase === "live" &&
      !timerStarted,

    awaitingResults:
      tournament.phase === "live" &&
      timeExpired &&
      confirmedCount < activeCourts.length,

    courts: tournament.courts.map(
      ({ history, ...court }) => court
    ),

    players: roster.map((player) => ({
      ...player,
      ...stats.get(player.id),
    })),

    groups: tournament.groups,
    standings: standings(),
    bracket: tournament.bracket,
    results: tournament.results,

    completedAt: tournament.completedAt,
  };
}

function checkAuth(token) {
  if (typeof token !== "string") return false;

  const a = Buffer.from(token);
  const b = Buffer.from(sessionToken);

  return (
    a.length === b.length &&
    crypto.timingSafeEqual(a, b)
  );
}

function checkPassword(password) {
  if (typeof password !== "string") return false;

  const a = crypto
    .createHash("sha256")
    .update(password)
    .digest();

  const b = crypto
    .createHash("sha256")
    .update(process.env.COACH_PASSWORD)
    .digest();

  return crypto.timingSafeEqual(a, b);
}

function validateAssignments() {
  for (const group of GROUPS) {
    const data = tournament.groups[group];

    const assigned = data.courts.flatMap(
      (court) => court.teams.flat()
    );

    const expected = data.players.map((p) => p.id);

    if (
      assigned.length !== 24 ||
      assigned.some((id) => !id) ||
      new Set(assigned).size !== 24 ||
      expected.some((id) => !assigned.includes(id))
    ) {
      throw new Error(
        `Group ${group}: assign each of the 24 players exactly once.`
      );
    }
  }
}

function activateCourts(courts) {
  tournament.courts = courts.map((court) =>
    newCourt(
      court.id,
      court.teams,
      court.active !== false
    )
  );

  // Critical change:
  // Every new stage loads with a PAUSED timer.
  tournament.timer = newTimer(false);
}

function loadGroupSlot(index) {
  tournament.stage = "groups";
  tournament.slotIndex = index;

  tournament.round = Math.floor(index / 3) + 1;
  tournament.group = GROUPS[index % 3];

  activateCourts(
    tournament.groups[tournament.group].courts
  );
}

function moveGroupCourts(group) {
  const nextTeams = Array.from(
    { length: COURT_COUNT },
    () => []
  );

  for (const court of tournament.courts) {
    const index = court.id - 1;

    const winning = court.teams[court.score.winner];
    const losing = court.teams[1 - court.score.winner];

    const moveUp = Math.max(0, index - 1);
    const moveDown = Math.min(COURT_COUNT - 1, index + 1);

    nextTeams[moveUp].push([...winning]);
    nextTeams[moveDown].push([...losing]);
  }

  if (nextTeams.some((teams) => teams.length !== 2)) {
    throw new Error(
      "Court movement failed validation."
    );
  }

  tournament.groups[group].courts = nextTeams.map(
    (teams, index) => newCourt(index + 1, teams)
  );
}

function newMatch(id, courtId, teams, label) {
  return {
    id,
    courtId,
    label,
    teams: teams.map((team) => [...team]),
    points: [0, 0],
    winner: null,
    final: false,
  };
}

function bracketCourts(matches) {
  return Array.from(
    { length: COURT_COUNT },
    (_, i) => {
      const match = matches.find(
        (item) => item.courtId === i + 1
      );

      if (match) {
        return newCourt(i + 1, match.teams, true);
      }

      return newCourt(
        i + 1,
        [[null, null], [null, null]],
        false
      );
    }
  );
}

function enterQuarterfinals() {
  const seeds = standings().slice(0, 8);

  if (seeds.length !== 8) {
    throw new Error("Eight qualified teams required.");
  }

  // 1v8, 4v5, 2v7, 3v6.
  const pairs = [
    [0, 7],
    [3, 4],
    [1, 6],
    [2, 5],
  ];

  tournament.bracket.quarterfinals = pairs.map(
    ([a, b], index) =>
      newMatch(
        `QF${index + 1}`,
        index + 1,
        [seeds[a].team, seeds[b].team],
        `Quarterfinal ${index + 1}`
      )
  );

  tournament.stage = "quarterfinals";
  tournament.group = null;
  tournament.round = null;

  activateCourts(
    bracketCourts(tournament.bracket.quarterfinals)
  );
}

function matchWinner(match) {
  return match.teams[match.winner];
}

function matchLoser(match) {
  return match.teams[1 - match.winner];
}

function enterSemifinals() {
  const qf = tournament.bracket.quarterfinals;

  tournament.bracket.semifinals = [
    newMatch(
      "SF1",
      2,
      [matchWinner(qf[0]), matchWinner(qf[1])],
      "Semifinal 1"
    ),
    newMatch(
      "SF2",
      5,
      [matchWinner(qf[2]), matchWinner(qf[3])],
      "Semifinal 2"
    ),
  ];

  tournament.stage = "semifinals";

  activateCourts(
    bracketCourts(tournament.bracket.semifinals)
  );
}

function enterFinals() {
  const sf = tournament.bracket.semifinals;

  tournament.bracket.final = [
    newMatch(
      "FINAL",
      3,
      [matchWinner(sf[0]), matchWinner(sf[1])],
      "Championship Final"
    ),
    newMatch(
      "BRONZE",
      4,
      [matchLoser(sf[0]), matchLoser(sf[1])],
      "Third Place"
    ),
  ];

  tournament.stage = "finals";

  activateCourts(
    bracketCourts(tournament.bracket.final)
  );
}

function currentBracketMatches() {
  if (tournament.stage === "quarterfinals") {
    return tournament.bracket.quarterfinals;
  }

  if (tournament.stage === "semifinals") {
    return tournament.bracket.semifinals;
  }

  if (tournament.stage === "finals") {
    return tournament.bracket.final;
  }

  return [];
}

function recordResult(court) {
  const result = {
    id: crypto.randomUUID(),
    stage: tournament.stage,
    group: tournament.group,
    round: tournament.round,
    slotIndex: tournament.slotIndex,
    courtId: court.id,
    teams: court.teams.map((team) => [...team]),
    points: [...court.score.points],
    winner: court.score.winner,
    confirmedAt: Date.now(),
  };

  tournament.results.push(result);

  if (tournament.stage !== "groups") {
    const match = currentBracketMatches().find(
      (item) => item.courtId === court.id
    );

    if (match) {
      match.points = [...result.points];
      match.winner = result.winner;
      match.final = true;
    }
  }
}

function revertResult(court) {
  const index = tournament.results.findLastIndex(
    (result) =>
      result.courtId === court.id &&
      result.stage === tournament.stage &&
      result.slotIndex === tournament.slotIndex &&
      result.group === tournament.group
  );

  if (index >= 0) {
    tournament.results.splice(index, 1);
  }

  if (tournament.stage !== "groups") {
    const match = currentBracketMatches().find(
      (item) => item.courtId === court.id
    );

    if (match) {
      match.points = [...court.score.points];
      match.winner = null;
      match.final = false;
    }
  }
}

function advanceStage() {
  if (tournament.stage === "groups") {
    moveGroupCourts(tournament.group);

    const lastSlot = GROUP_ROUNDS * GROUPS.length - 1;

    if (tournament.slotIndex < lastSlot) {
      loadGroupSlot(tournament.slotIndex + 1);
    } else {
      enterQuarterfinals();
    }
  } else if (tournament.stage === "quarterfinals") {
    enterSemifinals();
  } else if (tournament.stage === "semifinals") {
    enterFinals();
  } else if (tournament.stage === "finals") {
    tournament.phase = "complete";
    tournament.stage = "complete";
    tournament.completedAt = Date.now();
    tournament.timer = newTimer(false);
  }
}

function canAdvance() {
  if (tournament.phase !== "live") return false;

  if (tournament.timer.startedAt === null) return false;

  if (Date.now() < tournament.timer.endsAt) return false;

  const active = tournament.courts.filter(
    (court) => court.active
  );

  return (
    active.length > 0 &&
    active.every((court) => court.final)
  );
}

function verifyMatchKey(matchKey) {
  if (matchKey !== getMatchKey()) {
    throw new Error(
      "The scheduled match changed. Refresh this court screen."
    );
  }
}

function emitState(io) {
  io.emit("tournament:state", snapshot());
}

function fail(ack, message) {
  if (typeof ack === "function") {
    ack({ ok: false, error: message });
  }
}

function succeed(ack, data = {}) {
  if (typeof ack === "function") {
    ack({ ok: true, ...data });
  }
}

function protectedEvent(socket, io, name, handler) {
  socket.on(name, (payload = {}, ack) => {
    try {
      if (!checkAuth(payload.token)) {
        return fail(
          ack,
          "Unauthorized. Please log in again."
        );
      }

      handler(payload);
      persist();
      emitState(io);
      succeed(ack);
    } catch (e) {
      fail(ack, e.message || "Operation failed.");
    }
  });
}

app.prepare().then(() => {
  const httpServer = createServer(
    (req, res) => handle(req, res)
  );

  const io = new Server(httpServer, {
    transports: ["websocket", "polling"],
  });

  io.on("connection", (socket) => {
    socket.emit("tournament:state", snapshot());

    socket.on(
      "coach:login",
      ({ password } = {}, ack) => {
        if (!checkPassword(password)) {
          return fail(ack, "Incorrect password.");
        }

        succeed(ack, { token: sessionToken });
      }
    );

    protectedEvent(
      socket,
      io,
      "player:update",
      ({ playerId, name, rating }) => {
        if (tournament.phase !== "setup") {
          throw new Error(
            "Player details are locked after the tournament starts."
          );
        }

        const player = findPlayer(playerId);

        if (!player) {
          throw new Error("Player not found.");
        }

        const cleanName = String(name || "")
          .trim()
          .replace(/\s+/g, " ");

        if (!cleanName || cleanName.length > 80) {
          throw new Error("Enter a name of 1–80 characters.");
        }

        if (!RATINGS.includes(rating)) {
          throw new Error("Invalid rating.");
        }

        const duplicate = tournament.groups[player.group]
          .players.some(
            (p) =>
              p.id !== playerId &&
              p.name.toLowerCase() === cleanName.toLowerCase()
          );

        if (duplicate) {
          throw new Error("Name already exists in this group.");
        }

        player.name = cleanName;
        player.rating = rating;
      }
    );

    protectedEvent(
      socket,
      io,
      "court:assign",
      ({ group, courtId, team, slot, playerId }) => {
        if (tournament.phase !== "setup") {
          throw new Error("Initial assignments are locked.");
        }

        if (!GROUPS.includes(group)) {
          throw new Error("Invalid group.");
        }

        const courts = tournament.groups[group].courts;

        const court = courts.find(
          (c) => c.id === Number(courtId)
        );

        if (
          !court ||
          ![0, 1].includes(team) ||
          ![0, 1].includes(slot)
        ) {
          throw new Error("Invalid court assignment.");
        }

        if (
          playerId &&
          !tournament.groups[group].players.some(
            (p) => p.id === playerId
          )
        ) {
          throw new Error("Player does not belong to this group.");
        }

        if (playerId) {
          for (const c of courts) {
            for (const t of c.teams) {
              for (let i = 0; i < t.length; i++) {
                if (t[i] === playerId) {
                  t[i] = null;
                }
              }
            }
          }
        }

        court.teams[team][slot] = playerId || null;
      }
    );

    protectedEvent(
      socket,
      io,
      "tournament:start",
      () => {
        if (tournament.phase !== "setup") {
          throw new Error("Tournament has already started.");
        }

        validateAssignments();

        tournament.phase = "live";
        tournament.startedAt = Date.now();

        // Group A loads without starting the clock.
        loadGroupSlot(0);
      }
    );

    /* ========================================
       COACH STARTS THE CURRENT MATCH TIMER
    ======================================== */

    protectedEvent(
      socket,
      io,
      "timer:start",
      ({ matchKey }) => {
        if (tournament.phase !== "live") {
          throw new Error("No active stage to start.");
        }

        verifyMatchKey(matchKey);

        if (tournament.timer.startedAt !== null) {
          throw new Error("This match timer has already started.");
        }

        const active = tournament.courts.filter(
          (court) => court.active
        );

        if (!active.length) {
          throw new Error("There are no scheduled matches.");
        }

        if (active.some((court) => court.final)) {
          throw new Error(
            "A result is already confirmed for this stage."
          );
        }

        tournament.timer = newTimer(true);
      }
    );

    protectedEvent(
      socket,
      io,
      "score:point",
      ({ courtId, team, matchKey }) => {
        if (tournament.phase !== "live") {
          throw new Error("Tournament is not live.");
        }

        verifyMatchKey(matchKey);

        if (tournament.timer.startedAt === null) {
          throw new Error(
            "The coach has not started this match."
          );
        }

        const court = tournament.courts.find(
          (c) => c.id === Number(courtId)
        );

        if (
          !court?.active ||
          court.final ||
          ![0, 1].includes(team)
        ) {
          throw new Error(
            "Scoring is unavailable for this court."
          );
        }

        // Scores remain incrementable after 10:00 has elapsed,
        // allowing a tied match to receive a decisive point.
        court.history.push([...court.score.points]);
        court.score.points[team] += 1;
      }
    );

    protectedEvent(
      socket,
      io,
      "score:undo",
      ({ courtId, matchKey }) => {
        verifyMatchKey(matchKey);

        const court = tournament.courts.find(
          (c) => c.id === Number(courtId)
        );

        if (
          !court?.active ||
          court.final ||
          !court.history.length
        ) {
          throw new Error("No point available to undo.");
        }

        court.score.points = court.history.pop();
      }
    );

    protectedEvent(
      socket,
      io,
      "score:finalize",
      ({ courtId, matchKey }) => {
        if (tournament.phase !== "live") {
          throw new Error("Tournament is not live.");
        }

        verifyMatchKey(matchKey);

        if (tournament.timer.startedAt === null) {
          throw new Error("The match has not started.");
        }

        const court = tournament.courts.find(
          (c) => c.id === Number(courtId)
        );

        if (!court?.active || court.final) {
          throw new Error("Court is unavailable or already final.");
        }

        const [a, b] = court.score.points;

        if (a === b) {
          throw new Error(
            "The scores are tied. A deciding point is required."
          );
        }

        court.score.finished = true;
        court.score.winner = a > b ? 0 : 1;
        court.final = true;

        recordResult(court);
      }
    );

    protectedEvent(
      socket,
      io,
      "score:reopen",
      ({ courtId, matchKey }) => {
        if (tournament.phase !== "live") {
          throw new Error("Tournament is not live.");
        }

        verifyMatchKey(matchKey);

        const court = tournament.courts.find(
          (c) => c.id === Number(courtId)
        );

        if (!court?.active || !court.final) {
          throw new Error("There is no confirmed result.");
        }

        revertResult(court);

        court.final = false;
        court.score.finished = false;
        court.score.winner = null;
      }
    );

    protectedEvent(
      socket,
      io,
      "tournament:reset",
      () => {
        tournament = newTournament();
      }
    );
  });

  // Stage rotation stays automatic, but the NEXT timer
  // never starts automatically.
  setInterval(() => {
    if (!canAdvance()) return;

    try {
      advanceStage();
      persist();
      emitState(io);
    } catch (e) {
      console.error("Stage advancement failed:", e);
    }
  }, 500);

  httpServer.listen(port, "0.0.0.0", () => {
    console.log(`AP Tournament running on port ${port}`);
    console.log(`Tournament state: ${STATE_FILE}`);
  });
});
