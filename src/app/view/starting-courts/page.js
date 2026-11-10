
"use client";

import { useMemo, useState } from "react";

import useTournament, {
  playerName,
} from "@/lib/useTournament";

import {
  BroadcastStyles,
  Partners,
} from "@/app/components/TournamentBroadcast";

/* ==========================================
   STARTING TIMES
========================================== */

const GROUP_SCHEDULE = {
  A: {
    time: "6:00 PM",
    label: "GROUP A",
  },
  B: {
    time: "6:10 PM",
    label: "GROUP B",
  },
  C: {
    time: "6:20 PM",
    label: "GROUP C",
  },
};

const GROUPS = ["A", "B", "C"];

/* ==========================================
   STARTING COURT CARD

   Uses the existing spectator design,
   but removes live scores and the timer.
========================================== */

function StartingCourtCard({
  court,
  players,
  startTime,
}) {
  return (
    <article className="nt-court starting-court-card">
      <div className="nt-court-top">
        <h3>
          COURT {String(court.id).padStart(2, "0")}
        </h3>

        <span className="starting-court-time">
          {startTime}
        </span>
      </div>

      <div className="starting-court-content">
        {[0, 1].map((side) => (
          <div
            className="starting-court-team"
            key={side}
          >
            <span className="starting-team-label">
              TEAM {side + 1}
            </span>

            <div className="starting-player-names">
              {(court.teams?.[side] || []).map(
                (playerId, index) => (
                  <strong key={playerId || index}>
                    {playerName(players, playerId)}
                  </strong>
                )
              )}
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}

/* ==========================================
   MAIN PAGE
========================================== */

export default function StartingCourtsPage() {
  const { state, connected } = useTournament();

  const [selectedGroup, setSelectedGroup] =
    useState("A");

  const schedule = GROUP_SCHEDULE[selectedGroup];

  const courts = useMemo(() => {
    const saved = state?.startingCourts?.[selectedGroup];

    if (!Array.isArray(saved)) {
      return [];
    }

    return [...saved].sort(
      (a, b) => a.id - b.id
    );
  }, [state?.startingCourts, selectedGroup]);

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
        Connecting to starting court assignments...
      </main>
    );
  }

  return (
    <main className="new-tourney">
      <BroadcastStyles />

      <style>{`
        /* ==================================
           PAGE HEADER
        ================================== */

        .starting-page .starting-header-label {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 7px;
          text-align: right;
        }

        .starting-page .starting-header-label small {
          color: #D5DCDC;
          font-size: 10px;
          font-weight: 500;
          letter-spacing: .05em;
        }

        .starting-page .starting-header-label strong {
          color: #e2cfa5;
          font-size: clamp(18px, 2vw, 28px);
          font-weight: 500;
          letter-spacing: .05em;
        }

        /* ==================================
           GROUP NAVIGATION
        ================================== */

        .starting-page .starting-group-tabs {
          display: grid;
          grid-template-columns:
            repeat(3, minmax(0, 1fr));

          gap: 12px;
          margin: 23px 0 20px;
        }

        .starting-page .starting-group-tab {
          display: flex;
          align-items: center;
          justify-content: space-between;

          gap: 12px;
          min-width: 0;
          min-height: 80px;

          padding: 17px 21px;

          border: 1px solid
            rgba(213,220,220,.32);

          border-top: 2px solid
            rgba(213,220,220,.32);

          border-radius: 3px;

          background: rgba(213,220,220,.08);
          color: #e4e2db;

          font-family:
            "Helvetica Neue LT Pro",
            "Helvetica Neue",
            Helvetica,
            Arial,
            sans-serif;

          text-align: left;
          cursor: pointer;
          transition:
            background .2s ease,
            border-color .2s ease;
        }

        .starting-page .starting-group-tab:hover {
          background: rgba(213,220,220,.14);
        }

        .starting-page .starting-group-tab.selected {
          background: rgba(212,183,120,.15);
          border-color: #d4b778;
          border-top-color: #d4b778;
        }

        .starting-page .starting-group-tab span {
          font-size: clamp(20px,2vw,30px);
          font-weight: 500;
          line-height: 1.1;
        }

        .starting-page .starting-group-tab strong {
          color: #e2cfa5;
          font-size: clamp(18px,1.8vw,26px);
          font-weight: 500;
          white-space: nowrap;
        }

        /* ==================================
           SCHEDULE HEADING
        ================================== */

        .starting-page .starting-schedule {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;

          gap: 16px;
          margin: 23px 0;
          padding: 18px 23px;

          border-left: 3px solid #d4b778;

          background: linear-gradient(
            120deg,
            rgba(212,183,120,.13),
            rgba(85,114,114,.12)
          );
        }

        .starting-page .starting-schedule small {
          display: block;
          color: #D5DCDC;
          font-size: 11px;
          font-weight: 500;
          letter-spacing: .05em;
          margin-bottom: 8px;
        }

        .starting-page .starting-schedule h2 {
          margin: 0;

          color: #e4e2db;
          font-size: clamp(30px,3vw,49px);
          font-weight: 500;
          line-height: 1.1;
        }

        .starting-page .starting-schedule-time {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 5px;
        }

        .starting-page .starting-schedule-time strong {
          color: #e2cfa5;
          font-size: clamp(30px,3.3vw,50px);
          font-weight: 500;
          line-height: 1;
          white-space: nowrap;

          font-variant-numeric: tabular-nums;
        }

        /* ==================================
           COURT CARDS
        ================================== */

        .starting-page .starting-court-time {
          color: #e2cfa5;
          border: 1px solid
            rgba(212,183,120,.48);
          padding: 7px 11px;
          font-size: 14px;
          font-weight: 500;
          white-space: nowrap;
        }

        .starting-page .starting-court-content {
          padding: 0 17px;
        }

        .starting-page .starting-court-team {
          min-height: 128px;

          display: flex;
          flex-direction: column;
          justify-content: center;

          padding: 18px 0;
        }

        .starting-page .starting-court-team
        + .starting-court-team {
          border-top: 1px solid
            rgba(213,220,220,.25);
        }

        .starting-page .starting-team-label {
          display: block;
          margin-bottom: 12px;

          color: #D5DCDC;

          font-size: 11px;
          font-weight: 500;
          letter-spacing: .05em;
        }

        .starting-page .starting-player-names {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .starting-page .starting-player-names strong {
          color: #e4e2db;

          font-family:
            "Helvetica Neue LT Pro",
            "Helvetica Neue",
            Helvetica,
            Arial,
            sans-serif;

          font-size: clamp(24px,2.15vw,36px);
          font-weight: 700;
          line-height: 1.15;

          overflow-wrap: anywhere;
        }

        /* ==================================
           TABLET
        ================================== */

        @media (max-width:1100px) {
          .starting-page .starting-group-tab {
            padding: 15px;
            min-height: 70px;
          }

          .starting-page .starting-group-tab span {
            font-size: 21px;
          }

          .starting-page .starting-group-tab strong {
            font-size: 17px;
          }
        }

        /* ==================================
           MOBILE
        ================================== */

        @media (max-width:700px) {
          .starting-page .starting-group-tabs {
            grid-template-columns: 1fr;
            gap: 8px;
          }

          .starting-page .starting-group-tab {
            min-height: 56px;
          }

          .starting-page .starting-schedule {
            padding: 16px;
          }

          .starting-page .starting-schedule-time {
            align-items: flex-start;
          }

          .starting-page .starting-player-names strong {
            font-size: clamp(25px,6vw,34px);
          }

          .starting-page .starting-court-team {
            min-height: 108px;
          }

          .starting-page .starting-court-time {
            font-size: 12px;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .starting-page .starting-group-tab {
            transition: none;
          }
        }
      `}</style>

      <div className="nt-container starting-page">
        {/* ==================================
            BROADCAST HEADER
        ================================== */}

        <header className="nt-header">
          <div className="nt-brand">
            <img
              src="/ap-logo.png"
              alt="AP Tournament"
            />

            <div>
              <h1>POWERFUL SUMMER DUBAI</h1>
            </div>
          </div>

          <div className="nt-header-info">
            <div className="nt-connection">
              <span
                className={`nt-dot ${
                  connected ? "live" : ""
                }`}
              />

              {connected
                ? "COURT ASSIGNMENTS"
                : "RECONNECTING"}
            </div>

            <div className="starting-header-label">
              <small>STARTING SCHEDULE</small>
              <strong>6:00 PM — 6:20 PM</strong>
            </div>
          </div>
        </header>

        {/* ==================================
            TITLE AND PARTNERS
        ================================== */}

        <section className="nt-section-head">
          <div>
            <h2>Starting Courts</h2>

          </div>

          <Partners />
        </section>

        {/* ==================================
            GROUP NAVIGATION
        ================================== */}

        <nav
          className="starting-group-tabs"
          aria-label="Select starting group"
        >
          {GROUPS.map((group) => (
            <button
              key={group}
              type="button"
              className={`starting-group-tab ${
                selectedGroup === group
                  ? "selected"
                  : ""
              }`}
              onClick={() => setSelectedGroup(group)}
              aria-pressed={selectedGroup === group}
            >
              <span>GROUP {group}</span>

              <strong>
                {GROUP_SCHEDULE[group].time}
              </strong>
            </button>
          ))}
        </nav>

        {/* ==================================
            SELECTED GROUP START TIME
        ================================== */}

        <section className="starting-schedule">
          <div>
            <small>STARTING COURT ASSIGNMENTS</small>

            <h2>{schedule.label}</h2>
          </div>

          <div className="starting-schedule-time">
            <small>SCHEDULED START</small>
            <strong>{schedule.time}</strong>
          </div>
        </section>

        {/* ==================================
            SIX COURT ASSIGNMENTS
        ================================== */}

        {courts.length > 0 ? (
          <section
            className="nt-courts-grid"
            aria-label={`Group ${selectedGroup} starting courts`}
          >
            {courts.map((court) => (
              <StartingCourtCard
                key={`${selectedGroup}-${court.id}`}
                court={court}
                players={state.players}
                startTime={schedule.time}
              />
            ))}
          </section>
        ) : (
          <section className="nt-empty">
            <h2>STARTING ASSIGNMENTS UNAVAILABLE</h2>

            <p>
              The original Group {selectedGroup}
              assignments could not be recovered
              from the saved tournament state.
            </p>
          </section>
        )}
      </div>
    </main>
  );
}
