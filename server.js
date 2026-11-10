
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
  throw new Error("COACH_PASSWORD is missing");
}

const app = next({ dev });
const handle = app.getRequestHandler();

const GROUPS = ["A", "B", "C"];
const COURT_COUNT = 6;
const GROUP_ROUNDS = 4;
const GROUP_DURATION_MS = 9 * 60 * 1000;
const KNOCKOUT_TARGET = 10;
const VERSION = 5;

const STATE_FILE =
  process.env.TOURNAMENT_STATE_FILE ||
  path.join(process.cwd(), "tournament-state.json");

const sessionToken = crypto.randomBytes(32).toString("hex");

/* ==========================================
   INITIAL DATA
========================================== */

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

function newTimer() {
  return {
    durationMs: GROUP_DURATION_MS,
    startedAt: null,
    endsAt: null,
  };
}

function newGroup(group) {
  const players = Array.from(
    { length: 24 },
    (_, index) => ({
      id: `${group}-${String(index + 1).padStart(2, "0")}`,
      name: `${group} Player ${String(index + 1).padStart(2, "0")}`,
      group,
    })
  );

  const courts = Array.from(
    { length: COURT_COUNT },
    (_, index) => {
      const ids = players
        .slice(index * 4, index * 4 + 4)
        .map((player) => player.id);

      return newCourt(index + 1, [
        ids.slice(0, 2),
        ids.slice(2, 4),
      ]);
    }
  );

  return { players, courts };
}

function newTournament() {
  return {
    version: VERSION,
    phase: "setup",
    stage: "groups",
    group: "A",
    round: 1,
    slotIndex: 0,

    groups: Object.fromEntries(
      GROUPS.map((group) => [
        group,
        newGroup(group),
      ])
    ),

    courts: Array.from(
      { length: COURT_COUNT },
      (_, index) => newCourt(index + 1)
    ),

    startingCourts: null,
    knockoutPlayers: [],

    timer: newTimer(),
    results: [],

    qualification: null,

    bracket: {
      quarterfinals: [],
      semifinals: [],
      final: [],
    },

    startedAt: null,
    completedAt: null,
  };
}

/* ==========================================
   PERSISTENT STATE
========================================== */

function normalizeLoadedState(state) {
  if (
    !state ||
    typeof state !== "object" ||
    !state.groups ||
    !Array.isArray(state.courts)
  ) {
    throw new Error("Invalid tournament state file");
  }

  if (![2, 3, 4, VERSION].includes(state.version)) {
    throw new Error(
      "Unsupported state version. Back up the existing " +
      "state before resetting the tournament."
    );
  }

  state.version = VERSION;
  state.knockoutPlayers ??= [];
  state.startingCourts ??= null;
  state.results ??= [];
  state.qualification ??= null;

  state.bracket ??= {
    quarterfinals: [],
    semifinals: [],
    final: [],
  };

  state.bracket.quarterfinals ??= [];
  state.bracket.semifinals ??= [];
  state.bracket.final ??= [];

  state.timer ??= newTimer();

  // Levels are no longer part of the player model.
  for (const group of GROUPS) {
    for (const player of state.groups[group]?.players || []) {
      delete player.rating;
    }
  }

  // Preserve any previously confirmed QF draw.
  // This avoids replacing teams from an existing live event.
  if (
    state.stage !== "groups" &&
    state.stage !== "complete" &&
    state.bracket.quarterfinals.length === 4 &&
    state.qualification
  ) {
    state.qualification.drawConfirmed = true;
  }

  return state;
}

function loadTournament() {
  if (!fs.existsSync(STATE_FILE)) {
    return newTournament();
  }

  try {
    const saved = JSON.parse(
      fs.readFileSync(STATE_FILE, "utf8")
    );

    return normalizeLoadedState(saved);
  } catch (error) {
    throw new Error(
      `Could not load tournament state: ${error.message}`
    );
  }
}

let tournament = loadTournament();

function persist() {
  fs.mkdirSync(path.dirname(STATE_FILE), {
    recursive: true,
  });

  const temporaryFile = `${STATE_FILE}.tmp`;

  fs.writeFileSync(
    temporaryFile,
    JSON.stringify(tournament, null, 2)
  );

  fs.renameSync(temporaryFile, STATE_FILE);
}

/* ==========================================
   PLAYERS AND STATISTICS
========================================== */

