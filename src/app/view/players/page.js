
"use client";

import { useEffect, useMemo, useState } from "react";
import useTournament from "@/lib/useTournament";

import {
    BroadcastHeader,
    BroadcastStyles,
    Partners,
    CourtScoreboard,
} from "@/app/components/TournamentBroadcast";

/* ==========================================
   CONFIGURATION
========================================== */

const DISPLAY_DURATION = 15000;

const GROUP_ORDER = ["A", "B", "C"];

const DISPLAY_MODES = {
    RANKINGS: "rankings",
    NEXT: "next",
};

/* ==========================================
   PLAYER RANKING LOGIC
========================================== */

function comparePlayers(a, b) {
    return (
        (b.wins || 0) - (a.wins || 0) ||
        (b.differential || 0) - (a.differential || 0) ||
        (b.pointsFor || 0) - (a.pointsFor || 0) ||
        a.id.localeCompare(b.id)
    );
}

/* ==========================================
   NEXT ROUND PREVIEW

   Reads existing tournament state.

   Examples:
   A Round 1 -> B Round 1
   B Round 1 -> C Round 1
   C Round 1 -> A Round 2
   A Round 2 -> B Round 2

   These are the group's saved court
   assignments, not the currently
   displayed courts.
========================================== */

function getNextRoundPreview(state) {
    if (!state) return null;

    if (
        state.phase === "setup" ||
        state.phase === "complete"
    ) {
        return null;
    }

    if (state.stage === "groups") {
        const currentIndex = Number(state.slotIndex ?? 0);
        const nextIndex = currentIndex + 1;

        // Four rounds × three groups = 12 slots.
        if (nextIndex >= 12) {
            return {
                type: "pending",
                title: "QUARTERFINALS",
                subtitle: "UP NEXT",
                description:
                    "The qualifying players and knockout teams will " +
                    "be announced after the final group results.",
                courts: [],
            };
        }

        const nextGroup = GROUP_ORDER[nextIndex % 3];
        const nextRound = Math.floor(nextIndex / 3) + 1;

        const groupData = state.groups?.[nextGroup];

        if (!groupData?.courts) {
            return null;
        }

        return {
            type: "group",
            title: `GROUP ${nextGroup}`,
            subtitle: `ROUND ${nextRound}`,
            description:
                "Upcoming court and player assignments",
            group: nextGroup,
            round: nextRound,
            courts: groupData.courts
                .map((court) => ({
                    ...court,
                    active: true,
                    final: false,
                    score: {
                        points: [0, 0],
                        games: [0, 0],
                        finished: false,
                        winner: null,
                    },
                }))
                .sort((a, b) => a.id - b.id),
        };
    }

    /* ========================================
       KNOCKOUT PREVIEW
  
       Next-round players cannot be known
       until their previous match is final.
  
       Display the upcoming stage without
       inventing player assignments.
    ======================================== */

    if (state.stage === "quarterfinals") {
        return {
            type: "pending",
            title: "SEMIFINALS",
            subtitle: "UP NEXT",
            description:
                "The winners of QF1 and QF2 will play in SF1. " +
                "The winners of QF3 and QF4 will play in SF2.",
            courts: [],
        };
    }

    if (state.stage === "semifinals") {
        return {
            type: "pending",
            title: "FINAL & BRONZE",
            subtitle: "UP NEXT",
            description:
                "The semifinal winners advance to the final. " +
                "The losing teams compete for bronze.",
            courts: [],
        };
    }

    if (state.stage === "finals") {
        return {
            type: "pending",
            title: "TOURNAMENT RESULTS",
            subtitle: "UP NEXT",
            description:
                "Final placements will be confirmed after " +
                "the championship and bronze matches.",
            courts: [],
        };
    }

    return null;
}

/* ==========================================
   PLAYER RANKINGS SCREEN
========================================== */


