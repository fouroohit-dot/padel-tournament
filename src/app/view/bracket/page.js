
"use client";

import useTournament, {
  playerName,
} from "@/lib/useTournament";

import {
  BroadcastHeader,
  BroadcastStyles,
  Partners,
} from "@/app/components/TournamentBroadcast";

/* ==========================================
   MATCH CARD
========================================== */

function MatchCard({
  match,
  players,
  placeholder,
  bronze = false,
}) {
  function names(side) {
    const team = match?.teams?.[side];

    if (!Array.isArray(team) || !team.some(Boolean)) {
      return placeholder?.[side] || "To be determined";
    }

    return team
      .filter(Boolean)
      .map((id) => playerName(players, id))
      .join(" / ");
  }

  const matchTitle =
    match?.label ||
    placeholder?.title ||
    "Upcoming";

  const courtLabel = match?.courtId
    ? ` · COURT ${match.courtId}`
    : "";

  return (
    <div
      className={`bracket-match ${
        bronze ? "bronze" : ""
      }`}
    >
      <div className="bracket-match-title">
        {bronze ? "" : ""}
        {matchTitle}
        {courtLabel}
      </div>

      {[0, 1].map((side) => {
        const isWinner =
          match?.final &&
          match.winner === side;

        return (
          <div
            key={side}
            className={`bracket-team ${
              isWinner ? "winner" : ""
            }`}
          >
            <span>{names(side)}</span>

            {match?.final && (
              <strong>
                {match.points?.[side] ?? 0}
              </strong>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ==========================================
   MAIN BRACKET PAGE
========================================== */

export default function KnockoutBracketPage() {
  const { state, connected } = useTournament();

  if (!state) {
    return (
      <main
        style={{
          minHeight: "100vh",
          padding: 30,
          background: "#446463",
          color: "#e4e2db",
          fontFamily:
            '"Helvetica Neue LT Pro", "Helvetica Neue", Helvetica, Arial, sans-serif',
        }}
      >
        Connecting to bracket...
      </main>
    );
  }

  const bracket = state.bracket || {};

  const quarterfinals =
    bracket.quarterfinals || [];

  const semifinals =
    bracket.semifinals || [];

  const finals =
    bracket.final || [];

  const drawConfirmed = Boolean(
    state.qualification?.drawConfirmed ||
    quarterfinals.length === 4
  );

  const hasQualified = Boolean(
    state.qualification?.qualifiedPlayerIds?.length === 16
  );

  return (
    <main className="new-tourney">
      <BroadcastStyles />

      <style>{`
        /* ==================================
           BRACKET LAYOUT
        ================================== */

        .bracket-layout {
          display: grid;

          grid-template-columns:
            minmax(250px, 1fr)
            35px
            minmax(250px, 1fr)
            35px
            minmax(250px, 1fr);

          gap: 0;
          margin-top: 30px;
          align-items: stretch;
        }

        .bracket-col {
          display: flex;
          flex-direction: column;
          justify-content: space-around;
          gap: 22px;
          min-width: 0;
        }

        .bracket-col h3 {
          margin: 0 0 25px;

          font-size: 17px;
          letter-spacing: 0.05em;
          font-weight: 500;

          color: #e2cfa5;
          text-align: center;
        }

        /* ==================================
           MATCH CARDS
        ================================== */

        .bracket-match {
          background: linear-gradient(
            145deg,
            #557272,
            #395958
          );

          border: 1px solid #809595;
          border-top: 2px solid #d4b778;

          padding: 16px;
          min-width: 0;
        }

        .bracket-match-title {
          font-size: 13px;
          letter-spacing: 0.04em;
          font-weight: 500;

          color: #d4b778;

          margin-bottom: 14px;
          text-transform: uppercase;
        }

        .bracket-team {
          display: flex;
          justify-content: space-between;
          align-items: center;

          gap: 10px;
          min-height: 49px;

          padding: 8px 0;

          border-top: 1px solid
            rgba(213, 220, 220, 0.25);

          font-size: clamp(
            14px,
            1.2vw,
            18px
          );

          overflow-wrap: anywhere;
        }

        .bracket-team.winner {
          color: #e2cfa5;
          font-weight: 700;
        }

        .bracket-team strong {
          font-size: 22px;
          color: #d4b778;
          font-variant-numeric: tabular-nums;
        }

        .bracket-match.bronze {
          border-top-color: #b18a47;
        }

        /* ==================================
           BRACKET CONNECTORS
        ================================== */

        .bracket-connect {
          align-self: stretch;
          position: relative;

          display: flex;
          align-items: center;
          justify-content: center;
        }

        .bracket-connect::before {
          content: "";

          width: 100%;
          height: 1px;

          background: rgba(
            212,
            183,
            120,
            0.6
          );
        }

        /* ==================================
           STATUS MESSAGE
        ================================== */

        .bracket-note {
          color: #D5DCDC;
          text-align: center;

          margin-top: 35px;

          font-size: 14px;
          line-height: 1.5;
        }

        /* ==================================
           TABLET / MOBILE
        ================================== */

        @media (max-width: 1000px) {
          .bracket-layout {
            grid-template-columns: 1fr;
            gap: 28px;
          }

          .bracket-connect {
            height: 22px;
          }

          .bracket-connect::before {
            width: 1px;
            height: 22px;
          }

          .bracket-col {
            gap: 14px;
          }

          .bracket-col h3 {
            margin-bottom: 0;
          }
        }
      `}</style>

      <div className="nt-container">
        {/* Shared AP broadcast header */}
        <BroadcastHeader
          state={state}
          connected={connected}
        />

        {/* Page heading and partner logos */}
        <section className="nt-section-head">
          <div>
            <h2>Championship Bracket</h2>

          </div>

          <Partners />
        </section>

        {/* ==================================
            BRACKET COLUMNS
        ================================== */}

        <div className="bracket-layout">
          {/* QUARTERFINALS */}

          <section className="bracket-col">
            <h3>QUARTERFINALS</h3>

            {[0, 1, 2, 3].map((index) => (
              <MatchCard
                key={`qf-${index}`}
                match={quarterfinals[index]}
                players={state.players}
                placeholder={{
                  title: `Quarterfinal ${index + 1}`,

                  0: drawConfirmed
                    ? "Qualified team"
                    : hasQualified
                    ? "Awaiting coach draw"
                    : "Awaiting group rankings",

                  1: drawConfirmed
                    ? "Qualified team"
                    : hasQualified
                    ? "Awaiting coach draw"
                    : "Awaiting group rankings",
                }}
              />
            ))}
          </section>

          <div
            className="bracket-connect"
            aria-hidden="true"
          />

          {/* SEMIFINALS */}

          <section className="bracket-col">
            <h3>SEMIFINALS</h3>

            {[0, 1].map((index) => (
              <MatchCard
                key={`sf-${index}`}
                match={semifinals[index]}
                players={state.players}
                placeholder={{
                  title: `Semifinal ${index + 1}`,

                  0: `Winner QF ${index * 2 + 1}`,
                  1: `Winner QF ${index * 2 + 2}`,
                }}
              />
            ))}
          </section>

          <div
            className="bracket-connect"
            aria-hidden="true"
          />

          {/* FINAL AND BRONZE */}

          <section className="bracket-col">
            <h3>PLACEMENT MATCHES</h3>

            <MatchCard
              match={finals[0]}
              players={state.players}
              placeholder={{
                title: "Championship Final",

                0: "Winner SF 1",
                1: "Winner SF 2",
              }}
            />

            <MatchCard
              match={finals[1]}
              players={state.players}
              bronze
              placeholder={{
                title: "Bronze",

                0: "Loser SF 1",
                1: "Loser SF 2",
              }}
            />
          </section>
        </div>

        {/* ==================================
            DYNAMIC STATUS
        ================================== */}

        <p className="bracket-note">
          {!hasQualified
            ? "Quarterfinal qualification will be determined after Group C, Round 4."
            : !drawConfirmed
            ? "16 players qualified · Awaiting coach to assign partnerships, matchups and courts."
            : state.stage === "complete"
            ? "Tournament complete · Final results confirmed."
            : "Quarterfinal draw confirmed · Fixed partnerships · First to 10 points."}
        </p>
      </div>
    </main>
  );
}