function groupPlayers() {
  return GROUPS.flatMap(
    (group) => tournament.groups[group].players
  );
}

function findPlayer(id) {
  return (
    groupPlayers().find((p) => p.id === id) ||
    tournament.knockoutPlayers.find((p) => p.id === id)
  );
}

function teamKey(team) {
  return [...team].sort().join("|");
}

function teamLabel(team) {
  return team
    .map((id) => findPlayer(id)?.name || "Unknown Player")
    .join(" / ");
}

function isGroupStage() {
  return tournament.stage === "groups";
}

function matchKey() {
  if (isGroupStage()) {
    return `group-${tournament.group}-round-${tournament.round}`;
  }

  return tournament.stage;
}

function groupResults() {
  return tournament.results.filter(
    (result) => result.stage === "groups"
  );
}

function computePlayerStats() {
  const stats = new Map();

  for (const player of groupPlayers()) {
    stats.set(player.id, {
      id: player.id,
      name: player.name,
      group: player.group,
      wins: 0,
      losses: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      differential: 0,
    });
  }

  for (const result of groupResults()) {
    result.teams.forEach((team, side) => {
      for (const id of team) {
        const record = stats.get(id);
        if (!record) continue;

        record.pointsFor += result.points[side];
        record.pointsAgainst += result.points[1 - side];

        if (result.winner === side) {
          record.wins++;
        } else {
          record.losses++;
        }
      }
    });
  }

  for (const record of stats.values()) {
    record.differential =
      record.pointsFor - record.pointsAgainst;
  }

  return [...stats.values()];
}

function comparePlayers(a, b) {
  return (
    b.wins - a.wins ||
    b.differential - a.differential ||
    b.pointsFor - a.pointsFor ||
    a.id.localeCompare(b.id)
  );
}

function individualStandings(group = null) {
  return computePlayerStats()
    .filter(
      (player) => !group || player.group === group
    )
    .sort(comparePlayers);
}

/* ==========================================
   STARTING COURT SNAPSHOTS
========================================== */

function copyStartingCourts(courts) {
  return courts.map((court) => ({
    id: court.id,
    teams: court.teams.map((team) => [...team]),
  }));
}

function getStartingCourts() {
  if (tournament.startingCourts) {
    return tournament.startingCourts;
  }

  // For old saved tournaments, recover original
  // starting lineups from Round 1 result records.
  const recovered = {};

  for (const group of GROUPS) {
    const results = tournament.results.filter(
      (result) =>
        result.stage === "groups" &&
        result.group === group &&
        Number(result.round) === 1
    );

    if (results.length === COURT_COUNT) {
      recovered[group] = results
        .map((result) => ({
          id: result.courtId,
          teams: result.teams.map((team) => [...team]),
        }))
        .sort((a, b) => a.id - b.id);

      continue;
    }

    const hasAdvanced = tournament.results.some(
      (result) =>
        result.stage === "groups" &&
        result.group === group &&
        Number(result.round) > 1
    );

    if (
      !hasAdvanced &&
      results.length === 0 &&
      tournament.groups[group]?.courts?.length ===
        COURT_COUNT
    ) {
      recovered[group] = copyStartingCourts(
        tournament.groups[group].courts
      );
    } else {
      recovered[group] = null;
    }
  }

  return recovered;
}

/* ==========================================
   PUBLIC SNAPSHOT
========================================== */