function RankingsScreen({ players }) {
    const half = Math.ceil(players.length / 2);

    const columns = [
        players.slice(0, half),
        players.slice(half),
    ];

    return (
        <section
            className="rankings-content"
            aria-label="Live player rankings"
        >

            <div className="nt-leader-grid">
                {columns.map((column, columnIndex) => (
                    <div
                        className="nt-leader-col"
                        key={columnIndex}
                    >
                        <div className="nt-leader-row nt-leader-header">
                            <span>#</span>
                            <span>PLAYER</span>
                            <span>W</span>
                            <span>L</span>
                        </div>

                        {column.map((player, index) => (
                            <div
                                className="nt-leader-row"
                                key={player.id}
                            >
                                <span className="nt-rank">
                                    {String(
                                        columnIndex * half + index + 1
                                    ).padStart(2, "0")}
                                </span>

                                <strong>{player.name}</strong>

                                <span className="nt-stat">
                                    {player.wins ?? 0}
                                </span>

                                <span className="nt-stat">
                                    {player.losses ?? 0}
                                </span>
                            </div>
                        ))}
                    </div>
                ))}
            </div>

            <p className="rankings-footnote">
                W = WINS · L = LOSSES
            </p>
        </section>
    );
}

/* ==========================================
   NEXT ROUND SPECTATOR SCREEN
========================================== */

function NextRoundScreen({
    preview,
    players,
}) {
    if (!preview) {
        return (
            <section className="nt-empty">
                <h2>UPCOMING MATCHES</h2>
                <p>
                    Waiting for the tournament to begin.
                </p>
            </section>
        );
    }

    return (
        <section
            className="next-round-content"
            aria-label="Upcoming court assignments"
        >
            <div className="next-round-heading">
                <div>
                    <span className="next-round-eyebrow">
                        UP NEXT
                    </span>

                    <h2>{preview.title}</h2>

                    <p>
                        {preview.subtitle}
                        {" · "}
                        {preview.description}
                    </p>
                </div>

                {preview.type === "group" && (
                    <div className="next-round-indicator">
                        <span>NEXT ROUND</span>
                        <strong>
                            {String(preview.round).padStart(2, "0")}
                        </strong>
                    </div>
                )}
            </div>

            {preview.type === "group" ? (
                <div className="nt-courts-grid">
                    {preview.courts.map((court) => (
                        <CourtScoreboard
                            key={`preview-${preview.group}-${preview.round}-${court.id}`}
                            court={court}
                            players={players}
                        />
                    ))}
                </div>
            ) : (
                <div className="next-round-pending">
                    <span className="next-round-eyebrow">
                        NEXT STAGE
                    </span>

                    <h3>{preview.title}</h3>

                    <p>{preview.description}</p>

                    <span className="next-round-pending-note">
                        PLAYER ASSIGNMENTS PENDING
                    </span>
                </div>
            )}
        </section>
    );
}

/* ==========================================
   MAIN PAGE
========================================== */

