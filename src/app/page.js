
"use client";

import useTournament, {
  displayPoints,
  playerName,
} from "@/lib/useTournament";

function CourtCard({ court, players, mode }) {
  const { score, teams, final } = court;

  return (
    <article className={`court-card ${final ? "is-final" : ""}`}>
      <div className="court-card-top">
        <div>
          <span className="eyebrow"></span>
          <h2>COURT {String(court.id).padStart(2, "0")}</h2>
        </div>
        <span className={`status ${final ? "done" : ""}`}>
          {final ? "FINAL" : score.finished ? "MATCH POINT WON" : "LIVE"}
        </span>
      </div>

      <div className="score-table">
        <div className="score-head">
          <span>PLAYERS</span>
          <span>GAMES</span>
          <span>{score.tiebreak ? "TB" : "POINTS"}</span>
        </div>

        {[0, 1].map(team => (
          <div
            className={`score-row ${score.finished && score.winner === team ? "winner" : ""
              }`}
            key={team}
          >
            <div className="team-players">
              <span className="team-label">TEAM {team + 1}</span>
              {teams[team].map((id, index) => (
                <strong key={`${team}-${index}`}>
                  {playerName(players, id)}
                </strong>
              ))}
            </div>

            <span className="score-number">{score.games[team]}</span>

            <span className="point-number">
              {score.finished ? "—" : displayPoints(score, team)}
            </span>
          </div>
        ))}
      </div>

      <div className="court-card-footer">
        <span>
          {score.finished
            ? `WINNER · TEAM ${score.winner + 1}`
            : score.tiebreak
              ? "TIEBREAK IN PROGRESS"
              : mode === "golden"
                ? "GOLDEN POINT SCORING"
                : "ADVANTAGE SCORING"}
        </span>
        <span className="mini-court-icon">◇</span>
      </div>
    </article>
  );
}

export default function SpectatorPage() {
  const { state, connected } = useTournament();

  if (!state) {
    return (
      <main className="loading-screen">
        <div className="loading-emblem">P</div>
        <h1>PADEL CHAMPIONSHIP</h1>
        <p>Connecting to the tournament...</p>
      </main>
    );
  }

  const completed = state.courts.filter(c => c.final).length;

  return (
    <main className="spectator-page">
      <header className="spectator-header">
      <div className="championship-brand">
  <div className="brand-emblem">
    <img
      src="/ap-logo.png"
      alt="AP Padel Championship"
      className="brand-logo"
    />
  </div>

  <div className="championship-title">
    {/* <span className="eyebrow gold">THE CHAMPIONSHIP</span> */}
    <h1>Royal Oak Offshore Tournament</h1>
  </div>
</div>

        <div className="header-info">
          <div className="round-indicator">
            <span className="eyebrow">CURRENT ROUND</span>
            <strong>{String(state.round).padStart(2, "0")}</strong>
          </div>

          <span className={`connection-pill ${connected ? "online" : ""}`}>
            <span className="connection-dot" />
            {connected ? "LIVE SCORES" : "RECONNECTING"}
          </span>
        </div>
      </header>

      <div className="gold-divider" />

      <section className="spectator-intro">
        <div>
          <span className="eyebrow gold">THE COURTS</span>
          <h2>Live Match Centre</h2>
        </div>
        <p>
          {state.phase === "setup"
            ? "Awaiting tournament commencement"
            : `${completed} OF 6 MATCHES FINAL`}
        </p>
      </section>

      <section className="courts-grid">
        {state.courts.map(court => (
          <CourtCard
            key={court.id}
            court={court}
            players={state.players}
            mode={state.mode}
          />
        ))}
      </section>

      <footer className="spectator-footer">
        <span>PADEL CHAMPIONSHIP</span>
        <span>
          {state.phase === "setup"
            ? "TOURNAMENT SETUP"
            : completed === 6
              ? "AWAITING NEXT ROUND"
              : "MATCHES IN PROGRESS"}
        </span>
        <span>COURTS 01 — 06</span>
      </footer>
    </main>
  );
}
