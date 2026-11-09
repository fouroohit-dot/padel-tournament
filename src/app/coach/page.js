
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import useTournament, {
    getCoachToken,
    saveCoachToken,
    clearCoachToken,
    sendTournamentEvent,
    stageLabel,
    playerName,
} from "@/lib/useTournament";

import {
    BroadcastStyles,
    DigitalClock,
} from "@/app/components/TournamentBroadcast";

import QuarterfinalDraw from "./QuarterfinalDraw";

const css = `
  .ap-coach {
    min-height:100vh;
    background:radial-gradient(ellipse at top,#557272,#446463 55%,#395958);
    color:#e4e2db;
    font-family:"Helvetica Neue LT Pro","Helvetica Neue",Helvetica,Arial,sans-serif;
    font-weight:300;
  }
  .ap-coach * { box-sizing:border-box; }
  .ap-coach button,.ap-coach input,.ap-coach select {
    font:inherit;
  }
  .ap-coach button {
    cursor:pointer;
    transition:background .15s,border-color .15s;
  }
  .ap-coach button:disabled {
    opacity:.45;
    cursor:not-allowed;
  }
  .ap-coach h1,.ap-coach h2,.ap-coach h3 {
    margin:0;
    font-weight:500;
    color:#e4e2db;
  }
  .ap-coach a { color:#e2cfa5; }
  .ac-wrap {
    width:100%;
    max-width:1700px;
    margin:auto;
    padding:22px clamp(15px,3vw,46px) 42px;
  }
  .ac-header {
    display:flex;
    align-items:center;
    justify-content:space-between;
    flex-wrap:wrap;
    gap:20px;
    padding-bottom:22px;
    border-bottom:1px solid rgba(212,183,120,.48);
  }
  .ac-brand {
    display:flex;
    gap:16px;
    align-items:center;
    min-width:0;
  }
  .ac-brand img {
    width:48px;
    height:58px;
    object-fit:contain;
  }
  .ac-brand h1 {
    font-size:clamp(23px,2.4vw,36px);
    letter-spacing:.05em;
    line-height:1.1;
  }
  .ac-brand p {
    margin:7px 0 0;
    color:#d4b778;
    font-size:12px;
    letter-spacing:.05em;
  }
  .ac-header-right {
    display:flex;
    flex-wrap:wrap;
    gap:10px;
    align-items:center;
  }
  .ac-online {
    display:inline-flex;
    align-items:center;
    gap:8px;
    padding:9px 12px;
    border:1px solid rgba(213,220,220,.3);
    font-size:11px;
  }
  .ac-online i {
    display:block;
    width:7px;height:7px;
    border-radius:50%;
    background:#d5dcdc;
  }
  .ac-btn {
    display:inline-flex;
    align-items:center;
    justify-content:center;
    gap:8px;
    padding:12px 17px;
    border:1px solid #d4b778;
    border-radius:3px;
    background:#d4b778;
    color:#294a49;
    font-weight:500 !important;
    text-decoration:none;
    text-align:center;
    min-height:44px;
  }
  .ac-btn.secondary {
    border-color:rgba(213,220,220,.4);
    background:rgba(213,220,220,.08);
    color:#e4e2db;
  }
  .ac-btn.danger {
    border-color:#be8980;
    background:rgba(130,62,55,.24);
    color:#ffe1dc;
  }
  .ac-eyebrow {
    display:block;
    font-size:11px;
    font-weight:500;
    letter-spacing:.05em;
    color:#e2cfa5;
    margin-bottom:9px;
  }
  .ac-heading {
    display:flex;
    justify-content:space-between;
    align-items:flex-end;
    flex-wrap:wrap;
    gap:16px;
    margin:25px 0 20px;
  }
  .ac-heading h2 {
    font-size:clamp(28px,3vw,43px);
  }
  .ac-heading p {
    color:#d5dcdc;
    margin:8px 0 0;
    max-width:760px;
    line-height:1.5;
  }
  .ac-panel {
    min-width:0;
    padding:20px;
    border:1px solid rgba(213,220,220,.28);
    border-top:2px solid rgba(212,183,120,.45);
    background:linear-gradient(145deg,rgba(85,114,114,.62),rgba(57,89,88,.65));
  }
  .ac-panel h3 {
    font-size:20px;
    margin-bottom:12px;
  }
  .ac-panel p {
    margin:0 0 14px;
    line-height:1.5;
    color:#d5dcdc;
  }
  .ac-grid {
    display:grid;
    grid-template-columns:repeat(3,minmax(0,1fr));
    gap:15px;
  }
  .ac-kpis {
    display:grid;
    grid-template-columns:repeat(3,minmax(0,1fr));
    gap:15px;
    margin-bottom:19px;
  }
  .ac-kpi {
    padding:18px 20px;
    border:1px solid rgba(213,220,220,.26);
    background:rgba(57,89,88,.36);
  }
  .ac-kpi small {
    display:block;
    margin-bottom:9px;
    font-size:10px;
    color:#d5dcdc;
    letter-spacing:.05em;
    font-weight:500;
  }
  .ac-kpi strong {
    color:#e2cfa5;
    font-size:clamp(23px,2.4vw,35px);
    font-weight:500;
  }
  .ac-tabs {
    display:flex;
    gap:9px;
    flex-wrap:wrap;
    margin:0 0 18px;
  }
  .ac-tabs button {
    padding:12px 24px;
    background:rgba(213,220,220,.09);
    color:#e4e2db;
    border:1px solid rgba(213,220,220,.3);
    font-weight:500;
  }
  .ac-tabs button.selected {
    background:#d4b778;
    color:#294a49;
    border-color:#d4b778;
  }
  .ac-input {
    width:100%;
    min-width:0;
    min-height:42px;
    padding:10px;
    border:1px solid #809595;
    background:#395958;
    color:#fff;
    border-radius:2px;
  }
  .ac-roster {
    display:grid;
    grid-template-columns:repeat(3,minmax(0,1fr));
    gap:10px;
  }
.ac-edit-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 75px;
  gap: 8px;
  align-items: center;
  padding: 9px;
  border: 1px solid rgba(213, 220, 220, .18);
  background: rgba(0, 0, 0, .055);
}
  .ac-edit-row .ac-btn {
    padding:9px 5px;
    min-height:42px;
    font-size:12px;
  }
  .ac-team {
    margin-top:15px;
    padding-top:13px;
    border-top:1px solid rgba(213,220,220,.2);
  }
  .ac-team-label {
    display:block;
    font-weight:500;
    color:#e2cfa5;
    margin-bottom:9px;
    font-size:12px;
  }
  .ac-selects {
    display:grid;
    grid-template-columns:repeat(2,minmax(0,1fr));
    gap:8px;
  }
  .ac-notice {
    margin:17px 0;
    padding:12px 15px;
    border-left:3px solid #d4b778;
    background:rgba(212,183,120,.08);
    color:#e4e2db;
    line-height:1.5;
  }
  .ac-notice.error {
    border-left-color:#ff9d92;
    color:#ffe0dc;
  }
  .ac-live-top {
    display:grid;
    grid-template-columns:minmax(0,1fr) 235px;
    gap:16px;
    align-items:stretch;
  }
  .ac-ready-title {
    font-size:clamp(25px,3vw,39px) !important;
    margin:5px 0 12px !important;
  }
  .ac-ready-state {
    color:#e2cfa5;
    font-size:18px;
    font-weight:500;
  }
  .ac-live-clock {
    display:flex;
    align-items:center;
    justify-content:center;
  }
  .ac-live-clock .nt-clock {
    width:100%;
    min-width:0;
    max-width:none;
  }
  .ac-court-line {
    display:flex;
    justify-content:space-between;
    align-items:center;
    gap:12px;
    border-bottom:1px solid rgba(213,220,220,.2);
    padding:12px 0;
  }
  .ac-court-line:last-child { border-bottom:0; }
  .ac-court-line span {
    color:#e2cfa5;
    font-weight:500;
    white-space:nowrap;
  }
  .ac-court-line small { color:#d5dcdc; }
  .ac-links {
    display:flex;
    flex-wrap:wrap;
    gap:10px;
    margin:16px 0;
  }
  .ac-links a { text-decoration:none; }
  .ac-danger-zone {
    margin-top:45px;
    border-top:1px solid rgba(213,220,220,.3);
    padding-top:20px;
  }
  .ac-overlay {
    position:fixed;
    inset:0;
    z-index:1000;
    display:flex;
    align-items:center;
    justify-content:center;
    padding:18px;
    background:rgba(12,31,30,.78);
    backdrop-filter:blur(5px);
  }
  .ac-dialog {
    width:min(100%,480px);
    padding:26px;
    background:#446463;
    border:1px solid #d4b778;
    box-shadow:0 22px 80px rgba(0,0,0,.35);
  }
  .ac-dialog h2 {
    font-size:27px;
    margin:0 0 14px;
  }
  .ac-dialog p {
    line-height:1.6;
    margin-bottom:20px;
    color:#d5dcdc;
  }
  .ac-dialog-actions {
    display:flex;
    gap:10px;
    justify-content:flex-end;
    flex-wrap:wrap;
  }
  .ac-dialog-actions .ac-btn { flex:1 1 140px; }
  .ac-login {
    max-width:460px;
    margin:60px auto;
  }
  @media(max-width:1100px) {
    .ac-grid,.ac-roster {
      grid-template-columns:repeat(2,minmax(0,1fr));
    }
  }
  @media(max-width:700px) {
    .ac-grid,.ac-roster,.ac-kpis,.ac-live-top {
      grid-template-columns:1fr;
    }
    .ac-panel { padding:15px; }
    .ac-header { align-items:flex-start; }
    .ac-brand img { width:38px; }
    .ac-heading { margin-top:18px; }
    .ac-edit-row {
  grid-template-columns: minmax(0, 1fr) 75px;
}
    .ac-tabs button { flex:1; }
    .ac-live-clock .nt-clock { max-width:220px; }
  }
`;

