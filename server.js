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
const COURT_COUNT = 6;
const GROUP_ROUNDS = 4;
// const GROUP_DURATION_MS = 10 * 60 * 1000;
const GROUP_DURATION_MS = 15 * 1000;
const KNOCKOUT_TARGET = 10;
const VERSION = 4;

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

function newTimer() {
    return {
        durationMs: GROUP_DURATION_MS,
        startedAt: null,
        endsAt: null,
    };
}

function newGroup(group) {
    const players = Array.from({ length: 24 }, (_, index) => ({
        id: `${group}-${String(index + 1).padStart(2, "0")}`,
        name: `${group} Player ${String(index + 1).padStart(2, "0")}`,
        group,
    }));

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
            GROUPS.map((group) => [group, newGroup(group)])
        ),

        courts: Array.from(
            { length: COURT_COUNT },
            (_, index) => newCourt(index + 1)
        ),

        timer: newTimer(),
        results: [],

        bracket: {
            quarterfinals: [],
            semifinals: [],
            final: [],
        },

        qualification: null,
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
        parsed = JSON.parse(
            fs.readFileSync(STATE_FILE, "utf8")
        );
    } catch (error) {
        throw new Error(
            `Unable to load tournament state: ${error.message}`
        );
    }

    if (parsed.version === VERSION) return parsed;

    if (parsed.version === 3 || parsed.version === 2) {
        // Keep existing data. A clean reset is recommended
        // when changing an in-progress event to Americano.
        parsed.version = VERSION;
        parsed.qualification = parsed.qualification || null;
        parsed.results = parsed.results || [];
        parsed.bracket = parsed.bracket || {
            quarterfinals: [],
            semifinals: [],
            final: [],
        };
        return parsed;
    }

    throw new Error(
        "Unsupported tournament state. Back up the state file " +
        "and reset the event before upgrading."
    );
}

let tournament = loadTournament();

function persist() {
    fs.mkdirSync(path.dirname(STATE_FILE), {
        recursive: true,
    });

    const temporary = `${STATE_FILE}.tmp`;

    fs.writeFileSync(
        temporary,
        JSON.stringify(tournament, null, 2)
    );

    fs.renameSync(temporary, STATE_FILE);
}

function allPlayers() {
    return GROUPS.flatMap(
        (group) => tournament.groups[group].players
    );
}

function findPlayer(id) {
    return allPlayers().find((player) => player.id === id);
}

function teamKey(ids) {
    return [...ids].sort().join("|");
}

function teamLabel(ids) {
    return ids
        .map((id) => findPlayer(id)?.name || "Player TBC")
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

    for (const player of allPlayers()) {
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
        for (let side = 0; side < 2; side++) {
            for (const id of result.teams[side]) {
                const player = stats.get(id);

                if (!player) continue;

                const scored = result.points[side];
                const conceded = result.points[1 - side];

                player.pointsFor += scored;
                player.pointsAgainst += conceded;

                if (result.winner === side) {
                    player.wins++;
                } else {
                    player.losses++;
                }
            }
        }
    }

    for (const player of stats.values()) {
        player.differential =
            player.pointsFor - player.pointsAgainst;
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
            (player) => group === null || player.group === group
        )
        .sort(comparePlayers);
}


function knockoutQualification() {
    const guaranteed = [];
    const guaranteedIds = new Set();

    // Top two individual players from each group.
    for (const group of GROUPS) {
        const topTwo = individualStandings(group).slice(0, 2);

        if (topTwo.length !== 2) {
            throw new Error(
                `Cannot determine two qualifiers for Group ${group}.`
            );
        }

        for (const player of topTwo) {
            guaranteed.push(player.id);
            guaranteedIds.add(player.id);
        }
    }

    // Ten remaining places awarded by individual ranking.
    const wildcards = individualStandings()
        .filter((player) => !guaranteedIds.has(player.id))
        .slice(0, 10)
        .map((player) => player.id);

    const qualifiedPlayerIds = [...guaranteed, ...wildcards];

    if (
        guaranteed.length !== 6 ||
        wildcards.length !== 10 ||
        new Set(qualifiedPlayerIds).size !== 16
    ) {
        throw new Error(
            "Quarterfinal qualification must contain 16 unique players."
        );
    }

    return {
        qualifiedAt: Date.now(),
        guaranteed,
        wildcards,
        qualifiedPlayerIds,

        // Populated only after the coach confirms the draw.
        teams: [],
        drawConfirmed: false,
        drawConfirmedAt: null,
    };
}