function snapshot() {
  const records = computePlayerStats();

  const statsMap = new Map(
    records.map((player) => [player.id, player])
  );

  const players = [
    ...groupPlayers().map((player) => ({
      ...player,
      ...statsMap.get(player.id),
    })),

    ...tournament.knockoutPlayers.map((player) => ({
      ...player,
      wins: 0,
      losses: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      differential: 0,
    })),
  ];

  const active = tournament.courts.filter(
    (court) => court.active
  );

  const confirmed = active.filter(
    (court) => court.final
  );

  const hasTimer = isGroupStage();

  const timerStarted =
    hasTimer &&
    tournament.timer.startedAt !== null;

  const timeExpired =
    timerStarted &&
    tournament.timer.endsAt !== null &&
    Date.now() >= tournament.timer.endsAt;

  const drawConfirmed = Boolean(
    tournament.qualification?.drawConfirmed
  );

  return {
    version: tournament.version,
    phase: tournament.phase,
    stage: tournament.stage,
    group: tournament.group,
    round: tournament.round,
    slotIndex: tournament.slotIndex,
    matchKey: matchKey(),

    hasTimer,
    timer: tournament.timer,
    timerStarted,
    timeExpired,

    scoringMode: hasTimer
      ? "timed-points"
      : "first-to-ten",

    targetPoints: hasTimer ? null : KNOCKOUT_TARGET,

    awaitingStart:
      tournament.phase === "live" &&
      hasTimer &&
      !timerStarted,

    awaitingResults:
      tournament.phase === "live" &&
      hasTimer &&
      timeExpired &&
      confirmed.length < active.length,

    quarterfinalDrawPending:
      tournament.phase === "live" &&
      tournament.stage === "quarterfinals" &&
      !drawConfirmed,

    activeMatchCount: active.length,
    confirmedCount: confirmed.length,

    players,
    groups: tournament.groups,
    startingCourts: getStartingCourts(),

    courts: tournament.courts.map(
      ({ history, ...court }) => court
    ),

    individualStandings: individualStandings(),

    groupStandings: Object.fromEntries(
      GROUPS.map((group) => [
        group,
        individualStandings(group),
      ])
    ),

    qualification: tournament.qualification,

    standings:
      tournament.qualification?.teams || [],

    bracket: tournament.bracket,
    results: tournament.results,

    startedAt: tournament.startedAt,
    completedAt: tournament.completedAt,
  };
}

/* ==========================================
   AUTHENTICATION
========================================== */

function checkAuth(token) {
  if (typeof token !== "string") return false;

  const actual = Buffer.from(token);
  const expected = Buffer.from(sessionToken);

  return (
    actual.length === expected.length &&
    crypto.timingSafeEqual(actual, expected)
  );
}

function checkPassword(password) {
  if (typeof password !== "string") return false;

  const actual = crypto
    .createHash("sha256")
    .update(password)
    .digest();

  const expected = crypto
    .createHash("sha256")
    .update(process.env.COACH_PASSWORD)
    .digest();

  return crypto.timingSafeEqual(actual, expected);
}

/* ==========================================
   INITIAL GROUP ASSIGNMENTS
========================================== */

function validateAssignments() {
  for (const group of GROUPS) {
    const data = tournament.groups[group];

    const assigned = data.courts.flatMap(
      (court) => court.teams.flat()
    );

    const expected = data.players.map(
      (player) => player.id
    );

    if (
      assigned.length !== 24 ||
      assigned.some((id) => !id) ||
      new Set(assigned).size !== 24 ||
      expected.some((id) => !assigned.includes(id))
    ) {
      throw new Error(
        `Group ${group} must contain 24 unique assigned players.`
      );
    }
  }
}

function loadCourts(courts) {
  tournament.courts = courts.map((court) =>
    newCourt(
      court.id,
      court.teams,
      court.active !== false
    )
  );

  tournament.timer = newTimer();
}

function loadGroupSlot(index) {
  tournament.stage = "groups";
  tournament.slotIndex = index;
  tournament.round = Math.floor(index / 3) + 1;
  tournament.group = GROUPS[index % 3];

  loadCourts(
    tournament.groups[tournament.group].courts
  );
}

/* ==========================================
   AMERICANO PARTNER ROTATION
========================================== */

function previousPartnershipCounts(group) {
  const counts = new Map();

  for (const result of groupResults()) {
    if (result.group !== group) continue;

    for (const team of result.teams) {
      const key = teamKey(team);
      counts.set(key, (counts.get(key) || 0) + 1);
    }
  }

  return counts;
}

function splitPlayersIntoNewTeams(
  first,
  second,
  partnershipCounts
) {
  // Always split both incoming partnerships.
  // Each new team takes one player from each
  // incoming pair.
  const options = [
    [
      [first[0], second[0]],
      [first[1], second[1]],
    ],
    [
      [first[0], second[1]],
      [first[1], second[0]],
    ],
  ];

  function penalty(teams) {
    return teams.reduce(
      (total, team) =>
        total +
        (partnershipCounts.get(teamKey(team)) || 0),
      0
    );
  }

  options.sort(
    (a, b) =>
      penalty(a) - penalty(b) ||
      teamKey(a[0]).localeCompare(teamKey(b[0]))
  );

  return options[0];
}

