
"use client";

import useTournament, {
  playerName,
} from "@/lib/useTournament";

import {
  BroadcastStyles,
  Partners,
} from "@/app/components/TournamentBroadcast";

/* ==========================================
   STARTING GROUP SCHEDULE
========================================== */

const GROUP_ORDER = ["A", "B", "C"];

const GROUP_META = {
  A: {
    label: "GROUP A",
    time: "6:00 PM",
  },
  B: {
    label: "GROUP B",
    time: "6:10 PM",
  },
  C: {
    label: "GROUP C",
    time: "6:20 PM",
  },
};

/* ==========================================
   STARTING COURT CARD
========================================== */

function StartingCourtCard({
  court,
  players,
}) {
  return (
    <article className="sc-court-card">
      <div className="sc-court-header">
        <h4>
          COURT {String(court.id).padStart(2, "0")}
        </h4>
      </div>

      <div className="sc-court-body">
        {[0, 1].map((side) => (
          <div
            className="sc-team"
            key={side}
          >
            <span className="sc-team-label">
              TEAM {side + 1}
            </span>

            <div className="sc-player-names">
              {(court.teams?.[side] || []).map(
                (playerId, index) => (
                  <strong key={playerId || index}>
                    {playerName(
                      players,
                      playerId
                    )}
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
   GROUP PANEL
========================================== */

function StartingGroupPanel({
  groupKey,
  courts,
  players,
}) {
  const meta = GROUP_META[groupKey];

  const sortedCourts = Array.isArray(courts)
    ? [...courts].sort((a, b) => a.id - b.id)
    : [];

  return (
    <section className="sc-group-panel">
      {/* Group heading */}

      <header className="sc-group-header">
        <div className="sc-group-title">
          <span className="sc-eyebrow">
            STARTING COURT ASSIGNMENTS
          </span>

          <h3>{meta.label}</h3>
        </div>

        <div className="sc-group-time">
          <span className="sc-eyebrow">
            SCHEDULED START
          </span>

          <strong>{meta.time}</strong>
        </div>
      </header>

      {/* Six starting courts */}

      {sortedCourts.length > 0 ? (
        <div className="sc-courts-grid">
          {sortedCourts.map((court) => (
            <StartingCourtCard
              key={`${groupKey}-${court.id}`}
              court={court}
              players={players}
            />
          ))}
        </div>
      ) : (
        <div className="sc-empty">
          <h4>Assignments Unavailable</h4>

          <p>
            Group {groupKey} starting assignments
            have not been loaded.
          </p>
        </div>
      )}
    </section>
  );
}

/* ==========================================
   MAIN PAGE
========================================== */

export default function StartingCourtsPage() {
  const { state, connected } = useTournament();

  if (!state) {
    return (
      <main
        style={{
          minHeight: "100vh",
          background: "#446463",
          color: "#e4e2db",
          padding: 30,
          fontFamily:
            '"Helvetica Neue LT Pro", "Helvetica Neue", Helvetica, Arial, sans-serif',
        }}
      >
        Connecting to starting court assignments...
      </main>
    );
  }

  const startingCourts =
    state.startingCourts || {};

  return (
    <main className="new-tourney sc-page">
      <BroadcastStyles />

      <style>{`
        /* ==================================
           GLOBAL PAGE ALIGNMENT
        ================================== */

        .sc-page {
          font-family:
            "Helvetica Neue LT Pro",
            "Helvetica Neue",
            Helvetica,
            Arial,
            sans-serif;

          font-weight: 300;
          letter-spacing: 0;
        }

        .sc-page .nt-container {
          max-width: 1900px;

          padding:
            18px
            clamp(22px, 2.8vw, 55px)
            35px;
        }

        /* ==================================
           TOP BROADCAST HEADER
        ================================== */

        .sc-page .sc-header-meta {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 22px;
          flex-shrink: 0;
        }

        .sc-page .sc-header-schedule {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 5px;
          text-align: right;
        }

        .sc-page .sc-header-schedule small {
          color: #D5DCDC;

          font-size: 11px;
          font-weight: 500;
          letter-spacing: 0.05em;
        }

        .sc-page .sc-header-schedule strong {
          color: #e2cfa5;

          font-size: clamp(
            24px,
            2.2vw,
            37px
          );

          font-weight: 500;
          line-height: 1;
          letter-spacing: 0;

          white-space: nowrap;
          font-variant-numeric: tabular-nums;
        }

        /* ==================================
           PAGE TITLE

           Matches the main spectator page:
           .nt-section-head h2
        ================================== */

        .sc-page .nt-section-head {
          margin: 26px 0 30px;
          align-items: center;
          gap: 24px;
        }

        .sc-page .nt-section-head h2 {
          margin: 0;

          font-family:
            "Helvetica Neue LT Pro",
            "Helvetica Neue",
            Helvetica,
            Arial,
            sans-serif;

          font-size: clamp(
            30px,
            3vw,
            50px
          );

          font-weight: 500;
          line-height: 1.1;
          letter-spacing: 0;

          color: #e4e2db;
        }

        /* ==================================
           THREE-GROUP LAYOUT

           Each group receives exactly
           one-third of available width.
        ================================== */

        .sc-page .sc-groups-grid {
          display: grid;

          grid-template-columns:
            repeat(3, minmax(0, 1fr));

          align-items: stretch;

          gap: clamp(
            14px,
            1.3vw,
            25px
          );

          width: 100%;
          margin-top: 5px;
        }

        /* ==================================
           GROUP PANELS
        ================================== */

        .sc-page .sc-group-panel {
          display: flex;
          flex-direction: column;

          min-width: 0;
          height: 100%;

          border: 1px solid
            rgba(213, 220, 220, 0.35);

          border-top: 2px solid
            rgba(212, 183, 120, 0.48);

          border-radius: 4px;

          background: linear-gradient(
            155deg,
            rgba(85, 114, 114, 0.34),
            rgba(57, 89, 88, 0.55)
          );

          overflow: hidden;
        }

        /* ==================================
           GROUP HEADER

           Fixed layout ensures the
           scheduled time does not push
           or compress the group name.
        ================================== */

        .sc-page .sc-group-header {
          display: grid;

          grid-template-columns:
            minmax(0, 1fr) auto;

          align-items: end;

          gap: 12px;

          padding:
            clamp(16px, 1.5vw, 25px)
            clamp(15px, 1.4vw, 24px);

          min-height: 110px;

          border-bottom: 1px solid
            rgba(213, 220, 220, 0.24);
        }

        .sc-page .sc-group-title {
          min-width: 0;
        }

        .sc-page .sc-eyebrow {
          display: block;

          color: #D5DCDC;

          font-size: clamp(
            9px,
            0.65vw,
            11px
          );

          font-weight: 500;
          line-height: 1.3;
          letter-spacing: 0.05em;

          white-space: nowrap;

          margin-bottom: 10px;
        }

        .sc-page .sc-group-title h3 {
          margin: 0;

          font-family:
            "Helvetica Neue LT Pro",
            "Helvetica Neue",
            Helvetica,
            Arial,
            sans-serif;

          color: #e4e2db;

          font-size: clamp(
            27px,
            2.1vw,
            43px
          );

          font-weight: 500;
          line-height: 1;
          letter-spacing: 0.02em;

          white-space: nowrap;
        }

        .sc-page .sc-group-time {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          justify-content: flex-end;

          min-width: 0;

          text-align: right;
        }

        .sc-page .sc-group-time strong {
          display: block;

          color: #e2cfa5;

          font-size: clamp(
            26px,
            2.1vw,
            43px
          );

          font-weight: 500;
          line-height: 1;
          letter-spacing: 0;

          white-space: nowrap;
          font-variant-numeric: tabular-nums;
        }

        /* ==================================
           COURT GRID

           Identical layout for A, B, C.
           Three rows, two columns.
        ================================== */

        .sc-page .sc-courts-grid {
          display: grid;

          grid-template-columns:
            repeat(2, minmax(0, 1fr));

          grid-template-rows:
            repeat(3, minmax(0, 1fr));

          gap: 8px;

          flex: 1;

          padding: 10px;

          min-width: 0;
        }

        /* ==================================
           INDIVIDUAL COURT
        ================================== */

        .sc-page .sc-court-card {
          display: flex;
          flex-direction: column;

          min-width: 0;
          min-height: 0;

          border: 1px solid
            rgba(213, 220, 220, 0.29);

          border-radius: 3px;

          background: linear-gradient(
            155deg,
            rgba(68, 100, 99, 0.44),
            rgba(57, 89, 88, 0.42)
          );

          overflow: hidden;
        }

        .sc-page .sc-court-header {
          display: flex;
          align-items: center;

          min-height: 47px;

          padding: 10px 14px;

          border-bottom: 1px solid
            rgba(213, 220, 220, 0.22);

        }

        .sc-page .sc-court-header h4 {
          margin: 0;


          font-size: clamp(
            19px,
            1.35vw,
            27px
          );

          font-weight: 500;
          line-height: 1.1;
          letter-spacing: 0.02em;

          white-space: nowrap;

          color: var(--gold);
        }

        /* ==================================
           TEAM SECTIONS

           Both teams receive the same
           minimum height and spacing.
        ================================== */

        .sc-page .sc-court-body {
          display: grid;

          grid-template-rows:
            repeat(2, minmax(0, 1fr));

          flex: 1;

          padding: 0 14px;
        }

        .sc-page .sc-team {
          display: flex;
          flex-direction: column;
          justify-content: center;

          min-width: 0;
          min-height: 105px;

          padding: 13px 0;
        }

        .sc-page .sc-team + .sc-team {
          border-top: 1px solid
            rgba(213, 220, 220, 0.23);
        }

        .sc-page .sc-team-label {
          display: block;

          color: #D5DCDC;

          font-size: 10px;
          font-weight: 500;
          line-height: 1.2;
          letter-spacing: 0.05em;

          margin-bottom: 9px;
        }

        .sc-page .sc-player-names {
          display: flex;
          flex-direction: column;

          gap: 4px;
          min-width: 0;
        }

        .sc-page .sc-player-names strong {
          display: block;

          color: #e4e2db;

          font-family:
            "Helvetica Neue LT Pro",
            "Helvetica Neue",
            Helvetica,
            Arial,
            sans-serif;

          font-size: clamp(
            19px,
            1.45vw,
            30px
          );

          font-weight: 700;
          line-height: 1.12;
          letter-spacing: 0;

          overflow-wrap: anywhere;
        }

        /* ==================================
           EMPTY ASSIGNMENTS
        ================================== */

        .sc-page .sc-empty {
          padding: 38px 20px;
          text-align: center;
        }

        .sc-page .sc-empty h4 {
          margin: 0 0 12px;

          font-size: 19px;
          font-weight: 500;
        }

        .sc-page .sc-empty p {
          margin: 0;
          color: #D5DCDC;
          line-height: 1.5;
        }

        /* ==================================
           LARGE SPECTATOR SCREENS
        ================================== */

        @media (min-width: 1800px) {
          .sc-page .sc-groups-grid {
            gap: 24px;
          }

          .sc-page .sc-courts-grid {
            gap: 11px;
            padding: 12px;
          }

          .sc-page .sc-group-header {
            padding: 25px;
          }

          .sc-page .sc-team {
            min-height: 118px;
          }

          .sc-page .sc-court-header {
            padding: 13px 16px;
          }

          .sc-page .sc-court-body {
            padding: 0 16px;
          }
        }

        /* ==================================
           MEDIUM SCREENS

           Keep three group columns.
        ================================== */

        @media (
          min-width: 1101px
        ) and (
          max-width: 1450px
        ) {
          .sc-page .sc-groups-grid {
            gap: 12px;
          }

          .sc-page .sc-group-header {
            padding: 15px 13px;
            gap: 8px;
          }

          .sc-page .sc-eyebrow {
            font-size: 9px;
          }

          .sc-page .sc-group-title h3 {
            font-size: clamp(
              25px,
              2vw,
              32px
            );
          }

          .sc-page .sc-group-time strong {
            font-size: clamp(
              24px,
              2vw,
              32px
            );
          }

          .sc-page .sc-courts-grid {
            gap: 6px;
            padding: 7px;
          }

          .sc-page .sc-court-header {
            padding: 9px 11px;
          }

          .sc-page .sc-court-header h4 {
            font-size: 19px;
          }

          .sc-page .sc-court-body {
            padding: 0 11px;
          }

          .sc-page .sc-player-names strong {
            font-size: clamp(
              17px,
              1.35vw,
              20px
            );
          }
        }

        /* ==================================
           TABLET

           Stack group panels to preserve
           readable player names.
        ================================== */

        @media (max-width: 1100px) {
          .sc-page .sc-groups-grid {
            grid-template-columns: 1fr;
            gap: 20px;
          }

          .sc-page .sc-group-header {
            min-height: 100px;
          }

          .sc-page .sc-group-title h3 {
            font-size: 36px;
          }

          .sc-page .sc-group-time strong {
            font-size: 36px;
          }

          .sc-page .sc-player-names strong {
            font-size: clamp(
              23px,
              3vw,
              30px
            );
          }

          .sc-page .sc-team {
            min-height: 100px;
          }
        }

        /* ==================================
           MOBILE
        ================================== */

        @media (max-width: 700px) {
          .sc-page .nt-container {
            padding: 14px 13px 30px;
          }

          .sc-page .sc-header-meta {
            width: 100%;
            flex-wrap: wrap;
            justify-content: space-between;
          }

          .sc-page .sc-header-schedule {
            align-items: flex-start;
            text-align: left;
          }

          .sc-page .nt-section-head {
            margin: 25px 0;
          }

          .sc-page .sc-group-header {
            min-height: 0;
            padding: 18px 15px;
          }

          .sc-page .sc-group-title h3 {
            font-size: 27px;
          }

          .sc-page .sc-group-time strong {
            font-size: 27px;
          }

          .sc-page .sc-eyebrow {
            font-size: 9px;
          }

          .sc-page .sc-courts-grid {
            grid-template-columns: 1fr;
            grid-template-rows: auto;

            gap: 9px;
            padding: 9px;
          }

          .sc-page .sc-court-header h4 {
            font-size: 24px;
          }

          .sc-page .sc-court-body {
            padding: 0 15px;
          }

          .sc-page .sc-team {
            min-height: 95px;
          }

          .sc-page .sc-player-names strong {
            font-size: clamp(
              24px,
              6vw,
              31px
            );
          }
        }

        /* ==================================
           SMALL MOBILE SCREENS
        ================================== */

        @media (max-width: 390px) {
          .sc-page .sc-group-header {
            gap: 8px;
          }

          .sc-page .sc-group-title h3 {
            font-size: 24px;
          }

          .sc-page .sc-group-time strong {
            font-size: 24px;
          }

          .sc-page .sc-eyebrow {
            font-size: 8px;
          }
        }
      `}</style>

      <div className="nt-container">

        {/* ==================================
            AP BRAND HEADER
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

          <div className="sc-header-meta">
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

            <div className="sc-header-schedule">
              <small>
                STARTING SCHEDULE
              </small>

              <strong>
                6:00 PM — 6:20 PM
              </strong>
            </div>
          </div>
        </header>

        {/* ==================================
            STARTING COURTS HEADING
        ================================== */}

        <section className="nt-section-head">
          <div>
            <h2>Starting Courts</h2>
          </div>

          <Partners />
        </section>

        {/* ==================================
            ALL THREE GROUPS
        ================================== */}

        <section
          className="sc-groups-grid"
          aria-label="Starting court assignments for all groups"
        >
          {GROUP_ORDER.map((groupKey) => (
            <StartingGroupPanel
              key={groupKey}
              groupKey={groupKey}
              courts={
                startingCourts[groupKey]
              }
              players={state.players}
            />
          ))}
        </section>
      </div>
    </main>
  );
}