function snapshot() {
    const individualStats = computePlayerStats();

    const statsMap = new Map(
        individualStats.map((player) => [player.id, player])
    );

    const all = allPlayers().map((player) => ({
        ...player,
        ...statsMap.get(player.id),
    }));

    const active = tournament.courts.filter(
        (court) => court.active
    );

    const confirmed = active.filter(
        (court) => court.final
    );

    const clockStarted =
        isGroupStage() &&
        tournament.timer.startedAt !== null;

    const timeExpired =
        clockStarted &&
        tournament.timer.endsAt !== null &&
        Date.now() >= tournament.timer.endsAt;

    return {
        version: VERSION,
        phase: tournament.phase,
        stage: tournament.stage,
        group: tournament.group,
        round: tournament.round,
        slotIndex: tournament.slotIndex,
        matchKey: matchKey(),

        scoringMode: isGroupStage()
            ? "timed-points"
            : "first-to-ten",

        targetPoints: isGroupStage()
            ? null
            : KNOCKOUT_TARGET,

        hasTimer: isGroupStage(),
        timer: tournament.timer,
        timerStarted: clockStarted,
        timeExpired,

        awaitingStart:
            tournament.phase === "live" &&
            isGroupStage() &&
            !clockStarted,

        awaitingResults:
            tournament.phase === "live" &&
            isGroupStage() &&
            timeExpired &&
            confirmed.length < active.length,

        activeMatchCount: active.length,
        confirmedCount: confirmed.length,

        players: all,
        individualStandings: individualStandings(),
        groupStandings: Object.fromEntries(
            GROUPS.map((group) => [
                group,
                individualStandings(group),
            ])
        ),

        groups: tournament.groups,

        courts: tournament.courts.map(
            ({ history, ...court }) => court
        ),

        qualification: tournament.qualification,
        standings:
            tournament.qualification?.teams || [],

        bracket: tournament.bracket,
        results: tournament.results,
        completedAt: tournament.completedAt,

        quarterfinalDrawPending:
            tournament.phase === "live" &&
            tournament.stage === "quarterfinals" &&
            !tournament.qualification?.drawConfirmed,
    };
}

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

