
"use client";

import { useMemo, useState } from "react";
import useTournament from "@/lib/useTournament";

import {
  BroadcastHeader,
  BroadcastStyles,
  Partners,
} from "@/app/components/TournamentBroadcast";

const RATING_ORDER = {
  "D-": 1,
  D: 2,
  "D+": 3,
  "C-": 4,
  C: 5,
  "C+": 6,
};

export default function PlayerRankingsPage() {
  const { state, connected } = useTournament();

  const [filter, setFilter] = useState("A");

  const players = useMemo(() => {
    const roster = state?.players || [];

    return roster
      .filter(
        (player) =>
          filter === "ALL" ||
          player.group === filter
      )
      .sort(
        (a, b) =>
          (b.wins || 0) - (a.wins || 0) ||
          (a.losses || 0) - (b.losses || 0) ||
          (RATING_ORDER[b.rating] || 0) -
            (RATING_ORDER[a.rating] || 0) ||
          a.name.localeCompare(b.name)
      );
  }, [state, filter]);

  if (!state) {
    return (
      <main
        style={{
          minHeight: "100vh",
          background: "#446463",
          color: "#e4e2db",
          padding: 30,
        }}
      >
        Connecting to player rankings...
      </main>
    );
  }

  const split = Math.ceil(players.length / 2);

  const columns = [
    players.slice(0, split),
    players.slice(split),
  ];

  return (
    <main className="new-tourney">
      <BroadcastStyles />

      <style>{`
        .rankings-view .nt-leader-header {
          background:rgba(0,0,0,.13);
          color:#D5DCDC;
          font-size:10px;
          font-weight:500;
          letter-spacing:.05em;
        }

        .rankings-view .nt-leader-col {
          background:linear-gradient(
            155deg,
            rgba(85,114,114,.5),
            rgba(57,89,88,.6)
          );
          border-top:2px solid rgba(212,183,120,.45);
        }

        .rankings-view .nt-rating {
          display:inline-flex;
          align-items:center;
          justify-content:center;
          min-height:34px;
          border:1px solid rgba(212,183,120,.38);
          background:rgba(212,183,120,.05);
        }

        .rankings-view .nt-leader-row {
          min-height:58px;
        }

        .rankings-view .nt-leader-row
        > strong {
          color:#e4e2db;
        }

        @media(min-width:1600px) {
          .rankings-view .nt-leader-row {
            min-height:64px;
          }

          .rankings-view .nt-leader-row > strong {
            font-size:28px;
          }
        }

        @media(max-width:700px) {
          .rankings-view .nt-leader-row {
            min-height:55px;
          }

          .rankings-view .nt-leader-row > strong {
            font-size:18px;
          }
        }
      `}</style>

      <div className="nt-container rankings-view">
        <BroadcastHeader
          state={state}
          connected={connected}
        />

        <section className="nt-section-head">
          <div>
            <h2>Player Rankings</h2>

            <p>
              {filter === "ALL"
                ? "All 72 registered players"
                : `Group ${filter}`}
            </p>
          </div>

          <Partners />
        </section>

        <nav
          className="nt-tabs"
          aria-label="Player group selection"
        >
          {["A", "B", "C", "ALL"].map((group) => (
            <button
              key={group}
              className={filter === group ? "selected" : ""}
              onClick={() => setFilter(group)}
              aria-pressed={filter === group}
            >
              {group === "ALL"
                ? "All Groups"
                : `Group ${group}`}
            </button>
          ))}
        </nav>

        <section
          className="nt-leader-grid"
          aria-label="Tournament player rankings"
        >
          {columns.map((column, columnIndex) => (
            <div
              className="nt-leader-col"
              key={columnIndex}
            >
              <div className="nt-leader-row nt-leader-header">
                <span>#</span>
                <span>PLAYER</span>
                <span>LEVEL</span>
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
                      columnIndex * split + index + 1
                    ).padStart(2, "0")}
                  </span>

                  <strong>{player.name}</strong>

                  <span className="nt-rating">
                    {player.rating || "—"}
                  </span>

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
        </section>

        <p
          style={{
            marginTop: 17,
            fontSize: 11,
            color: "#D5DCDC",
            letterSpacing: ".05em",
            textAlign: "right",
          }}
        >
          W = WINS · L = LOSSES
        </p>
      </div>
    </main>
  );
}
