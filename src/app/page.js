
"use client";

import useTournament, {
  stageLabel,
} from "@/lib/useTournament";

import {
  BroadcastHeader,
  BroadcastStyles,
  Partners,
  CourtScoreboard,
} from "@/app/components/TournamentBroadcast";

export default function SpectatorPage() {
  const { state, connected } = useTournament();

  if (!state) {
    return (
      <main
        style={{
          background: "#446463",
          color: "#e4e2db",
          minHeight: "100vh",
          padding: 40,
        }}
      >
        Connecting to tournament...
      </main>
    );
  }

  const courts = state.courts
    .filter((court) => court.active)
    .sort((a, b) => a.id - b.id);

  return (
    <main className="new-tourney">
      <BroadcastStyles />

      <div className="nt-container">
        <BroadcastHeader
          state={state}
          connected={connected}
        />

        <section className="nt-section-head">
          <div>
            <h2>
              {state.stage === "groups"
                ? `Group ${state.group} · Round ${state.round}`
                : state.stage === "quarterfinals"
                ? "Quarterfinals"
                : state.stage === "semifinals"
                ? "Semifinals"
                : state.stage === "finals"
                ? "Championship Finals"
                : state.stage === "complete"
                ? "Tournament Complete"
                : "Live Match Centre"}
            </h2>

            <p>
              {state.phase === "setup"
                ? "Awaiting tournament start"
                : ` Live court updates`}
            </p>
          </div>

          <Partners />
        </section>

        <section
          className="nt-courts-grid"
          aria-label="Live court scores"
        >
          {courts.map((court) => (
            <CourtScoreboard
              key={`${state.stage}-${state.slotIndex}-${court.id}`}
              court={court}
              players={state.players}
            />
          ))}
        </section>

        {state.stage !== "groups" && (
          <p style={{ textAlign: "right", marginTop: 20 }}>
            <a
              href="/view/bracket"
              style={{ color: "#e2cfa5" }}
            >
              VIEW KNOCKOUT BRACKET
            </a>
          </p>
        )}
      </div>
    </main>
  );
}
