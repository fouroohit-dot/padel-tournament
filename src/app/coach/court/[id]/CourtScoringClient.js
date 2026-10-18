"use client";

import { use, useState } from "react";
import Link from "next/link";
import useTournament, {
  playerName,
  displayPoints,
} from "@/lib/useTournament";

export default function CourtScoringClient({ params }) {
  const { id } = use(params);
  const courtId = Number(id);

  const { state, connected, token, login, send } = useTournament();

  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function action(event, payload = {}) {
    if (busy) return;

    setBusy(true);
    setMessage("");

    try {
      await send(event, { courtId, ...payload });
    } catch (err) {
      setMessage(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleLogin(e) {
    e.preventDefault();

    try {
      await login(password);
      setPassword("");
      setMessage("");
    } catch (err) {
      setMessage(err.message);
    }
  }

  if (!Number.isInteger(courtId) || courtId < 1 || courtId > 6) {
    return <main className="loading-screen">Court not found.</main>;
  }

  if (!token) {
    return (
      <main className="auth-page">
        <form className="auth-card" onSubmit={handleLogin}>
          <div className="brand-emblem centered">P</div>
          <span className="eyebrow gold">REFEREE ACCESS</span>
          <h1>Court {courtId}</h1>
          <p>Enter the tournament password to manage scoring.</p>

          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Tournament password"
            required
          />
          {message && <p className="error-text">{message}</p>}

          <button className="btn btn-gold" disabled={!connected}>
            UNLOCK SCORING
          </button>
        </form>
      </main>
    );
  }

  if (!state) {
    return <main className="loading-screen">Loading court...</main>;
  }

  const court = state.courts.find(c => c.id === courtId);
  const score = court?.score;

  if (!court) {
    return <main className="loading-screen">Court not found.</main>;
  }

  const live = state.phase === "live";
  const canScore = live && connected && !court.final &&
    !score.finished && !busy;

  return (
    <main className="referee-page">
      <header className="referee-header">
        <div>
          <span className="eyebrow gold">OFFICIAL SCORING</span>
          <h1>COURT {String(courtId).padStart(2, "0")}</h1>
        </div>
        <div className="referee-header-right">
          <span>ROUND {state.round}</span>
          <span className={`connection-pill ${connected ? "online" : ""}`}>
            {connected ? "CONNECTED" : "OFFLINE"}
          </span>
        </div>
      </header>

      <div className="referee-content">
        {message && <div className="notice error">{message}</div>}

        <div className="referee-score-heading">
          <span>PLAYERS</span>
          <span>GAMES</span>
          <span>{score.tiebreak ? "TIEBREAK" : "POINTS"}</span>
        </div>

        {court.teams.map((team, i) => (
          <div
            className={`referee-team ${
              score.finished && score.winner === i ? "referee-winner" : ""
            }`}
            key={i}
          >
            <div className="referee-team-main">
              <div className="referee-team-names">
                <span className="eyebrow">TEAM {i + 1}</span>
                {team.map((id, j) => (
                  <h2 key={j}>{playerName(state.players, id)}</h2>
                ))}
              </div>

              <div className="referee-team-scores">
                <strong>{score.games[i]}</strong>
                <strong className="current-point">
                  {score.finished
                    ? "—"
                    : displayPoints(score, i)}
                </strong>
              </div>
            </div>

            <button
              className="award-button"
              disabled={!canScore}
              onClick={() => action("score:point", { team: i })}
            >
              + AWARD POINT TO TEAM {i + 1}
            </button>
          </div>
        ))}

        {score.finished && (
          <div className="match-complete">
            <span className="eyebrow gold">MATCH COMPLETED</span>
            <h2>TEAM {score.winner + 1} WINS</h2>
            <p>
              Final score: {score.games[0]} – {score.games[1]}
            </p>
          </div>
        )}

        {!live && (
          <div className="notice">
            The coach has not started the tournament yet.
          </div>
        )}

        <div className="referee-controls">
          <button
            className="btn btn-outline"
            disabled={!live || court.final || busy ||
              !connected}
            onClick={() => action("score:undo")}
          >
            ↶ UNDO LAST POINT
          </button>

          {!court.final ? (
            <button
              className="btn btn-gold"
              disabled={!score.finished || busy || !connected}
              onClick={() => action("score:finalize")}
            >
              CONFIRM FINAL RESULT ✓
            </button>
          ) : (
            <button
              className="btn btn-outline"
              disabled={busy || !connected}
              onClick={() => action("score:reopen")}
            >
              REOPEN RESULT
            </button>
          )}
        </div>

        {court.final && (
          <div className="notice success">
            Final result submitted. Awaiting the coach to start
            the next round.
          </div>
        )}

        <div className="referee-bottom">
          <Link href="/coach">← BACK TO COACH DASHBOARD</Link>
          <span>PADEL CHAMPIONSHIP · OFFICIAL</span>
        </div>
      </div>
    </main>
  );
}