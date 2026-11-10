
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

import useTournament, {
  getCoachToken,
  saveCoachToken,
  clearCoachToken,
  sendTournamentEvent,
  playerName,
  stageLabel,
} from "@/lib/useTournament";

import {
  DigitalClock,
} from "@/app/components/TournamentBroadcast";

const styles = `
  .ar-referee {
    --ar-mineral:#e4e2db;
    --ar-gold:#d4b778;
    min-height:100vh;
    min-height:100dvh;
    background:radial-gradient(
      ellipse at 50% 0,
      #557272 0%,#446463 55%,#395958 100%
    );
    color:var(--ar-mineral);
    font-family:
      "Helvetica Neue LT Pro",
      "Helvetica Neue",
      Helvetica,Arial,sans-serif;
    font-weight:300;
  }
  .ar-referee *,
  .ar-referee *::before,
  .ar-referee *::after { box-sizing:border-box; }
  .ar-referee button,
  .ar-referee input { font:inherit; }
  .ar-referee button {
    cursor:pointer;
    -webkit-tap-highlight-color:transparent;
    touch-action:manipulation;
  }
  .ar-referee button:disabled {
    opacity:.43;
    cursor:not-allowed;
  }
  .ar-wrap {
    width:100%;
    max-width:1100px;
    margin:auto;
    padding:16px clamp(12px,2.5vw,30px) 36px;
  }
  .ar-header {
    display:flex;
    align-items:center;
    justify-content:space-between;
    gap:12px;
    padding-bottom:16px;
    border-bottom:1px solid rgba(212,183,120,.45);
  }
  .ar-brand {
    display:flex;
    align-items:center;
    gap:10px;
    min-width:0;
  }
  .ar-brand img {
    width:37px;height:49px;
    flex-shrink:0;object-fit:contain;
  }
  .ar-brand h1 {
    margin:0;
    font-size:clamp(16px,3.2vw,24px);
    font-weight:500;
    line-height:1.12;
    letter-spacing:.05em;
  }
  .ar-brand span {
    display:block;
    color:#e2cfa5;
    font-size:10px;
    font-weight:500;
    letter-spacing:.05em;
    margin-top:4px;
  }
  .ar-status {
    display:flex;
    align-items:center;
    gap:6px;
    font-size:10px;
    letter-spacing:.05em;
    white-space:nowrap;
  }
  .ar-status i {
    width:7px;height:7px;
    border-radius:50%;
    background:#d5dcdc;
  }
  .ar-meta {
    display:flex;
    align-items:center;
    justify-content:space-between;
    gap:15px;
    margin:19px 0;
  }
  .ar-meta h2 {
    margin:0;
    font-size:clamp(30px,6vw,48px);
    font-weight:500;
    line-height:1;
  }
  .ar-meta p {
    margin:7px 0 0;
    font-family:"JHA Times Now",Georgia,serif;
    font-style:italic;
    font-size:14px;
    color:#e2cfa5;
  }
  .ar-meta .nt-clock {
    display:flex;
    flex-direction:column;
    align-items:center;
    justify-content:center;
    gap:4px;
    width:165px;
    min-width:165px;
    height:83px;
    padding:8px;
    background:rgba(213,220,220,.08);
    border:1px solid rgba(212,183,120,.45);
    border-radius:3px;
  }
  .ar-meta .nt-clock > span {
    font-size:9px;
    font-weight:500;
    letter-spacing:.05em;
  }
  .ar-meta .nt-clock strong {
    color:#e2cfa5;
    font-size:38px;
    font-weight:500;
    line-height:1;
    font-variant-numeric:tabular-nums;
    font-feature-settings:"tnum" 1;
  }
  .ar-meta .nt-clock em {
    color:#e4e2db;
    font-family:"JHA Times Now",Georgia,serif;
    font-size:10px;
    font-style:italic;
    white-space:nowrap;
  }
  .ar-note {
    padding:13px 16px;
    border-left:3px solid #d4b778;
    background:rgba(212,183,120,.08);
    margin:14px 0;
    line-height:1.5;
    font-size:14px;
  }
  .ar-error {
    border-left-color:#ffad9c;
    background:rgba(120,40,35,.14);
    color:#ffe4df;
  }
  .ar-grid {
    display:grid;
    grid-template-columns:repeat(2,minmax(0,1fr));
    gap:15px;
  }
  .ar-team {
    display:flex;
    flex-direction:column;
    min-width:0;
    padding:23px;
    background:linear-gradient(
      150deg,#557272,#446463 50%,#395958
    );
    border:1px solid rgba(213,220,220,.32);
    border-top:2px solid rgba(212,183,120,.5);
  }
  .ar-team.winner {
    border-top-color:#d4b778;
    background:linear-gradient(
      150deg,rgba(212,183,120,.14),#446463 62%,#395958
    );
  }
  .ar-team-label {
    font-size:11px;
    font-weight:500;
    letter-spacing:.05em;
    color:#d5dcdc;
  }
  .ar-team-names {
    display:flex;
    flex-direction:column;
    min-height:103px;
    justify-content:center;
    margin-top:15px;
    gap:4px;
  }
  .ar-team-names strong {
    font-size:clamp(25px,3.4vw,43px);
    line-height:1.12;
    font-weight:700;
    overflow-wrap:anywhere;
  }
  .ar-score {
    display:block;
    margin:12px 0 19px;
    color:#d4b778;
    font-size:clamp(78px,10vw,132px);
    font-weight:500;
    line-height:1;
    text-align:center;
    font-variant-numeric:tabular-nums;
  }
  .ar-btn {
    width:100%;
    min-height:56px;
    padding:13px 16px;
    color:#294a49;
    background:#d4b778;
    border:1px solid #d4b778;
    border-radius:3px;
    font-size:18px !important;
    font-weight:500 !important;
  }
  .ar-btn.secondary {
    color:#e4e2db;
    background:rgba(213,220,220,.09);
    border-color:rgba(213,220,220,.4);
  }
  .ar-btn.danger {
    background:rgba(120,55,50,.28);
    border-color:#c99488;
    color:#ffe4df;
  }
  .ar-controls {
    display:grid;
    grid-template-columns:1fr 1fr;
    gap:13px;
    margin-top:17px;
  }
  .ar-controls .ar-btn {
    min-height:61px;
    font-size:16px !important;
  }
  .ar-login {
    width:min(100%,460px);
    margin:35px auto 0;
    padding:24px;
    border:1px solid rgba(213,220,220,.3);
    background:#395958;
  }
  .ar-login h2 {
    font-size:27px;
    font-weight:500;
  }
  .ar-input {
    display:block;
    width:100%;
    height:51px;
    padding:10px 13px;
    margin:16px 0 12px;
    background:#557272;
    color:white;
    border:1px solid #809595;
    font-size:17px;
  }
  .ar-overlay {
    position:fixed;
    z-index:9999;
    inset:0;
    display:flex;
    align-items:center;
    justify-content:center;
    padding:16px;
    background:rgba(12,31,30,.84);
    backdrop-filter:blur(5px);
  }
  .ar-dialog {
    width:min(100%,460px);
    padding:23px;
    background:#446463;
    border:1px solid #d4b778;
    box-shadow:0 20px 65px rgba(0,0,0,.36);
  }
  .ar-dialog h2 {
    margin:0 0 13px;
    font-size:26px;
    font-weight:500;
  }
  .ar-dialog p {
    line-height:1.55;
    margin-bottom:20px;
  }
  .ar-dialog .ar-actions {
    display:flex;
    gap:10px;
  }
  .ar-dialog .ar-btn {
    flex:1;
    font-size:14px !important;
  }
  @media(max-width:700px) {
    .ar-wrap { padding:12px 12px 24px; }
    .ar-header { align-items:flex-start; }
    .ar-meta h2 { font-size:35px; }
    .ar-grid {
      grid-template-columns:1fr;
      gap:12px;
    }
    .ar-team { padding:15px 17px; }
    .ar-team-names {
      min-height:0;
      margin-top:8px;
      gap:3px;
    }
    .ar-team-names strong {
      font-size:clamp(25px,6vw,35px);
    }
    .ar-score {
      font-size:80px;
      margin:7px 0 13px;
    }
    .ar-btn {
      min-height:64px;
      font-size:21px !important;
    }
    .ar-controls {
      grid-template-columns:1fr;
      gap:10px;
    }
    .ar-meta .nt-clock {
      width:148px;
      min-width:148px;
      height:80px;
    }
    .ar-meta .nt-clock strong { font-size:34px; }
  }
  @media(max-width:375px) {
    .ar-brand h1 { font-size:15px; }
    .ar-meta { align-items:flex-start; }
    .ar-meta .nt-clock {
      width:133px;
      min-width:133px;
    }
    .ar-meta .nt-clock strong { font-size:30px; }
    .ar-team-names strong { font-size:25px; }
  }
`;