function validateAssignments() {
    for (const group of GROUPS) {
        const players = tournament.groups[group].players;
        const courts = tournament.groups[group].courts;

        const assigned = courts.flatMap(
            (court) => court.teams.flat()
        );

        const expected = players.map((player) => player.id);

        if (
            assigned.length !== 24 ||
            assigned.some((id) => !id) ||
            new Set(assigned).size !== 24 ||
            expected.some((id) => !assigned.includes(id))
        ) {
            throw new Error(
                `Group ${group} must have all 24 players assigned once.`
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

    // Timer only operates during the group stage.
    tournament.timer = newTimer();
}

function loadGroupSlot(index) {
    tournament.stage = "groups";
    tournament.slotIndex = index;
    tournament.round = Math.floor(index / 3) + 1;
    tournament.group = GROUPS[index % 3];

    loadCourts(tournament.groups[tournament.group].courts);
}

/* ==========================================
   AMERICANO PARTNER ROTATION
========================================== */

function previousPartnershipCounts(group) {
    const counts = new Map();

    // Count all previously played partnerships.
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
    teamOne,
    teamTwo,
    partnershipCounts
) {
    // The two incoming teams are deliberately broken up.
    // Every new team has one player from each incoming team.
    const options = [
        [
            [teamOne[0], teamTwo[0]],
            [teamOne[1], teamTwo[1]],
        ],
        [
            [teamOne[0], teamTwo[1]],
            [teamOne[1], teamTwo[0]],
        ],
    ];

    function repeatedPartnersScore(teams) {
        return teams.reduce(
            (total, team) =>
                total +
                (partnershipCounts.get(teamKey(team)) || 0),
            0
        );
    }

    options.sort(
        (a, b) =>
            repeatedPartnersScore(a) -
            repeatedPartnersScore(b) ||
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
                `Court ${court.id} has not been confirmed.`
            );
        }

        const index = court.id - 1;
        const winner = court.teams[court.score.winner];
        const loser = court.teams[1 - court.score.winner];

        // Winners move toward Court 1.
        incoming[Math.max(0, index - 1)].push([...winner]);

        // Losers move toward Court 6.
        incoming[Math.min(COURT_COUNT - 1, index + 1)]
            .push([...loser]);
    }

    const counts = previousPartnershipCounts(group);

    const nextCourts = incoming.map((teams, index) => {
        if (teams.length !== 2) {
            throw new Error(
                `Americano rotation failed at Court ${index + 1}.`
            );
        }

        const newTeams = splitPlayersIntoNewTeams(
            teams[0],
            teams[1],
            counts
        );

        for (const team of newTeams) {
            const key = teamKey(team);
            counts.set(key, (counts.get(key) || 0) + 1);
        }

        return newCourt(index + 1, newTeams);
    });

    const originalIds = tournament.courts.flatMap(
        (court) => court.teams.flat()
    );

    const nextIds = nextCourts.flatMap(
        (court) => court.teams.flat()
    );

    if (
        originalIds.length !== 24 ||
        nextIds.length !== 24 ||
        new Set(nextIds).size !== 24 ||
        originalIds.some((id) => !nextIds.includes(id))
    ) {
        throw new Error(
            "Americano rotation lost or duplicated a player."
        );
    }

    tournament.groups[group].courts = nextCourts;
}

/* ==========================================
   KNOCKOUT BRACKET
========================================== */

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
    const qualification = knockoutQualification();

    tournament.qualification = qualification;
    tournament.stage = "quarterfinals";
    tournament.group = null;
    tournament.round = null;

    tournament.bracket.quarterfinals = [];

    // No QF match is active until the coach confirms the draw.
    const emptyCourts = Array.from(
        { length: COURT_COUNT },
        (_, index) =>
            newCourt(
                index + 1,
                [[null, null], [null, null]],
                false
            )
    );

    loadCourts(emptyCourts);
}


function confirmQuarterfinalDraw(matches) {
    if (
        tournament.phase !== "live" ||
        tournament.stage !== "quarterfinals"
    ) {
        throw new Error(
            "The quarterfinal draw can only be assigned after the group stage."
        );
    }

    if (tournament.qualification?.drawConfirmed) {
        throw new Error(
            "The quarterfinal draw is already confirmed and locked."
        );
    }

    if (!Array.isArray(matches) || matches.length !== 4) {
        throw new Error(
            "Exactly four quarterfinal matches must be assigned."
        );
    }

    const qualifiedIds =
        tournament.qualification?.qualifiedPlayerIds || [];

    if (qualifiedIds.length !== 16) {
        throw new Error(
            "The 16 qualifying players have not been determined."
        );
    }

    const qualifiedSet = new Set(qualifiedIds);
    const assignedPlayers = [];
    const assignedCourts = [];

    const normalized = matches.map((match, index) => {
        const courtId = Number(match.courtId);

        if (
            !Number.isInteger(courtId) ||
            courtId < 1 ||
            courtId > COURT_COUNT
        ) {
            throw new Error(
                `Quarterfinal ${index + 1} needs a valid court (1–6).`
            );
        }

        if (
            !Array.isArray(match.teams) ||
            match.teams.length !== 2 ||
            match.teams.some(
                (team) =>
                    !Array.isArray(team) ||
                    team.length !== 2 ||
                    team.some((id) => typeof id !== "string" || !id)
            )
        ) {
            throw new Error(
                `Quarterfinal ${index + 1} requires two teams of two players.`
            );
        }

        assignedCourts.push(courtId);

        const teams = match.teams.map((team) => [...team]);

        assignedPlayers.push(...teams.flat());

        return newMatch(
            `QF${index + 1}`,
            courtId,
            teams,
            `Quarterfinal ${index + 1}`
        );
    });

    if (new Set(assignedCourts).size !== 4) {
        throw new Error(
            "Each quarterfinal must be assigned a different physical court."
        );
    }

    if (
        assignedPlayers.length !== 16 ||
        new Set(assignedPlayers).size !== 16
    ) {
        throw new Error(
            "Each of the 16 players must appear exactly once."
        );
    }

    if (assignedPlayers.some((id) => !qualifiedSet.has(id))) {
        throw new Error(
            "Only the 16 qualified players can participate in the quarterfinals."
        );
    }

    if (qualifiedIds.some((id) => !assignedPlayers.includes(id))) {
        throw new Error(
            "The quarterfinal draw is missing a qualified player."
        );
    }

    // Save the eight fixed knockout partnerships.
    const fixedTeams = normalized.flatMap(
        (match) => match.teams.map((team) => [...team])
    );

    // Commit all assignments together after validation.
    tournament.qualification.teams = fixedTeams.map(
        (ids, index) => ({
            seed: index + 1,
            ids,
            name: teamLabel(ids),
            origin: "COACH DRAW",
        })
    );

    tournament.qualification.drawConfirmed = true;
    tournament.qualification.drawConfirmedAt = Date.now();

    tournament.bracket.quarterfinals = normalized;

    // This uses the coach's actual court assignments.
    loadCourts(bracketCourts(normalized));
}