function advanceAmericanoGroup(group) {
  const incoming = Array.from(
    { length: COURT_COUNT },
    () => []
  );

  for (const court of tournament.courts) {
    if (!court.final) {
      throw new Error(
        `Court ${court.id} is not confirmed.`
      );
    }

    const index = court.id - 1;
    const winning = court.teams[court.score.winner];
    const losing = court.teams[1 - court.score.winner];

    // Court 1 is the highest court.
    incoming[Math.max(0, index - 1)].push([...winning]);
    incoming[Math.min(COURT_COUNT - 1, index + 1)]
      .push([...losing]);
  }

  const counts = previousPartnershipCounts(group);

  const nextCourts = incoming.map(
    (teams, index) => {
      if (teams.length !== 2) {
        throw new Error(
          `Invalid court rotation at Court ${index + 1}.`
        );
      }

      const newTeams = splitPlayersIntoNewTeams(
        teams[0],
        teams[1],
        counts
      );

      for (const team of newTeams) {
        const key = teamKey(team);
        counts.set(
          key,
          (counts.get(key) || 0) + 1
        );
      }

      return newCourt(index + 1, newTeams);
    }
  );

  const previousPlayers = tournament.courts.flatMap(
    (court) => court.teams.flat()
  );

  const nextPlayers = nextCourts.flatMap(
    (court) => court.teams.flat()
  );

  if (
    nextPlayers.length !== 24 ||
    new Set(nextPlayers).size !== 24 ||
    previousPlayers.some(
      (id) => !nextPlayers.includes(id)
    )
  ) {
    throw new Error(
      "Americano rotation produced invalid assignments."
    );
  }

  tournament.groups[group].courts = nextCourts;
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
    (_, index) => {
      const courtId = index + 1;

      const match = matches.find(
        (item) => item.courtId === courtId
      );

      return match
        ? newCourt(courtId, match.teams, true)
        : newCourt(
            courtId,
            [[null, null], [null, null]],
            false
          );
    }
  );
}


function enterQuarterfinals() {
  tournament.stage = "quarterfinals";
  tournament.group = null;
  tournament.round = null;

  // No automatic qualification.
  tournament.knockoutPlayers = [];

  tournament.qualification = {
    qualifiedAt: null,
    guaranteed: [],
    wildcards: [],
    qualifiedPlayerIds: [],
    teams: [],
    drawConfirmed: false,
    drawConfirmedAt: null,
  };

  tournament.bracket.quarterfinals = [];
  tournament.bracket.semifinals = [];
  tournament.bracket.final = [];

  // The coach must enter and confirm all players.
  loadCourts(
    Array.from(
      { length: COURT_COUNT },
      (_, index) =>
        newCourt(
          index + 1,
          [[null, null], [null, null]],
          false
        )
    )
  );
}

function normalizeName(value) {
  if (typeof value !== "string") return "";

  return value.trim().replace(/\s+/g, " ");
}

