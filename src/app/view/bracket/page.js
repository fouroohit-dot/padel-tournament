
"use client";

import useTournament, {
  playerName,
} from "@/lib/useTournament";

import {
  BroadcastHeader,
  BroadcastStyles,
  Partners,
} from "@/app/components/TournamentBroadcast";

function MatchCard({ match, players, placeholder, bronze = false }) {
  const names = (side) => {
    if (!match?.teams?.[side]) {
      return placeholder?.[side] || "To be determined";
    }

    return match.teams[side]
      .map((id) => playerName(players, id))
      .join(" / ");
  };

  return (
    <div className={`bracket-match ${bronze ? "bronze" : ""}`}>
      <div className="bracket-match-title">
        {bronze ? "🥉 " : ""}
        {match?.label || placeholder?.title || "Upcoming"}
      </div>

      {[0, 1].map((side) => (
        <div
          key={side}
          className={`bracket-team ${
            match?.final && match.winner === side
              ? "winner"
              : ""
          }`}
        >
          <span>{names(side)}</span>
          {match?.final && (
            <strong>{match.points[side]}</strong>
          )}
        </div>
      ))}
    </div>
  );
}

export default function KnockoutBracketPage() {
  const { state, connected } = useTournament();

  if (!state) {
    return <main>Connecting to bracket...</main>;
  }

  const bracket = state.bracket || {};
  const qf = bracket.quarterfinals || [];
  const sf = bracket.semifinals || [];
  const finals = bracket.final || [];

  return (
    <main className="new-tourney">
      <BroadcastStyles />

      <style>{`
        .bracket-layout {
          display: grid;
          grid-template-columns:
            minmax(250px,1fr)
            35px
            minmax(250px,1fr)
            35px
            minmax(250px,1fr);
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
          letter-spacing: .05em;
          font-weight: 500;
          color: #e2cfa5;
          text-align: center;
        }

        .bracket-match {
          background: linear-gradient(145deg,#557272,#395958);
          border: 1px solid #809595;
          border-top: 2px solid #d4b778;
          padding: 16px;
          min-width: 0;
        }

        .bracket-match-title {
          font-size: 13px;
          letter-spacing: .04em;
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
          border-top: 1px solid rgba(213,220,220,.25);
          font-size: clamp(14px,1.2vw,18px);
          overflow-wrap: anywhere;
        }

        .bracket-team.winner {
          color: #e2cfa5;
          font-weight: 700;
        }

        .bracket-team strong {
          font-size: 22px;
          color: #d4b778;
        }

        .bracket-match.bronze {
          border-top-color: #b18a47;
        }

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
          background: rgba(212,183,120,.6);
        }

        .bracket-note {
          color: #D5DCDC;
          text-align: center;
          margin-top: 35px;
          font-size: 14px;
        }

        @media(max-width:1000px) {
          .bracket-layout {
            grid-template-columns:1fr;
            gap:28px;
          }

          .bracket-connect {
            height:22px;
          }

          .bracket-connect::before {
            width:1px;
            height:22px;
          }

          .bracket-col {
            gap:14px;
          }

          .bracket-col h3 {
            margin-bottom:0;
          }
        }
      `}</style>

      <div className="nt-container">
        <BroadcastHeader
          state={state}
          connected={connected}
        />

        <section className="nt-section-head">
          <div>
            <h2>Championship Bracket</h2>
            <p>Quarterfinals · Semifinals · Final · Bronze</p>
          </div>
          <Partners />
        </section>

        <div className="bracket-layout">
          <section className="bracket-col">
            <h3>QUARTERFINALS</h3>

            {[0, 1, 2, 3].map((index) => (
              <MatchCard
                key={index}
                match={qf[index]}
                players={state.players}
                placeholder={{
                  title: `Quarterfinal ${index + 1}`,
                  0: "Qualified team",
                  1: "Qualified team",
                }}
              />
            ))}
          </section>

          <div className="bracket-connect" aria-hidden="true" />

          <section className="bracket-col">
            <h3>SEMIFINALS</h3>

            {[0, 1].map((index) => (
              <MatchCard
                key={index}
                match={sf[index]}
                players={state.players}
                placeholder={{
                  title: `Semifinal ${index + 1}`,
                  0: `Winner QF ${index * 2 + 1}`,
                  1: `Winner QF ${index * 2 + 2}`,
                }}
              />
            ))}
          </section>

          <div className="bracket-connect" aria-hidden="true" />

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
                title: "Third Place",
                0: "Loser SF 1",
                1: "Loser SF 2",
              }}
            />
          </section>
        </div>

        <p className="bracket-note">
          Eight teams · Four quarterfinals · Two semifinals ·
          Championship final and bronze match
        </p>
      </div>
    </main>
  );
}