export default function PlayerRankingsPage() {
    const { state, connected } = useTournament();

    const [displayMode, setDisplayMode] = useState(
        DISPLAY_MODES.RANKINGS
    );


    /* ========================================
       AUTOMATIC SCREEN ROTATION
  
       One timer every 15 seconds.
  
       No expensive interval or state
       recalculation every second.
  
       The interval is restarted only when
       the tournament stage changes.
    ======================================== */

    const matchKey = state?.matchKey;

    useEffect(() => {
        // Show rankings at the start of a new stage.
        setDisplayMode(DISPLAY_MODES.RANKINGS);

        const interval = window.setInterval(() => {
            setDisplayMode((current) =>
                current === DISPLAY_MODES.RANKINGS
                    ? DISPLAY_MODES.NEXT
                    : DISPLAY_MODES.RANKINGS
            );
        }, DISPLAY_DURATION);

        return () => {
            window.clearInterval(interval);
        };
    }, [matchKey]);

    /* ========================================
       FILTER PLAYER DATA
  
       Recomputed only when tournament data
       or selected group changes.
    ======================================== */

    const activeGroup =
        state?.stage === "groups"
            ? state.group
            : null;

    const players = useMemo(() => {
        const roster = state?.players || [];

        return roster
            .filter((player) =>
                activeGroup
                    ? player.group === activeGroup
                    : false
            )
            .sort(comparePlayers);
    }, [state?.players, activeGroup]);

    /* ========================================
       BUILD NEXT ROUND DATA
  
       Derived from the live Socket.IO state.
    ======================================== */

    const nextPreview = useMemo(() => {
        return getNextRoundPreview(state);
    }, [state]);

    const isRankings =
        displayMode === DISPLAY_MODES.RANKINGS;

    if (!state) {
        return (
            <main
                style={{
                    minHeight: "100vh",
                    background: "#446463",
                    color: "#e4e2db",
                    padding: 30,
                    fontFamily:
                        '"Helvetica Neue LT Pro", Helvetica, Arial, sans-serif',
                }}
            >
                Connecting to live tournament data...
            </main>
        );
    }

    return (
        <main className="new-tourney">
            <BroadcastStyles />

            <style>{`
        /* ==================================
           EXISTING RANKINGS DESIGN
        ================================== */

        .rankings-view .nt-leader-header {
          background: rgba(0,0,0,.13);
          color: #D5DCDC;
          font-size: 10px;
          font-weight: 500;
          letter-spacing: .05em;
        }

        .rankings-view .nt-leader-col {
          background: linear-gradient(
            155deg,
            rgba(85,114,114,.5),
            rgba(57,89,88,.6)
          );

          border-top: 2px solid
            rgba(212,183,120,.45);
        }

        .rankings-view .nt-rating {
          display: inline-flex;
          align-items: center;
          justify-content: center;

          min-height: 34px;
          border: 1px solid
            rgba(212,183,120,.38);

          background: rgba(212,183,120,.05);
        }

        .rankings-view .nt-leader-row {
          min-height: 58px;
        }

        .rankings-view
        .nt-leader-row > strong {
          color: #e4e2db;
        }

        .rankings-footnote {
          margin-top: 17px;
          font-size: 11px;
          color: #D5DCDC;
          letter-spacing: .05em;
          text-align: right;
        }

        /* ==================================
           SCREEN TRANSITION

           Both views stay mounted.

           Only opacity and visibility
           change, avoiding unnecessary
           component mounting.
        ================================== */

        .rankings-view .broadcast-rotation {
          display: grid;
          grid-template-columns: minmax(0,1fr);
          align-items: start;
          width: 100%;
        }

        .rankings-view .rotation-panel {
          grid-area: 1 / 1;
          min-width: 0;

          opacity: 0;
          visibility: hidden;
          pointer-events: none;

          transition:
            opacity 350ms ease,
            visibility 0s linear 350ms;
        }

        .rankings-view .rotation-panel.active {
          opacity: 1;
          visibility: visible;
          pointer-events: auto;

          transition:
            opacity 350ms ease,
            visibility 0s linear 0s;
        }

        /* ==================================
           UP NEXT HEADING
        ================================== */

        .rankings-view .next-round-heading {
          display: flex;
          align-items: center;
          justify-content: space-between;

          gap: 20px;
          margin: 7px 0 22px;

          padding: 18px 22px;

          border-left: 3px solid #d4b778;

          background: linear-gradient(
            120deg,
            rgba(212,183,120,.13),
            rgba(85,114,114,.12)
          );
        }

        .rankings-view .next-round-eyebrow {
          display: block;

          color: #e2cfa5;
          font-family:
            "Helvetica Neue LT Pro",
            Helvetica, Arial, sans-serif;

          font-size: 11px;
          font-weight: 500;
          letter-spacing: .05em;

          margin-bottom: 9px;
        }

        .rankings-view .next-round-heading h2 {
          margin: 0;

          color: #e4e2db;

          font-family:
            "Helvetica Neue LT Pro",
            Helvetica, Arial, sans-serif;

          font-size: clamp(34px,3.5vw,55px);
          font-weight: 500;
          line-height: 1.1;
          letter-spacing: .05em;
        }

        .rankings-view .next-round-heading p {
          margin: 9px 0 0;

          color: #D5DCDC;

          font-family:
            "JHA Times Now",
            Georgia, serif;

          font-style: italic;
          font-size: 15px;
          line-height: 1.4;
        }

        .rankings-view .next-round-indicator {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;

          min-width: 120px;
          gap: 6px;
        }

        .rankings-view .next-round-indicator span {
          font-size: 10px;
          font-weight: 500;
          color: #D5DCDC;
          letter-spacing: .05em;
          white-space: nowrap;
        }

        .rankings-view .next-round-indicator strong {
          color: #e2cfa5;
          font-size: 43px;
          font-weight: 500;
          line-height: 1;
          font-variant-numeric: tabular-nums;
        }

        /* ==================================
           UPCOMING COURT CARDS

           Reuse spectator scoreboard
           components and styling.
        ================================== */

        .rankings-view .next-round-content
        .nt-courts-grid {
          grid-template-columns:
            repeat(3,minmax(0,1fr));

          gap: 13px;
        }

        .rankings-view .next-round-content
        .nt-court {
          background: linear-gradient(
            155deg,
            #557272,
            #446463 48%,
            #395958
          );
        }

        .rankings-view .next-round-content
        .nt-court-top {
          padding: 13px 15px;
        }

        .rankings-view .next-round-content
        .nt-score-team {
          min-height: 108px;
        }

        /* ==================================
           PENDING KNOCKOUT PREVIEW
        ================================== */

        .rankings-view .next-round-pending {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;

          min-height: 420px;

          padding: 30px;
          text-align: center;

          background: linear-gradient(
            150deg,
            #557272,
            #446463 50%,
            #395958
          );

          border: 1px solid
            rgba(213,220,220,.3);

          border-top: 2px solid
            rgba(212,183,120,.45);
        }

        .rankings-view .next-round-pending h3 {
          margin: 5px 0 15px;

          font-size: clamp(31px,4vw,53px);
          font-weight: 500;
          letter-spacing: .05em;
        }

        .rankings-view .next-round-pending p {
          max-width: 650px;

          color: #D5DCDC;

          font-family:
            "JHA Times Now",
            Georgia, serif;

          font-size: 17px;
          font-style: italic;
          line-height: 1.55;
        }

        .rankings-view
        .next-round-pending-note {
          margin-top: 23px;
          padding: 10px 16px;

          border: 1px solid
            rgba(212,183,120,.38);

          color: #e2cfa5;

          font-size: 11px;
          font-weight: 500;
          letter-spacing: .05em;
        }

        /* ==================================
           LARGE BROADCAST SCREENS
        ================================== */

        @media (min-width:1600px) {
          .rankings-view .nt-leader-row {
            min-height: 64px;
          }

          .rankings-view
          .nt-leader-row > strong {
            font-size: 28px;
          }

          .rankings-view .next-round-content
          .nt-score-names strong {
            font-size: clamp(27px,2vw,37px);
          }
        }

        /* ==================================
           TABLETS
        ================================== */

        @media (max-width:1100px) {
          .rankings-view .next-round-content
          .nt-courts-grid {
            grid-template-columns:
              repeat(2,minmax(0,1fr));
          }

          .rankings-view .next-round-heading {
            padding: 16px 18px;
          }
        }

        /* ==================================
           MOBILE
        ================================== */

        @media (max-width:700px) {
          .rankings-view .nt-leader-row {
            min-height: 55px;
          }

          .rankings-view
          .nt-leader-row > strong {
            font-size: 18px;
          }

          .rankings-view .next-round-content
          .nt-courts-grid {
            grid-template-columns: 1fr;
          }

          .rankings-view .next-round-heading {
            flex-direction: column;
            align-items: flex-start;
            gap: 12px;

            padding: 15px;
          }

          .rankings-view .next-round-indicator {
            align-items: flex-start;
          }

          .rankings-view .next-round-indicator strong {
            font-size: 34px;
          }

          .rankings-view .next-round-pending {
            min-height: 300px;
          }
        }

        /* ==================================
           ACCESSIBILITY
        ================================== */

        @media (prefers-reduced-motion: reduce) {
          .rankings-view .rotation-panel,
          .rankings-view .rotation-panel.active {
            transition: none;
          }
        }

/* ==========================================
PLAYER RANKINGS — COLUMN ALIGNMENT
Rank | Player | Wins | Losses
========================================== */

.rankings-view .nt-leader-row {
display: grid;

grid-template-columns:
 42px
 minmax(0, 1fr)
 64px
 64px;

align-items: center;
column-gap: 10px;

width: 100%;
min-height: 58px;

padding: 8px 14px;
}

/* Header uses exactly the same grid */
.rankings-view .nt-leader-row.nt-leader-header {
grid-template-columns:
 42px
 minmax(0, 1fr)
 64px
 64px;

font-size: 11px;
font-weight: 500;
letter-spacing: 0.05em;
}

/* Rank column */
.rankings-view .nt-leader-row > :nth-child(1) {
text-align: center;
justify-self: center;
}

/* Player name column */
.rankings-view .nt-leader-row > :nth-child(2) {
min-width: 0;
text-align: left;
justify-self: stretch;
}

/* Wins column */
.rankings-view .nt-leader-row > :nth-child(3) {
width: 100%;
text-align: center;
justify-self: center;
}

/* Losses column */
.rankings-view .nt-leader-row > :nth-child(4) {
width: 100%;
text-align: center;
justify-self: center;
}

/* Keep numeric values vertically centered */
.rankings-view .nt-stat {
display: flex;
align-items: center;
justify-content: center;

font-variant-numeric: tabular-nums;
font-feature-settings: "tnum" 1;
}

/* ==========================================
LARGE SCREENS
========================================== */

@media (min-width: 1600px) {
.rankings-view .nt-leader-row,
.rankings-view .nt-leader-row.nt-leader-header {
 grid-template-columns:
   48px
   minmax(0, 1fr)
   75px
   75px;

 column-gap: 12px;
}
}

/* ==========================================
TABLETS
========================================== */

@media (max-width: 1100px) {
.rankings-view .nt-leader-row,
.rankings-view .nt-leader-row.nt-leader-header {
 grid-template-columns:
   34px
   minmax(0, 1fr)
   48px
   48px;

 column-gap: 8px;
 padding: 8px 10px;
}
}

/* ==========================================
MOBILE
========================================== */

@media (max-width: 700px) {
.rankings-view .nt-leader-row,
.rankings-view .nt-leader-row.nt-leader-header {
 grid-template-columns:
   28px
   minmax(0, 1fr)
   38px
   38px;

 column-gap: 6px;
 padding: 8px;
}

.rankings-view .nt-leader-row > strong {
 font-size: 18px;
}

.rankings-view .nt-stat {
 font-size: 17px;
}
}

    `}</style>

            <div className="nt-container rankings-view">
                {/* Shared tournament header */}
                <BroadcastHeader
                    state={state}
                    connected={connected}
                />

                {/* Main title and partner logos */}
                <section className="nt-section-head">
                    <div>
                        <h2>
                            {isRankings
                                ? activeGroup
                                    ? `Group ${activeGroup} Rankings`
                                    : "Player Rankings"
                                : "Upcoming Matches"}
                        </h2>

                        <p>
                            {isRankings
                                ? activeGroup
                                    ? `Round ${state.round}`
                                    : "Group stage complete"
                                : "Next round"}
                        </p>
                    </div>

                    <Partners />
                </section>

                {/* Rotating display area */}
                <div className="broadcast-rotation">
                    {/* Player statistics screen */}
                    <div
                        className={`rotation-panel ${isRankings ? "active" : ""
                            }`}
                        aria-hidden={!isRankings}
                        inert={!isRankings}
                    >
                        <RankingsScreen players={players} />
                    </div>

                    {/* Upcoming spectator screen */}
                    <div
                        className={`rotation-panel ${!isRankings ? "active" : ""
                            }`}
                        aria-hidden={isRankings}
                        inert={isRankings}
                    >
                        <NextRoundScreen
                            preview={nextPreview}
                            players={state.players}
                        />
                    </div>
                </div>
            </div>
        </main>
    );
}