function confirmQuarterfinalDraw(matches) {
  if (
    tournament.phase !== "live" ||
    tournament.stage !== "quarterfinals"
  ) {
    throw new Error(
      "The quarterfinal draw is not available yet."
    );
  }

  if (tournament.qualification?.drawConfirmed) {
    throw new Error(
      "The quarterfinal draw is already confirmed."
    );
  }

  if (
    !Array.isArray(matches) ||
    matches.length !== 4
  ) {
    throw new Error(
      "Exactly four quarterfinal matches are required."
    );
  }

  const courtIds = [];
  const names = [];

  const normalized = matches.map(
    (match, index) => {
      const courtId = Number(match.courtId);

      if (
        !Number.isInteger(courtId) ||
        courtId < 1 ||
        courtId > COURT_COUNT
      ) {
        throw new Error(
          `QF${index + 1}: Choose a court from 1 to 6.`
        );
      }

      if (
        !Array.isArray(match.teams) ||
        match.teams.length !== 2 ||
        match.teams.some(
          (team) =>
            !Array.isArray(team) ||
            team.length !== 2
        )
      ) {
        throw new Error(
          `QF${index + 1}: Two teams of two are required.`
        );
      }

      const teams = match.teams.map(
        (team) => team.map(normalizeName)
      );

      if (
        teams.flat().some(
          (name) => !name || name.length > 80
        )
      ) {
        throw new Error(
          `QF${index + 1}: Enter four valid player names.`
        );
      }

      courtIds.push(courtId);
      names.push(...teams.flat());

      return { courtId, teams };
    }
  );

  if (new Set(courtIds).size !== 4) {
    throw new Error(
      "All four quarterfinal matches must use different courts."
    );
  }

  const uniqueNames = new Set(
    names.map((name) => name.toLocaleLowerCase("en"))
  );

  if (
    names.length !== 16 ||
    uniqueNames.size !== 16
  ) {
    throw new Error(
      "Enter 16 different player names, with no duplicates."
    );
  }

  // These IDs are independent of group-stage IDs.
  // A last-minute replacement can therefore enter
  // the knockouts without appearing in the 72-player roster.
  const knockoutPlayers = names.map(
    (name, index) => ({
      id: `KO-${String(index + 1).padStart(2, "0")}`,
      name,
      group: null,
      knockoutOnly: true,
    })
  );

  let playerIndex = 0;

  const quarterfinals = normalized.map(
    (match, index) => {
      const teams = match.teams.map(
        (team) =>
          team.map(() => {
            const id =
              knockoutPlayers[playerIndex].id;

            playerIndex++;
            return id;
          })
      );

      return newMatch(
        `QF${index + 1}`,
        match.courtId,
        teams,
        `Quarterfinal ${index + 1}`
      );
    }
  );

  const teams = quarterfinals.flatMap(
    (match) =>
      match.teams.map((team) => [...team])
  );

  // All validation is complete. Commit atomically.
  tournament.knockoutPlayers = knockoutPlayers;

  tournament.qualification = {
    qualifiedAt: Date.now(),
    guaranteed: [],
    wildcards: [],
    qualifiedPlayerIds: knockoutPlayers.map(
      (player) => player.id
    ),

    teams: teams.map((ids, index) => ({
      seed: index + 1,
      ids,
      name: ids
        .map(
          (id) =>
            knockoutPlayers.find(
              (player) => player.id === id
            )?.name || "Unknown"
        )
        .join(" / "),
      origin: "MANUAL DRAW",
    })),

    drawConfirmed: true,
    drawConfirmedAt: Date.now(),
  };

  tournament.bracket.quarterfinals = quarterfinals;

  // Show the coach's chosen courts to everyone.
  loadCourts(bracketCourts(quarterfinals));
}


function matchWinner(match) {
  if (!match?.final || match.winner === null) {
    throw new Error(
      "The previous match is not complete."
    );
  }

  return match.teams[match.winner];
}

function matchLoser(match) {
  if (!match?.final || match.winner === null) {
    throw new Error(
      "The previous match is not complete."
    );
  }

  return match.teams[1 - match.winner];
}

function enterSemifinals() {
  const qf = tournament.bracket.quarterfinals;

  // SF1: Winner QF1 vs Winner QF2
  // SF2: Winner QF3 vs Winner QF4
  tournament.bracket.semifinals = [
    newMatch(
      "SF1",
      2,
      [
        matchWinner(qf[0]),
        matchWinner(qf[1]),
      ],
      "Semifinal 1"
    ),

    newMatch(
      "SF2",
      5,
      [
        matchWinner(qf[2]),
        matchWinner(qf[3]),
      ],
      "Semifinal 2"
    ),
  ];

  tournament.stage = "semifinals";

  loadCourts(
    bracketCourts(tournament.bracket.semifinals)
  );
}

