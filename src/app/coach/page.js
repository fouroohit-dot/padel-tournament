"use client";

import { useState } from "react";
import Link from "next/link";
import useTournament, { playerName } from "@/lib/useTournament";

export default function CoachDashboard() {
  const { state, connected, token, login, logout, send } = useTournament();

  const [password, setPassword] = useState("");
  const [newPlayer, setNewPlayer] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function action(event, payload = {}) {
    if (busy) return;

    setBusy(true);
    setMessage("");

    try {
      await send(event, payload);
      return true;
    } catch (err) {
      setMessage(err.message);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function handleLogin(e) {
    e.preventDefault();
    setMessage("");

    try {
      await login(password);
      setPassword("");
    } catch (err) {
      setMessage(err.message);
    }
  }

  async function addPlayer(e) {
    e.preventDefault();

    const ok = await action("player:add", { name: newPlayer });

    if (ok) setNewPlayer("");
  }

  if (!token) {
    return (
      <main className="auth-page">
        <form className="auth-card" onSubmit={handleLogin}>
          <div className="brand-emblem centered">P</div>
          <span className="eyebrow gold">TOURNAMENT MANAGEMENT</span>
          <h1>Coach Access</h1>
          <p>Enter your tournament password to continue.</p>

          <label className="field-label">PASSWORD</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Tournament password"
            required
          />

          {message && <p className="error-text">{message}</p>}

          <button className="btn btn-gold" disabled={!connected}>
            {connected ? "SIGN IN" : "CONNECTING..."}
          </button>

          <Link href="/" className="subtle-link">
            ← Back to live scoreboard
          </Link>
        </form>
      </main>
    );
  }

  if (!state) {
    return <main className="loading-screen">Loading tournament...</main>;
  }

  const setup = state.phase === "setup";
  const completed = state.courts.filter(c => c.final).length;
  const ready = completed === 6;

  const allAssignments = state.courts.flatMap(
    court => court.teams.flatMap(team => team.filter(Boolean))
  );

  const fullyAssigned =
    state.players.length === 24 &&
    allAssignments.length === 24 &&
    new Set(allAssignments).size === 24;

  async function resetTournament() {
    const confirmed = window.confirm(
      "Reset the entire tournament? All players and scores will be erased."
    );

    if (confirmed) await action("tournament:reset");
  }

  return (
    <main className="admin-page">
      <header className="admin-header">
        <div>
          <span className="eyebrow gold">PADEL CHAMPIONSHIP</span>
          <h1>Coach Dashboard</h1>
          <p>Tournament management and court control</p>
        </div>

        <div className="admin-header-actions">
          <Link className="btn btn-outline" href="/" target="_blank">
            SPECTATOR VIEW ↗
          </Link>
          <button className="btn btn-muted" onClick={logout}>
            LOG OUT
          </button>
        </div>
      </header>

      {!connected && (
        <div className="notice">
          Connection lost. Changes are temporarily unavailable.
        </div>
      )}

      {message && <div className="notice error">{message}</div>}

      <section className="stats-grid">
        <div className="stat-box">
          <span>ROUND</span>
          <strong>{state.round}</strong>
        </div>
        <div className="stat-box">
          <span>REGISTERED PLAYERS</span>
          <strong>{state.players.length}/24</strong>
        </div>
        <div className="stat-box">
          <span>FINAL MATCHES</span>
          <strong>{completed}/6</strong>
        </div>
        <div className="stat-box">
          <span>TOURNAMENT STATUS</span>
          <strong className="small-stat">
            {setup ? "SETUP" : "LIVE"}
          </strong>
        </div>
      </section>

      {setup && (
        <>
          <section className="admin-panel">
            <div className="section-heading">
              <div>
                <span className="eyebrow gold">STEP 01</span>
                <h2>Register Players</h2>
              </div>
              <span>{state.players.length} / 24</span>
            </div>

            <form className="player-form" onSubmit={addPlayer}>
              <input
                value={newPlayer}
                onChange={e => setNewPlayer(e.target.value)}
                placeholder="Player full name"
                maxLength={80}
                required
                disabled={state.players.length >= 24 || busy}
              />
              <button
                className="btn btn-gold"
                disabled={busy || !connected || state.players.length >= 24}
              >
                ADD PLAYER +
              </button>
            </form>

            <div className="registered-grid">
              {state.players.map((p, i) => (
                <div className="registered-player" key={p.id}>
                  <span>{String(i + 1).padStart(2, "0")}</span>
                  <strong>{p.name}</strong>
                  <button
                    onClick={() => action("player:remove", { playerId: p.id })}
                    disabled={busy || !connected}
                    aria-label={`Remove ${p.name}`}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </section>

          <section className="admin-panel">
            <div className="section-heading">
              <div>
                <span className="eyebrow gold">STEP 02</span>
                <h2>Assign Courts & Teams</h2>
              </div>
            </div>

            <div className="assignment-grid">
              {state.courts.map(court => (
                <div className="assignment-card" key={court.id}>
                  <h3>COURT {String(court.id).padStart(2, "0")}</h3>

                  {[0, 1].map(team => (
                    <div className="assignment-team" key={team}>
                      <span className="field-label">
                        TEAM {team + 1}
                      </span>

                      {[0, 1].map(slot => {
                        const selected = court.teams[team]?.[slot] || "";

                        return (
                          <select
                            key={slot}
                            value={selected}
                            disabled={busy || !connected}
                            onChange={e => action("court:assign", {
                              courtId: court.id,
                              team,
                              slot,
                              playerId: e.target.value || null,
                            })}
                          >
                            <option value="">
                              Select player {slot + 1}
                            </option>
                            {state.players
                              .filter(p =>
                                p.id === selected ||
                                !allAssignments.includes(p.id)
                              )
                              .map(p => (
                                <option key={p.id} value={p.id}>
                                  {p.name}
                                </option>
                              ))}
                          </select>
                        );
                      })}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </section>

          <section className="admin-panel">
            <div className="section-heading">
              <div>
                <span className="eyebrow gold">STEP 03</span>
                <h2>Scoring & Start</h2>
              </div>
            </div>

            <label className="field-label">DEUCE SCORING</label>
            <select
              className="mode-select"
              value={state.mode}
              disabled={busy || !connected}
              onChange={e => action("tournament:mode", {
                mode: e.target.value,
              })}
            >
              <option value="advantage">
                Traditional Advantage
              </option>
              <option value="golden">
                Golden Point
              </option>
            </select>

            <p className="help-text">
              Matches are played as one set to six games,
              with a tiebreak at 6–6.
            </p>

            <button
              className="btn btn-gold btn-large"
              disabled={!fullyAssigned || busy || !connected}
              onClick={() => action("tournament:start")}
            >
              START TOURNAMENT →
            </button>

            {!fullyAssigned && (
              <p className="help-text">
                Register and assign all 24 unique players to begin.
              </p>
            )}
          </section>
        </>
      )}

      {!setup && (
        <>
          <section className="admin-panel">
            <div className="section-heading">
              <div>
                <span className="eyebrow gold">LIVE MANAGEMENT</span>
                <h2>Court Control</h2>
              </div>
              <span>{completed} / 6 FINAL</span>
            </div>

            <div className="admin-courts-grid">
              {state.courts.map(court => (
                <div className="admin-court-card" key={court.id}>
                  <div className="admin-court-title">
                    <h3>COURT {court.id}</h3>
                    <span className={`status ${court.final ? "done" : ""}`}>
                      {court.final ? "FINAL" : "LIVE"}
                    </span>
                  </div>

                  {court.teams.map((team, i) => (
                    <div className="admin-team-row" key={i}>
                      <div>
                        {team.map(id => playerName(state.players, id))
                          .join(" / ")}
                      </div>
                      <strong>{court.score.games[i]}</strong>
                    </div>
                  ))}

                  <Link
                    href={`/coach/court/${court.id}`}
                    className="btn btn-gold"
                  >
                    OPEN COURT {court.id} →
                  </Link>
                </div>
              ))}
            </div>
          </section>

          <section className="admin-panel advancement-panel">
            <span className="eyebrow gold">ROUND CONTROL</span>
            <h2>Advance to Next Round</h2>
            <p>
              When all six referees have finalized their matches,
              the winning pairs advance and losing pairs move down.
            </p>

            <div className="progress-track">
              <div style={{ width: `${completed / 6 * 100}%` }} />
            </div>

            <p>{completed} of 6 matches finalized</p>

            <button
              className="btn btn-gold btn-large"
              disabled={!ready || busy || !connected}
              onClick={() => action("tournament:advance")}
            >
              {ready
                ? `GENERATE ROUND ${state.round + 1} →`
                : "AWAITING FINAL RESULTS"}
            </button>
          </section>
        </>
      )}

      <section className="admin-panel danger-panel">
        <h3>Tournament Administration</h3>
        <p>Reset the tournament and clear all players and scores.</p>
        <button
          className="btn btn-danger"
          onClick={resetTournament}
          disabled={busy || !connected}
        >
          RESET TOURNAMENT
        </button>
      </section>
    </main>
  );
}