function ConfirmationDialog({
  dialog,
  onCancel,
  onConfirm,
  busy,
}) {
  if (!dialog) return null;

  return (
    <div className="ar-overlay">
      <section
        className="ar-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ar-dialog-heading"
      >
        <span className="ar-team-label">
          REFEREE CONFIRMATION
        </span>

        <h2 id="ar-dialog-heading">
          {dialog.title}
        </h2>

        <p>{dialog.description}</p>

        <div className="ar-actions">
          <button
            className="ar-btn secondary"
            disabled={busy}
            onClick={onCancel}
          >
            Cancel
          </button>

          <button
            className="ar-btn"
            disabled={busy}
            onClick={onConfirm}
          >
            {busy ? "Saving..." : dialog.button}
          </button>
        </div>
      </section>
    </div>
  );
}

export default function RefereeCourtClient() {
  const params = useParams();
  const courtId = Number(params?.id);

  const { state, connected } = useTournament();

  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [dialog, setDialog] = useState(null);

  useEffect(() => {
    setToken(getCoachToken());
  }, []);

  async function action(event, payload = {}) {
    if (busy || !state) return false;

    setBusy(true);
    setError("");
    setNotice("");

    try {
      await sendTournamentEvent(event, {
        courtId,
        matchKey: state.matchKey,
        ...payload,
      });

      return true;
    } catch (error) {
      setError(error.message);

      if (/unauthorized/i.test(error.message)) {
        clearCoachToken();
        setToken("");
      }

      return false;
    } finally {
      setBusy(false);
    }
  }

  async function login(event) {
    event.preventDefault();

    setBusy(true);
    setError("");

    try {
      const response = await sendTournamentEvent(
        "coach:login",
        { password },
        false
      );

      saveCoachToken(response.token);
      setToken(response.token);
      setPassword("");
    } catch (error) {
      setError(error.message);
    } finally {
      setBusy(false);
    }
  }

  if (
    !Number.isInteger(courtId) ||
    courtId < 1 ||
    courtId > 6
  ) {
    return (
      <main className="ar-referee" style={{ padding: 30 }}>
        Invalid court number.
      </main>
    );
  }

  if (!state) {
    return (
      <main className="ar-referee" style={{ padding: 30 }}>
        Connecting to Court {courtId}...
      </main>
    );
  }

  const court = state.courts.find(
    (item) => item.id === courtId
  );

  const knockout =
    state.stage !== "groups" &&
    state.phase === "live";

  const knockoutFinished =
    knockout &&
    (court?.score?.points || []).some(
      (score) => score >= 10
    );

  const names = (side) =>
    (court?.teams?.[side] || [])
      .filter(Boolean)
      .map((id) => playerName(state.players, id));

  const score = court?.score?.points || [0, 0];

  const winnerSide = score[0] > score[1] ? 0 : 1;

  const canScore = Boolean(
    connected &&
    token &&
    state.phase === "live" &&
    (knockout || state.timerStarted) &&
    court?.active &&
    !court.final &&
    !knockoutFinished &&
    !busy
  );

  const canFinalize = Boolean(
    connected &&
    token &&
    state.phase === "live" &&
    court?.active &&
    !court.final &&
    !busy &&
    (knockout
      ? Math.max(...score) === 10 &&
        Math.min(...score) < 10
      : state.timerStarted && score[0] !== score[1])
  );

  function requestFinalize() {
    if (!canFinalize) return;

    setDialog({
      type: "finalize",
      title: "Confirm Final Result",
      description:
        `Final score: ${score[0]} – ${score[1]}. `,
      button: "Confirm Result",
    });
  }

  function requestReopen() {
    setDialog({
      type: "reopen",
      title: "Reopen This Match?",
      description:
        "The confirmed result will be removed and " +
        "scoring will be editable again, provided the " +
        "next tournament stage has not loaded.",
      button: "Reopen Match",
    });
  }

  async function acceptDialog() {
    if (!dialog) return;

    const event =
      dialog.type === "finalize"
        ? "score:finalize"
        : "score:reopen";

    const success = await action(event);

    if (success) {
      setDialog(null);
      setNotice(
        event === "score:finalize"
          ? "Final result confirmed."
          : "Match reopened."
      );
    }
  }

  return (
    <main className="ar-referee">
      <style>{styles}</style>

      <div className="ar-wrap">
        <header className="ar-header">
          <div className="ar-brand">
            <img src="/ap-logo.png" alt="AP" />

            <div>
              <h1>POWERFUL SUMMER DUBAI</h1>
              <span>OFFICIAL REFEREE SCORING</span>
            </div>
          </div>

          <div className="ar-status">
            <i />
            {connected ? "LIVE" : "OFFLINE"}
          </div>
        </header>

        <section className="ar-meta">
          <div>
            <h2>
              COURT {String(courtId).padStart(2, "0")}
            </h2>
            <p>{stageLabel(state)}</p>
          </div>

          {state.stage === "groups" ? (
            <DigitalClock
              timer={state.timer}
              phase={state.phase}
            />
          ) : (
            <div className="ar-note" style={{ margin: 0 }}>
              FIRST TO 10
            </div>
          )}
        </section>

        {error && (
          <div className="ar-note ar-error" role="alert">
            {error}
          </div>
        )}

        {notice && (
          <div className="ar-note" role="status">
            {notice}
          </div>
        )}

        {!token ? (
          <section className="ar-login">
            <span className="ar-team-label">
              SECURE SCORING
            </span>

            <h2>Referee Login</h2>

            <form onSubmit={login}>
              <input
                className="ar-input"
                type="password"
                placeholder="Coach password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />

              <button
                className="ar-btn"
                disabled={busy || !connected}
              >
                {busy ? "Logging in..." : "LOGIN"}
              </button>
            </form>
          </section>
        ) : !court?.active ? (
          <div className="ar-note">
            No match scheduled on this court.
          </div>
        ) : (
          <>
            {state.awaitingStart && (
              <div className="ar-note">
                Waiting for the coach to start the
                group-stage timer.
              </div>
            )}

            {state.timeExpired && !court.final && (
              <div className="ar-note">
                Time is up. Confirm the final score.
                If tied, award a deciding point.
              </div>
            )}

            {knockoutFinished && !court.final && (
              <div className="ar-note">
                A team has reached 10 points.
                Confirm the winning result.
              </div>
            )}

            <section className="ar-grid">
              {[0, 1].map((side) => (
                <article
                  className={`ar-team ${
                    court.final &&
                    court.score.winner === side
                      ? "winner"
                      : ""
                  }`}
                  key={side}
                >
                  <span className="ar-team-label">
                    TEAM {side + 1}
                  </span>

                  <div className="ar-team-names">
                    {names(side).map((name, index) => (
                      <strong key={`${side}-${index}`}>
                        {name}
                      </strong>
                    ))}
                  </div>

                  <strong className="ar-score">
                    {score[side]}
                  </strong>

                  <button
                    className="ar-btn"
                    disabled={!canScore}
                    onClick={() =>
                      action("score:point", { team: side })
                    }
                  >
                    +1 POINT
                  </button>
                </article>
              ))}
            </section>

            <div className="ar-controls">
              <button
                className="ar-btn secondary"
                disabled={
                  !connected ||
                  busy ||
                  !token ||
                  !court.active ||
                  court.final ||
                  (state.stage === "groups" &&
                    !state.timerStarted)
                }
                onClick={() => action("score:undo")}
              >
                Undo Last Point
              </button>

              {court.final ? (
                <button
                  className="ar-btn secondary"
                  disabled={busy || !connected}
                  onClick={requestReopen}
                >
                  Reopen Result
                </button>
              ) : (
                <button
                  className="ar-btn"
                  disabled={!canFinalize}
                  onClick={requestFinalize}
                >
                  CONFIRM FINAL RESULT
                </button>
              )}
            </div>

            {court.final && (
              <div className="ar-note">
                Final result confirmed. Winning team:{" "}
                <strong>
                  {names(court.score.winner).join(" & ")}
                </strong>
              </div>
            )}

            {!knockout &&
              !court.final &&
              score[0] === score[1] && (
                <div className="ar-note">
                  A tied score cannot be confirmed.
                </div>
              )}
          </>
        )}
      </div>

      <ConfirmationDialog
        dialog={dialog}
        busy={busy}
        onCancel={() => setDialog(null)}
        onConfirm={acceptDialog}
      />
    </main>
  );
}