function PlayerEditor({ player, onSave, busy }) {
    const [name, setName] = useState(player.name);

    useEffect(() => {
        setName(player.name);
    }, [player.name]);

    const changed = name.trim() !== player.name;

    return (
        <div className="ac-edit-row">
            <input
                className="ac-input"
                aria-label={`Player name ${player.id}`}
                value={name}
                maxLength={80}
                onChange={(e) => setName(e.target.value)}
                placeholder="Player full name"
            />

            <button
                className="ac-btn"
                disabled={busy || !changed || !name.trim()}
                onClick={() => onSave(player.id, name)}
            >
                Save
            </button>
        </div>
    );
}

function ConfirmDialog({ dialog, onClose, onConfirm, busy }) {
    if (!dialog) return null;

    return (
        <div className="ac-overlay">
            <div
                className="ac-dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby="ac-dialog-title"
            >
                <span className="ac-eyebrow">
                    TOURNAMENT CONTROL
                </span>

                <h2 id="ac-dialog-title">{dialog.title}</h2>
                <p>{dialog.description}</p>

                <div className="ac-dialog-actions">
                    <button
                        className="ac-btn secondary"
                        onClick={onClose}
                        disabled={busy}
                    >
                        Cancel
                    </button>

                    <button
                        className={`ac-btn ${dialog.danger ? "danger" : ""}`}
                        onClick={onConfirm}
                        disabled={busy}
                    >
                        {busy ? "Processing..." : dialog.confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function CoachDashboard() {
    const { state, connected } = useTournament();

    const [token, setToken] = useState("");
    const [password, setPassword] = useState("");
    const [group, setGroup] = useState("A");

    const [busy, setBusy] = useState(false);
    const [notice, setNotice] = useState("");
    const [error, setError] = useState("");
    const [dialog, setDialog] = useState(null);

    useEffect(() => {
        setToken(getCoachToken());
    }, []);

    async function run(event, payload = {}) {
        setBusy(true);
        setError("");
        setNotice("");

        try {
            await sendTournamentEvent(event, payload);
            setNotice("Changes saved successfully.");
            return true;
        } catch (e) {
            setError(e.message);

            if (/unauthorized/i.test(e.message)) {
                clearCoachToken();
                setToken("");
            }

            return false;
        } finally {
            setBusy(false);
        }
    }

    async function login(e) {
        e.preventDefault();
        setBusy(true);
        setError("");

        try {
            const result = await sendTournamentEvent(
                "coach:login",
                { password },
                false
            );

            saveCoachToken(result.token);
            setToken(result.token);
            setPassword("");
        } catch (e) {
            setError(e.message);
        } finally {
            setBusy(false);
        }
    }

    function logout() {
        clearCoachToken();
        setToken("");
    }

    function confirmAction(type) {
        const dialogs = {
            tournament: {
                title: "Begin the tournament?",
                description: ``,
                confirmLabel: "Load Group A",
                event: "tournament:start",
            },

            timer: {
                title: `Start ${stageLabel(state)}?`,
                description: ``,
                confirmLabel: "Start Match",
                event: "timer:start",
                payload: { matchKey: state.matchKey },
            },

            reset: {
                title: "Reset the entire tournament?",
                description:
                    "This action cannot be undone.",
                confirmLabel: "Reset Tournament",
                danger: true,
                event: "tournament:reset",
            },
        };

        setDialog(dialogs[type]);
    }

    async function acceptDialog() {
        if (!dialog) return;

        const success = await run(
            dialog.event,
            dialog.payload || {}
        );

        if (success) setDialog(null);
    }

    return (
        <main className="ap-coach new-tourney">
            <BroadcastStyles />
            <style>{css}</style>

            <div className="ac-wrap">
                <header className="ac-header">
                    <div className="ac-brand">
                        <img src="/ap-logo.png" alt="AP" />
                        <div>
                            <h1>POWERFUL SUMMER DUBAI</h1>
                        </div>
                    </div>

                    <div className="ac-header-right">
                        <span className="ac-online">
                            <i />
                            {connected ? "CONNECTED" : "RECONNECTING"}
                        </span>

                        {token && (
                            <button className="ac-btn secondary" onClick={logout}>
                                Logout
                            </button>
                        )}
                    </div>
                </header>

                {error && (
                    <div className="ac-notice error" role="alert">
                        {error}
                    </div>
                )}

                {notice && (
                    <div className="ac-notice" role="status">
                        {notice}
                    </div>
                )}

                {!token ? (
                    <section className="ac-panel ac-login">
                        <span className="ac-eyebrow">SECURE ACCESS</span>
                        <h2>Coach Login</h2>
                        <p>Enter the tournament control password.</p>

                        <form onSubmit={login}>
                            <input
                                className="ac-input"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Coach password"
                                required
                            />

                            <button
                                className="ac-btn"
                                style={{ width: "100%", marginTop: 13 }}
                                disabled={busy || !connected}
                            >
                                {busy ? "Connecting..." : "Login"}
                            </button>
                        </form>
                    </section>
                ) : !state ? (
                    <div className="ac-notice">
                        Connecting to tournament state...
                    </div>
                ) : (
                    <>
                        <div className="ac-links">
                            <Link className="ac-btn secondary" href="/" target="_blank">
                                Spectator Screen
                            </Link>

                            <Link
                                className="ac-btn secondary"
                                href="/view/players"
                                target="_blank"
                            >
                                Player Rankings
                            </Link>

                            <Link
                                className="ac-btn secondary"
                                href="/view/bracket"
                                target="_blank"
                            >
                                Knockout Bracket
                            </Link>
                        </div>

                        {state.phase === "setup" ? (
                            <>
                                <section className="ac-heading">
                                    <div>
                                        <span className="ac-eyebrow">
                                            PRE-TOURNAMENT SETUP
                                        </span>

                                        <h2>Players & Court Assignments</h2>

                                        <p>
                                            Edit the three groups independently. All
                                            partnerships will remain fixed throughout
                                            the four group rounds.
                                        </p>
                                    </div>
                                </section>

                                <div className="ac-kpis">
                                    {["A", "B", "C"].map((g) => {
                                        const ids = state.groups[g].courts
                                            .flatMap((court) => court.teams.flat())
                                            .filter(Boolean);

                                        return (
                                            <div className="ac-kpi" key={g}>
                                                <small>GROUP {g} · ASSIGNED PLAYERS</small>
                                                <strong>{ids.length} / 24</strong>
                                            </div>
                                        );
                                    })}
                                </div>

                                <div className="ac-tabs">
                                    {["A", "B", "C"].map((g) => (
                                        <button
                                            key={g}
                                            className={group === g ? "selected" : ""}
                                            onClick={() => setGroup(g)}
                                        >
                                            GROUP {g}
                                        </button>
                                    ))}
                                </div>

                                <section className="ac-heading">
                                    <div>
                                        <span className="ac-eyebrow">
                                            GROUP {group}
                                        </span>
                                        <h2>Player Roster</h2>
                                        <p>
                                            Add names.
                                        </p>
                                    </div>
                                </section>

                                <div className="ac-roster">
                                    {state.groups[group].players.map((player) => (
                                        <PlayerEditor
                                            key={player.id}
                                            player={player}
                                            busy={busy}
                                            onSave={(playerId, name) =>
                                                run("player:update", {
                                                    playerId,
                                                    name,
                                                })
                                            }
                                        />
                                    ))}
                                </div>

                                <section className="ac-heading">
                                    <div>
                                        <span className="ac-eyebrow">
                                            FIXED PARTNERSHIPS
                                        </span>
                                        <h2>Starting Courts</h2>
                                        <p>
                                            Each court holds two teams of two. Selecting
                                            a player already assigned elsewhere moves
                                            them to the new slot.
                                        </p>
                                    </div>
                                </section>

                                <div className="ac-grid">
                                    {state.groups[group].courts.map((court) => (
                                        <section className="ac-panel" key={court.id}>
                                            <h3>
                                                COURT {String(court.id).padStart(2, "0")}
                                            </h3>

                                            {[0, 1].map((team) => (
                                                <div className="ac-team" key={team}>
                                                    <span className="ac-team-label">
                                                        TEAM {team + 1}
                                                    </span>

                                                    <div className="ac-selects">
                                                        {[0, 1].map((slot) => (
                                                            <select
                                                                className="ac-input"
                                                                key={slot}
                                                                disabled={busy}
                                                                value={court.teams[team][slot] || ""}
                                                                onChange={(e) =>
                                                                    run("court:assign", {
                                                                        group,
                                                                        courtId: court.id,
                                                                        team,
                                                                        slot,
                                                                        playerId: e.target.value || null,
                                                                    })
                                                                }
                                                            >
                                                                <option value="">Unassigned</option>

                                                                {state.groups[group].players.map(
                                                                    (p) => (
                                                                        <option key={p.id} value={p.id}>
                                                                            {p.name}
                                                                        </option>
                                                                    )
                                                                )}
                                                            </select>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </section>
                                    ))}
                                </div>

                                <section className="ac-panel" style={{ marginTop: 23 }}>
                                    <span className="ac-eyebrow">
                                        READY TO BEGIN
                                    </span>
                                    <h3>Start the Tournament</h3>

                                    <p>
                                        The tournament begins with Group A, Round 1.
                                        The timer stays paused until you press
                                        Start Match.
                                    </p>

                                    <button
                                        className="ac-btn"
                                        disabled={busy || !connected}
                                        onClick={() => confirmAction("tournament")}
                                    >
                                        Load Group A · Round 1
                                    </button>
                                </section>
                            </>
                        ) : (
                            <>
                                {/* <section className="ac-heading">
                                    <div>
                                        <h2>{stageLabel(state)}</h2>
                                    </div>
                                </section> */}

                                {state.stage === "quarterfinals" && (
                                    <QuarterfinalDraw
                                        state={state}
                                        connected={connected}
                                    />
                                )}

                                <div className="ac-kpis">
                                    <div className="ac-kpi">
                                        <small>ACTIVE STAGE</small>
                                        <strong>{stageLabel(state)}</strong>
                                    </div>

                                    <div className="ac-kpi">
                                        <small>CONFIRMED COURTS</small>
                                        <strong>
                                            {state.confirmedCount} / {state.activeMatchCount}
                                        </strong>
                                    </div>

                                    <div className="ac-kpi">
                                        <small>TOURNAMENT STATUS</small>
                                        <strong>
                                            {state.phase === "complete"
                                                ? "COMPLETE"
                                                : state.awaitingStart
                                                    ? "READY"
                                                    : state.timeExpired
                                                        ? "TIME UP"
                                                        : "IN PLAY"}
                                        </strong>
                                    </div>
                                </div>

                                <div className="ac-live-top">
                                    <section className="ac-panel">
                                        <span className="ac-eyebrow">
                                            MATCH CONTROL
                                        </span>

                                        <h2 className="ac-ready-title">
                                            {state.phase === "complete"
                                                ? "Tournament Complete"
                                                : state.awaitingStart
                                                    ? "Next Match Ready"
                                                    : state.timeExpired
                                                        ? "Awaiting Court Confirmations"
                                                        : state.stage !== "groups"
                                                            ? "Knockout Match in Progress"
                                                            : "Match in Progress"}
                                        </h2>

                                        {state.phase === "live" &&
                                            state.awaitingStart ? (
                                            <>
                                                <p>
                                                    {stageLabel(state)} is now displayed
                                                    on all six court screens.
                                                    Start the countdown when the
                                                    players are ready.
                                                </p>

                                                <button
                                                    className="ac-btn"
                                                    disabled={busy || !connected}
                                                    onClick={() => confirmAction("timer")}
                                                    style={{ minWidth: 210 }}
                                                >
                                                    START MATCH · 10:00
                                                </button>
                                            </>
                                        ) : state.phase === "live" &&
                                            state.timeExpired ? (
                                            <p>
                                                Time has expired. Confirm all remaining
                                                scores to load the next stage.
                                            </p>
                                        ) : state.phase === "live" ? (
                                            <p>
                                                Match clock running. Referees can score
                                                on their assigned court devices.
                                            </p>
                                        ) : (
                                            <p>
                                                All final results have been recorded.
                                                View the bracket for final placements.
                                            </p>
                                        )}
                                    </section>


                                    <div className="ac-panel ac-live-clock">
                                        {state.stage === "groups" ? (
                                            <DigitalClock
                                                timer={state.timer}
                                                phase={state.phase}
                                            />
                                        ) : (
                                            <div
                                                style={{
                                                    textAlign: "center",
                                                    width: "100%",
                                                }}
                                            >
                                                <span className="ac-eyebrow">
                                                    KNOCKOUT SCORING
                                                </span>

                                                <strong
                                                    style={{
                                                        display: "block",
                                                        color: "#e2cfa5",
                                                        fontSize: "clamp(27px, 3vw, 40px)",
                                                        fontWeight: 500,
                                                        lineHeight: 1.15,
                                                    }}
                                                >
                                                    FIRST TO 10
                                                </strong>

                                                <p style={{ marginTop: 10 }}>
                                                    No match timer
                                                </p>
                                            </div>
                                        )}
                                    </div>

                                </div>

                                <section className="ac-heading">
                                    <div>
                                        <span className="ac-eyebrow">
                                            COURT MANAGEMENT
                                        </span>
                                        <h2>Match Confirmation Status</h2>
                                    </div>
                                </section>

                                <div className="ac-grid">
                                    {state.courts.map((court) => (
                                        <section className="ac-panel" key={court.id}>
                                            <span className="ac-eyebrow">
                                                COURT {String(court.id).padStart(2, "0")}
                                            </span>

                                            {court.active ? (
                                                <>
                                                    {[0, 1].map((side) => (
                                                        <div className="ac-court-line" key={side}>
                                                            <small>
                                                                {(court.teams[side] || [])
                                                                    .map((id) =>
                                                                        playerName(state.players, id)
                                                                    )
                                                                    .join(" / ")}
                                                            </small>

                                                            <span>
                                                                {court.score.points[side]}
                                                            </span>
                                                        </div>
                                                    ))}

                                                    <div className="ac-court-line">
                                                        <strong>
                                                            {court.final
                                                                ? "FINAL CONFIRMED"
                                                                : state.awaitingStart
                                                                    ? "AWAITING START"
                                                                    : "IN PROGRESS"}
                                                        </strong>
                                                    </div>

                                                    <Link
                                                        className="ac-btn secondary"
                                                        href={`/coach/court/${court.id}`}
                                                        target="_blank"
                                                        style={{ width: "100%", marginTop: 13 }}
                                                    >
                                                        Open Referee Screen
                                                    </Link>
                                                </>
                                            ) : (
                                                <p>No scheduled match this stage.</p>
                                            )}
                                        </section>
                                    ))}
                                </div>
                            </>
                        )}

                        <section className="ac-danger-zone">
                            <span className="ac-eyebrow">
                                RESET
                            </span>

                            <button
                                className="ac-btn danger"
                                disabled={busy}
                                onClick={() => confirmAction("reset")}
                            >
                                Reset Entire Tournament
                            </button>
                        </section>
                    </>
                )}
            </div>

            <ConfirmDialog
                dialog={dialog}
                busy={busy}
                onClose={() => setDialog(null)}
                onConfirm={acceptDialog}
            />
        </main>
    );
}