function matchWinner(match) {
    if (!match?.final || match.winner === null) {
        throw new Error("The previous match is not complete.");
    }

    return match.teams[match.winner];
}

function matchLoser(match) {
    if (!match?.final || match.winner === null) {
        throw new Error("The previous match is not complete.");
    }

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

/* ==========================================
   RESULT RECORDING
========================================== */

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
            throw new Error("Knockout bracket match not found.");
        }

        match.points = [...result.points];
        match.winner = result.winner;
        match.final = true;
    }
}

function revertResult(court) {
    const resultIndex = tournament.results.findLastIndex(
        (result) =>
            result.courtId === court.id &&
            result.stage === tournament.stage &&
            result.slotIndex === tournament.slotIndex &&
            result.group === tournament.group
    );

    if (resultIndex >= 0) {
        tournament.results.splice(resultIndex, 1);
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
        const lastSlot =
            GROUP_ROUNDS * GROUPS.length - 1;

        if (tournament.slotIndex < lastSlot) {
            advanceAmericanoGroup(tournament.group);
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
        tournament.timer = newTimer();
    }
}

function canAdvance() {
    if (tournament.phase !== "live") return false;

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
        !active.length ||
        !active.every((court) => court.final)
    ) {
        return false;
    }

    // Group matches wait for the 10-minute timer.
    if (isGroupStage()) {
        return (
            tournament.timer.startedAt !== null &&
            tournament.timer.endsAt !== null &&
            Date.now() >= tournament.timer.endsAt
        );
    }

    // Knockout matches have no timer.
    return true;
}

/* ==========================================
   SOCKET SECURITY AND EVENTS
========================================== */

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

function checkMatchKey(key) {
    if (key !== matchKey()) {
        throw new Error(
            "The tournament stage changed. Refresh this screen."
        );
    }
}