function enterFinals() {
  const sf = tournament.bracket.semifinals;

  tournament.bracket.final = [
    newMatch(
      "FINAL",
      3,
      [
        matchWinner(sf[0]),
        matchWinner(sf[1]),
      ],
      "Championship Final"
    ),

    newMatch(
      "BRONZE",
      4,
      [
        matchLoser(sf[0]),
        matchLoser(sf[1]),
      ],
      "Third Place"
    ),
  ];

  tournament.stage = "finals";

  loadCourts(
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

  if (!isGroupStage()) {
    const match = currentBracketMatches().find(
      (item) => item.courtId === court.id
    );

    if (!match) {
      throw new Error(
        "Matching bracket fixture could not be found."
      );
    }

    match.points = [...result.points];
    match.winner = result.winner;
    match.final = true;
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

  if (!isGroupStage()) {
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
    const finalGroupSlot =
      GROUP_ROUNDS * GROUPS.length - 1;

    if (tournament.slotIndex < finalGroupSlot) {
      // Rotate players only if this group has
      // another round remaining.
      if (tournament.round < GROUP_ROUNDS) {
        advanceAmericanoGroup(tournament.group);
      }

      loadGroupSlot(tournament.slotIndex + 1);
    } else {
      enterQuarterfinals();
    }
  } else if (
    tournament.stage === "quarterfinals"
  ) {
    enterSemifinals();
  } else if (
    tournament.stage === "semifinals"
  ) {
    enterFinals();
  } else if (
    tournament.stage === "finals"
  ) {
    tournament.phase = "complete";
    tournament.stage = "complete";
    tournament.completedAt = Date.now();
    tournament.timer = newTimer();
  }
}

function canAdvance() {
  if (tournament.phase !== "live") {
    return false;
  }

  if (
    tournament.stage === "quarterfinals" &&
    !tournament.qualification?.drawConfirmed
  ) {
    return false;
  }

  const active = tournament.courts.filter(
    (court) => court.active
  );

  if (
    active.length === 0 ||
    !active.every((court) => court.final)
  ) {
    return false;
  }

  if (isGroupStage()) {
    return (
      tournament.timer.startedAt !== null &&
      tournament.timer.endsAt !== null &&
      Date.now() >= tournament.timer.endsAt
    );
  }

  return true;
}


function emitState(io) {
  io.emit("tournament:state", snapshot());
}

function succeed(ack, data = {}) {
  if (typeof ack === "function") {
    ack({ ok: true, ...data });
  }
}

function fail(ack, error) {
  if (typeof ack === "function") {
    ack({ ok: false, error });
  }
}

function verifyMatchKey(key) {
  if (key !== matchKey()) {
    throw new Error(
      "The match has changed. Refresh this screen."
    );
  }
}

function protectedEvent(
  socket,
  io,
  eventName,
  handler
) {
  socket.on(eventName, (payload = {}, ack) => {
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
    } catch (error) {
      fail(
        ack,
        error.message || "Operation failed."
      );
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
      ({ playerId, name }) => {
        if (tournament.phase !== "setup") {
          throw new Error(
            "Player editing is locked after tournament start."
          );
        }

        const player = groupPlayers().find(
          (item) => item.id === playerId
        );

        if (!player) {
          throw new Error("Player not found.");
        }

        const cleaned = normalizeName(name);

        if (!cleaned || cleaned.length > 80) {
          throw new Error(
            "Player names must contain 1–80 characters."
          );
        }

        const duplicate =
          tournament.groups[player.group].players.some(
            (item) =>
              item.id !== playerId &&
              item.name.toLowerCase() ===
                cleaned.toLowerCase()
          );

        if (duplicate) {
          throw new Error(
            "This name already exists in the group."
          );
        }

        player.name = cleaned;
      }
    );


    protectedEvent(
      socket,
      io,
      "court:assign",
      ({ group, courtId, team, slot, playerId }) => {
        if (tournament.phase !== "setup") {
          throw new Error(
            "Starting assignments are locked."
          );
        }

        if (!GROUPS.includes(group)) {
          throw new Error("Invalid group.");
        }

        const courts = tournament.groups[group].courts;

        const targetCourt = courts.find(
          (court) => court.id === Number(courtId)
        );

        if (
          !targetCourt ||
          ![0, 1].includes(team) ||
          ![0, 1].includes(slot)
        ) {
          throw new Error("Invalid court assignment.");
        }

        if (
          playerId &&
          !tournament.groups[group].players.some(
            (player) => player.id === playerId
          )
        ) {
          throw new Error(
            "The selected player is not in this group."
          );
        }

        const destination =
          targetCourt.teams[team][slot];

        let previous = null;

        if (playerId) {
          for (const court of courts) {
            for (let side = 0; side < 2; side++) {
              for (let position = 0; position < 2; position++) {
                if (
                  court.teams[side][position] === playerId
                ) {
                  previous = {
                    court,
                    side,
                    position,
                  };
                }
              }
            }
          }
        }

        if (previous) {
          previous.court.teams[
            previous.side
          ][previous.position] = destination || null;
        }

        targetCourt.teams[team][slot] =
          playerId || null;
      }
    );


    protectedEvent(
      socket,
      io,
      "tournament:start",
      () => {
        if (tournament.phase !== "setup") {
          throw new Error(
            "Tournament has already started."
          );
        }

        validateAssignments();

        tournament.startingCourts =
          Object.fromEntries(
            GROUPS.map((group) => [
              group,
              copyStartingCourts(
                tournament.groups[group].courts
              ),
            ])
          );

        tournament.phase = "live";
        tournament.startedAt = Date.now();

        // Group A loads with a paused clock.
        loadGroupSlot(0);
      }
    );


    protectedEvent(
      socket,
      io,
      "timer:start",
      ({ matchKey: key }) => {
        if (
          tournament.phase !== "live" ||
          !isGroupStage()
        ) {
          throw new Error(
            "Only group matches use a timer."
          );
        }

        verifyMatchKey(key);

        if (tournament.timer.startedAt !== null) {
          throw new Error(
            "This match has already started."
          );
        }

        const now = Date.now();

        tournament.timer = {
          durationMs: GROUP_DURATION_MS,
          startedAt: now,
          endsAt: now + GROUP_DURATION_MS,
        };
      }
    );


    protectedEvent(
      socket,
      io,
      "knockout:draw:confirm",
      ({ matches }) => {
        confirmQuarterfinalDraw(matches);
      }
    );


    protectedEvent(
      socket,
      io,
      "score:point",
      ({ courtId, team, matchKey: key }) => {
        if (tournament.phase !== "live") {
          throw new Error(
            "Tournament is not live."
          );
        }

        verifyMatchKey(key);

        if (
          isGroupStage() &&
          tournament.timer.startedAt === null
        ) {
          throw new Error(
            "The coach has not started this match."
          );
        }

        const court = tournament.courts.find(
          (item) => item.id === Number(courtId)
        );

        if (
          !court?.active ||
          court.final ||
          ![0, 1].includes(team)
        ) {
          throw new Error(
            "This court is unavailable for scoring."
          );
        }

        if (
          !isGroupStage() &&
          court.score.points.some(
            (points) => points >= KNOCKOUT_TARGET
          )
        ) {
          throw new Error(
            "A team has reached 10 points. Confirm the result."
          );
        }

        court.history.push([...court.score.points]);
        court.score.points[team] += 1;
      }
    );


    protectedEvent(
      socket,
      io,
      "score:undo",
      ({ courtId, matchKey: key }) => {
        if (tournament.phase !== "live") {
          throw new Error(
            "Tournament is not live."
          );
        }

        verifyMatchKey(key);

        const court = tournament.courts.find(
          (item) => item.id === Number(courtId)
        );

        if (
          !court?.active ||
          court.final ||
          !court.history.length
        ) {
          throw new Error(
            "No point available to undo."
          );
        }

        court.score.points = court.history.pop();
      }
    );


    protectedEvent(
      socket,
      io,
      "score:finalize",
      ({ courtId, matchKey: key }) => {
        if (tournament.phase !== "live") {
          throw new Error(
            "Tournament is not live."
          );
        }

        verifyMatchKey(key);

        if (
          isGroupStage() &&
          tournament.timer.startedAt === null
        ) {
          throw new Error(
            "The round has not started."
          );
        }

        const court = tournament.courts.find(
          (item) => item.id === Number(courtId)
        );

        if (!court?.active || court.final) {
          throw new Error(
            "This court is unavailable or already final."
          );
        }

        const [a, b] = court.score.points;

        if (isGroupStage()) {
          if (a === b) {
            throw new Error(
              "A group match cannot finish tied."
            );
          }
        } else {
          if (
            Math.max(a, b) !== KNOCKOUT_TARGET ||
            Math.min(a, b) >= KNOCKOUT_TARGET
          ) {
            throw new Error(
              "A knockout match ends when the first team reaches 10."
            );
          }
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
      ({ courtId, matchKey: key }) => {
        if (tournament.phase !== "live") {
          throw new Error(
            "Tournament is not live."
          );
        }

        verifyMatchKey(key);

        const court = tournament.courts.find(
          (item) => item.id === Number(courtId)
        );

        if (!court?.active || !court.final) {
          throw new Error(
            "There is no result to reopen."
          );
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

  setInterval(() => {
    if (!canAdvance()) return;

    try {
      advanceStage();
      persist();
      emitState(io);
    } catch (error) {
      console.error(
        "Stage progression failed:",
        error
      );
    }
  }, 500);

  httpServer.listen(
    port,
    "0.0.0.0",
    () => {
      console.log(
        `Tournament server listening on ${port}`
      );

      console.log(
        `State file: ${STATE_FILE}`
      );
    }
  );
});