function protectedEvent(socket, io, name, handler) {
    socket.on(name, (payload = {}, ack) => {
        try {
            if (!checkAuth(payload.token)) {
                return fail(ack, "Unauthorized. Log in again.");
            }

            handler(payload);
            persist();
            emitState(io);
            succeed(ack);
        } catch (error) {
            fail(
                ack,
                error.message || "Operation could not be completed."
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
                        "Player editing is locked after the tournament begins."
                    );
                }

                const player = findPlayer(playerId);

                if (!player) {
                    throw new Error("Player not found.");
                }

                const clean = String(name || "")
                    .trim()
                    .replace(/\s+/g, " ");

                if (!clean || clean.length > 80) {
                    throw new Error(
                        "Enter a player name of 1–80 characters."
                    );
                }

                const duplicate = tournament.groups[player.group]
                    .players.some(
                        (item) =>
                            item.id !== playerId &&
                            item.name.toLowerCase() === clean.toLowerCase()
                    );

                if (duplicate) {
                    throw new Error(
                        "That name is already assigned within this group."
                    );
                }

                player.name = clean;
            }
        );

        protectedEvent(
            socket,
            io,
            "court:assign",
            ({ group, courtId, team, slot, playerId }) => {
                if (tournament.phase !== "setup") {
                    throw new Error(
                        "Assignments are locked after tournament start."
                    );
                }

                if (!GROUPS.includes(group)) {
                    throw new Error("Invalid group.");
                }

                const courts = tournament.groups[group].courts;
                const court = courts.find(
                    (item) => item.id === Number(courtId)
                );

                if (
                    !court ||
                    ![0, 1].includes(team) ||
                    ![0, 1].includes(slot)
                ) {
                    throw new Error("Invalid court or team slot.");
                }

                if (
                    playerId &&
                    !tournament.groups[group].players.some(
                        (player) => player.id === playerId
                    )
                ) {
                    throw new Error(
                        "Player is not part of the selected group."
                    );
                }

                // Move the player from their previous assigned slot.
                if (playerId) {
                    for (const item of courts) {
                        for (const pair of item.teams) {
                            for (let i = 0; i < 2; i++) {
                                if (pair[i] === playerId) {
                                    pair[i] = null;
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
                    throw new Error(
                        "The tournament has already started."
                    );
                }

                validateAssignments();

                tournament.phase = "live";
                tournament.startedAt = Date.now();

                // Group A appears, timer paused until coach starts.
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
                        "Only group-stage matches use a timer."
                    );
                }

                checkMatchKey(key);

                if (tournament.timer.startedAt !== null) {
                    throw new Error(
                        "The current timer has already been started."
                    );
                }

                if (
                    tournament.courts.some(
                        (court) => court.active && court.final
                    )
                ) {
                    throw new Error(
                        "A result has already been confirmed."
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
            "score:point",
            ({ courtId, team, matchKey: key }) => {
                if (tournament.phase !== "live") {
                    throw new Error("Tournament is not live.");
                }

                checkMatchKey(key);

                if (
                    isGroupStage() &&
                    tournament.timer.startedAt === null
                ) {
                    throw new Error(
                        "The coach has not started this round."
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
                        "Scoring is unavailable for this court."
                    );
                }

                if (!isGroupStage()) {
                    if (
                        court.score.points.some(
                            (points) => points >= KNOCKOUT_TARGET
                        )
                    ) {
                        throw new Error(
                            "A team has reached 10. Confirm the final result."
                        );
                    }
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
                    throw new Error("Tournament is not live.");
                }

                checkMatchKey(key);

                const court = tournament.courts.find(
                    (item) => item.id === Number(courtId)
                );

                if (
                    !court?.active ||
                    court.final ||
                    !court.history.length
                ) {
                    throw new Error(
                        "No score change available to undo."
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
                    throw new Error("Tournament is not live.");
                }

                checkMatchKey(key);

                if (
                    isGroupStage() &&
                    tournament.timer.startedAt === null
                ) {
                    throw new Error(
                        "The group round has not started."
                    );
                }

                const court = tournament.courts.find(
                    (item) => item.id === Number(courtId)
                );

                if (!court?.active || court.final) {
                    throw new Error(
                        "The court is unavailable or already final."
                    );
                }

                const [a, b] = court.score.points;

                if (isGroupStage()) {
                    if (a === b) {
                        throw new Error(
                            "A group match cannot finish tied. " +
                            "Award one deciding point."
                        );
                    }
                } else {
                    if (
                        Math.max(a, b) !== KNOCKOUT_TARGET ||
                        Math.min(a, b) >= KNOCKOUT_TARGET
                    ) {
                        throw new Error(
                            "Knockout matches finish when the first " +
                            "team reaches exactly 10 points."
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
                    throw new Error("Tournament is not live.");
                }

                checkMatchKey(key);

                const court = tournament.courts.find(
                    (item) => item.id === Number(courtId)
                );

                if (!court?.active || !court.final) {
                    throw new Error(
                        "There is no confirmed result to reopen."
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


        protectedEvent(
            socket,
            io,
            "knockout:draw:confirm",
            ({ matches }) => {
                confirmQuarterfinalDraw(matches);
            }
        );

    });

    // Group stages advance after time + confirmations.
    // Knockouts advance after all results are confirmed.
    // All changes are broadcast to every spectator screen.
    setInterval(() => {
        if (!canAdvance()) return;

        try {
            advanceStage();
            persist();
            emitState(io);
        } catch (error) {
            console.error(
                "Tournament advancement error:",
                error
            );
        }
    }, 500);

    httpServer.listen(port, "0.0.0.0", () => {
        console.log(
            `Tournament running on port ${port}`
        );
        console.log(
            `State file: ${STATE_FILE}`
        );
    });
});
