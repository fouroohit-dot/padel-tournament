
"use client";

import { useEffect, useState } from "react";
import {
  formatClock,
  timeRemaining,
  stageLabel,
  playerName,
} from "@/lib/useTournament";

const C = {
  primary: "#446463",
  mineral: "#e4e2db",
  green80: "#557272",
  green60: "#809595",
  green40: "#AAB9B9",
  green20: "#D5DCDC",
  gold: "#d4b778",
  goldLight: "#e2cfa5",
};

export function DigitalClock({ timer, phase }) {
  const [now, setNow] = useState(null);

  useEffect(() => {
    const update = () => setNow(Date.now());
    update();

    const interval = window.setInterval(update, 250);
    return () => window.clearInterval(interval);
  }, []);

  const started = timer?.startedAt != null;
  const remaining =
  now === null
    ? timer?.durationMs ?? 10 * 60 * 1000
    : timeRemaining(timer, now);

  const caption =
    phase === "complete"
      ? "Tournament complete"
      : !started
      ? "Awaiting coach"
      : remaining === 0
      ? "Awaiting final results"
      : "Time remaining";

  return (
    <div
      className="nt-clock"
      role="timer"
      aria-label={`Match time ${formatClock(remaining)}`}
    >
      <span>MATCH TIME</span>

      <strong aria-live="off">
        {formatClock(remaining)}
      </strong>

      <em>{caption}</em>
    </div>
  );
}

export function Partners() {
  return (
    <div className="nt-partners">
      <span>OFFICIAL PARTNERS</span>

      <div className="nt-partner-images">
        <img src="/premier-padel.png" alt="Premier Padel" />

        <i aria-hidden="true" />

        <img
          src="/international-padel-federation-white.png"
          alt="International Padel Federation"
        />
      </div>
    </div>
  );
}


export function BroadcastHeader({ state, connected }) {
    const groupStage = state?.stage === "groups";
    const knockoutStage =
      state?.stage === "quarterfinals" ||
      state?.stage === "semifinals" ||
      state?.stage === "finals";
  
    return (
      <header className="nt-header">
        <div className="nt-brand">
          <img src="/ap-logo.png" alt="AP Tournament" />
  
          <div>
            <h1>POWERFUL SUMMER DUBAI</h1>
            {/* <div className="nt-title-underline" /> */}
          </div>
        </div>
  
        <div className="nt-header-info">
          <div className="nt-stage">
            <small>
              {groupStage
                ? "CURRENT ROUND"
                : "CURRENT STAGE"}
            </small>
  
            <strong>
              {groupStage
                ? String(state.round).padStart(2, "0")
                : stageLabel(state)}
            </strong>
  
            {groupStage && (
              <span>GROUP {state.group}</span>
            )}
          </div>
  
          <div className="nt-connection">
            <span
              className={`nt-dot ${connected ? "live" : ""}`}
            />
            {connected ? "LIVE SCORES" : "RECONNECTING"}
          </div>
  
          {groupStage ? (
            <DigitalClock
              timer={state?.timer}
              phase={state?.phase}
            />
          ) : knockoutStage ? (
            <div className="nt-stage">
              <small>MATCH FORMAT</small>
              <strong>FIRST TO 10</strong>
            </div>
          ) : null}
        </div>
      </header>
    );
  }
  

export function CourtScoreboard({
  court,
  players,
  large = false,
}) {
  if (!court) return null;

  return (
    <article
      className={`nt-court ${
        large ? "nt-court-large" : ""
      }`}
    >
      <div className="nt-court-top">
        <h3>
          COURT {String(court.id).padStart(2, "0")}
        </h3>

        <span className={court.final ? "nt-final" : "nt-live"}>
          {court.final ? "FINAL" : "LIVE"}
        </span>
      </div>

      <div className="nt-score-head">
        <span>PLAYERS</span>
        <span>POINTS</span>
      </div>

      {[0, 1].map((side) => (
        <div
          key={side}
          className={`nt-score-team ${
            court.final && court.score?.winner === side
              ? "nt-winner"
              : ""
          }`}
        >
          <div className="nt-score-names">
            <small>TEAM {side + 1}</small>

            {(court.teams?.[side] || []).map(
              (id, index) => (
                <strong key={id || index}>
                  {playerName(players, id)}
                </strong>
              )
            )}
          </div>

          <strong className="nt-points">
            {court.score?.points?.[side] ?? 0}
          </strong>
        </div>
      ))}
    </article>
  );
}

export function BroadcastStyles() {
  return (
    <style>{`
      .new-tourney {
        --green: ${C.primary};
        --green-dark: ${C.primary};
        --green-mid: ${C.green80};
        --cream: ${C.mineral};
        --gold: ${C.gold};

        min-height: 100vh;
        min-height: 100dvh;
        width: 100%;

        background: radial-gradient(
          ellipse at 50% 0,
          ${C.green80} 0%,
          ${C.primary} 52%,
          #3d5c5b 100%
        );

        color: ${C.mineral};
        font-family:
          "Helvetica Neue LT Pro",
          "Helvetica Neue",
          Helvetica, Arial, sans-serif;
        font-weight: 300;
        letter-spacing: 0;
      }

      .new-tourney *,
      .new-tourney *::before,
      .new-tourney *::after {
        box-sizing: border-box;
      }

      .nt-container {
        width: 100%;
        max-width: 1900px;
        margin: 0 auto;
        padding: 15px clamp(16px,3vw,54px) 30px;
      }

      .nt-container.narrow {
        max-width: 1400px;
      }

      .nt-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 22px;

        width: 100%;
        min-height: 100px;

        padding: 0 0 14px;
        border-bottom: 1px solid rgba(212,183,120,.42);
      }

      .nt-brand {
        display: flex;
        align-items: center;
        gap: 13px;
        min-width: 0;
      }

      .nt-brand > img {
        display: block;
        flex: 0 0 45px;
        width: 45px;
        height: 57px;
        object-fit: contain;
      }

      .nt-brand h1 {
        margin: 0;
        font-size: clamp(22px,2.35vw,40px);
        font-weight: 500;
        line-height: 1.12;
        letter-spacing: .05em;
        color: ${C.mineral};
        overflow-wrap: break-word;
      }

      .nt-title-underline {
        width: 165px;
        max-width: 65%;
        height: 2px;
        margin-top: 9px;
        background: linear-gradient(
          90deg,${C.gold},transparent
        );
      }

      .nt-header-info {
        display: flex;
        align-items: center;
        gap: clamp(13px,2vw,27px);
        flex: 0 0 auto;
      }

      .nt-stage {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
        min-width: 93px;
        text-align: center;
      }

      .nt-stage small,
      .nt-stage span,
      .nt-connection,
      .nt-clock > span,
      .nt-partners > span,
      .nt-score-head,
      .nt-score-names small {
        font-size: 10px;
        font-weight: 500;
        letter-spacing: .05em;
      }

      .nt-stage small,
      .nt-stage span {
        color: ${C.green20};
      }

      .nt-stage strong {
        font-size: 27px;
        font-weight: 500;
        line-height: 1.1;
        color: ${C.goldLight};
        white-space: nowrap;
      }

      .nt-connection {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 7px;

        padding: 10px 12px;
        border: 1px solid rgba(213,220,220,.3);
        background: rgba(213,220,220,.08);
        white-space: nowrap;
      }

      .nt-dot {
        width: 7px;
        height: 7px;
        flex: 0 0 7px;
        border-radius: 50%;
        background: ${C.green60};
      }

      .nt-dot.live {
        background: ${C.green20};
        box-shadow: 0 0 8px rgba(213,220,220,.55);
      }

      /* Consistent clock across ALL public pages */

      .new-tourney .nt-clock {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;

        gap: 5px;

        flex: 0 0 180px;
        width: 180px;
        min-width: 180px;
        max-width: 180px;

        height: 92px;
        min-height: 92px;
        max-height: 92px;

        padding: 10px;
        margin: 0;

        border: 1px solid rgba(212,183,120,.48);
        border-radius: 3px;

        background: linear-gradient(
          135deg,
          rgba(213,220,220,.12),
          rgba(68,100,99,.16)
        );

        aspect-ratio: auto;
        transform: none;
        overflow: hidden;
      }

      .new-tourney .nt-clock > span {
        color: ${C.green20};
        line-height: 1.1;
        white-space: nowrap;
      }

      .new-tourney .nt-clock strong {
        display: block;
        width: 5ch;
        flex: 0 0 auto;

        font-size: 43px;
        font-weight: 500;
        line-height: 1;

        text-align: center;
        color: ${C.goldLight};
        white-space: nowrap;
        font-variant-numeric: tabular-nums;
        font-feature-settings: "tnum" 1;
        letter-spacing: 0;
      }

      .new-tourney .nt-clock em {
        display: block;
        font-family:
          "JHA Times Now",Georgia,serif;
        font-size: 11px;
        font-weight: 200;
        font-style: italic;
        line-height: 1.15;
        white-space: nowrap;
        color: ${C.mineral};
      }

      .nt-section-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 16px;
        margin: 21px 0;
      }

      .nt-section-head h2 {
        margin: 0 0 5px;
        color: ${C.mineral};
        font-size: clamp(30px,3vw,50px);
        font-weight: 500;
        line-height: 1.1;
      }

      .nt-section-head p {
        margin: 0;
        color: ${C.goldLight};
        font-family: "JHA Times Now",Georgia,serif;
        font-style: italic;
        font-size: 15px;
      }

      .nt-partners {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        flex: 0 1 auto;
        gap: 8px;
        min-width: 0;
      }

      .nt-partners > span {
        color: ${C.goldLight};
      }

      .nt-partner-images {
        display: flex;
        align-items: center;
        gap: clamp(12px,1.5vw,22px);
      }

      .nt-partner-images img {
        display: block;
        width: clamp(105px,11vw,175px);
        height: 60px;
        object-fit: contain;
      }

      .nt-partner-images i {
        flex: 0 0 1px;
        width: 1px;
        height: 39px;
        background: rgba(212,183,120,.4);
      }

      .nt-courts-grid {
        display: grid;
        grid-template-columns: repeat(3,minmax(0,1fr));
        gap: 13px;
      }

      .nt-court {
        min-width: 0;
        background: linear-gradient(
          155deg,
          ${C.green80},
          ${C.primary} 48%,
          #395958
        );
        border: 1px solid rgba(213,220,220,.3);
        border-top: 2px solid rgba(212,183,120,.45);
        border-radius: 3px;
        overflow: hidden;
      }

      .nt-court-top {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;

        padding: 15px;
        border-bottom: 1px solid rgba(213,220,220,.24);
        background: rgba(0,0,0,.07);
      }

      .nt-court-top h3 {
        margin: 0;
        color: ${C.mineral};
        font-size: clamp(23px,2vw,35px);
        font-weight: 500;
        line-height: 1.1;
      }

      .nt-live,
      .nt-final {
        padding: 6px 9px;
        font-size: 10px;
        font-weight: 500;
        letter-spacing: .05em;
        border: 1px solid rgba(213,220,220,.34);
      }

      .nt-final {
        background: ${C.gold};
        border-color: ${C.gold};
        color: ${C.primary};
      }

      .nt-score-head,
      .nt-score-team {
        display: grid;
        grid-template-columns: minmax(0,1fr) 90px;
        align-items: center;
        gap: 12px;
      }

      .nt-score-head {
        padding: 13px 15px;
        border-bottom: 1px solid rgba(213,220,220,.22);
        color: ${C.green20};
      }

      .nt-score-head span:last-child {
        text-align: center;
      }

      .nt-score-team {
        min-height: 112px;
        margin: 0 14px;
        padding: 17px 0;
      }

      .nt-score-team + .nt-score-team {
        border-top: 1px solid rgba(213,220,220,.25);
      }

      .nt-score-names {
        display: flex;
        flex-direction: column;
        gap: 3px;
        min-width: 0;
      }

      .nt-score-names small {
        display: block;
        color: ${C.green20};
        margin-bottom: 8px;
      }

      .nt-score-names strong {
        color: ${C.mineral};
        font-size: clamp(24px,2vw,35px);
        font-weight: 700;
        line-height: 1.12;
        overflow-wrap: anywhere;
      }

      .nt-winner .nt-score-names strong {
        color: ${C.goldLight};
      }

      .nt-points {
        color: ${C.gold};
        text-align: center;
        font-size: clamp(49px,4vw,75px);
        font-weight: 500;
        line-height: 1;
        font-variant-numeric: tabular-nums;
      }

      .nt-court-large .nt-score-team {
        min-height: clamp(170px,28vh,300px);
      }

      .nt-court-large .nt-score-names strong {
        font-size: clamp(36px,4.2vw,65px);
      }

      .nt-court-large .nt-points {
        font-size: clamp(78px,9vw,130px);
      }

      .nt-court-large .nt-score-head,
      .nt-court-large .nt-score-team {
        grid-template-columns:
          minmax(0,1fr)
          clamp(100px,13vw,185px);
      }

      .nt-empty {
        padding: 70px 20px;
        text-align: center;
        border: 1px solid rgba(213,220,220,.3);
        color: ${C.green20};
      }

      .nt-standby {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 16px;
        padding: 13px 16px;
        border-left: 3px solid ${C.gold};
        background: rgba(212,183,120,.085);
        color: ${C.mineral};
      }

      .nt-standby strong {
        color: ${C.goldLight};
        font-weight: 500;
      }

      .nt-leader-grid {
        display: grid;
        grid-template-columns: repeat(2,minmax(0,1fr));
        gap: 18px;
      }

      .nt-leader-col {
        border: 1px solid rgba(213,220,220,.28);
        min-width: 0;
      }

      .nt-leader-row {
        display: grid;
        grid-template-columns:
          35px minmax(0,1fr) 65px 44px 44px;
        align-items: center;
        gap: 8px;

        min-height: 56px;
        padding: 8px 12px;

        border-bottom: 1px solid rgba(213,220,220,.21);
        background: rgba(128,149,149,.13);
      }

      .nt-leader-row:nth-child(even) {
        background: rgba(68,100,99,.3);
      }

      .nt-leader-row strong {
        font-size: clamp(18px,1.5vw,28px);
        font-weight: 700;
        line-height: 1.1;
        overflow-wrap: anywhere;
      }

      .nt-rank,
      .nt-rating {
        color: ${C.goldLight};
        font-weight: 500;
      }

      .nt-rating {
        font-size: 24px;
        text-align: center;
      }

      .nt-stat {
        font-size: 21px;
        font-variant-numeric: tabular-nums;
        text-align: center;
      }

      .nt-tabs {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin: 8px 0 18px;
      }

      .nt-tabs button {
        padding: 10px 17px;
        border: 1px solid rgba(213,220,220,.3);
        background: rgba(213,220,220,.085);
        color: ${C.mineral};
        font: inherit;
        font-weight: 500;
        cursor: pointer;
      }

      .nt-tabs button.selected {
        background: ${C.gold};
        border-color: ${C.gold};
        color: ${C.primary};
      }

      @media (max-width: 1100px) {
        .nt-header {
          flex-wrap: wrap;
        }

        .nt-header-info {
          margin-left: auto;
        }

        .nt-courts-grid {
          grid-template-columns: repeat(2,minmax(0,1fr));
        }
      }

      @media (max-width: 700px) {
        .nt-header {
          gap: 15px;
        }

        .nt-brand h1 {
          font-size: clamp(20px,5vw,27px);
        }

        .nt-header-info {
          width: 100%;
          flex-wrap: wrap;
          justify-content: space-between;
          gap: 12px;
        }

        .nt-stage {
          min-width: 75px;
        }

        .nt-connection {
          font-size: 9px;
        }

        .new-tourney .nt-clock {
          flex-basis: 155px;
          width: 155px;
          min-width: 155px;
          max-width: 155px;
          height: 86px;
          min-height: 86px;
          max-height: 86px;
        }

        .new-tourney .nt-clock strong {
          font-size: 36px;
        }

        .nt-section-head {
          align-items: flex-start;
        }

        .nt-partners {
          align-items: flex-start;
        }

        .nt-courts-grid,
        .nt-leader-grid {
          grid-template-columns: 1fr;
        }

        .nt-leader-row {
          grid-template-columns:
            27px minmax(0,1fr) 47px 30px 30px;
          gap: 5px;
          padding: 8px;
        }

        .nt-leader-row strong {
          font-size: 18px;
        }

        .nt-rating {
          font-size: 19px;
        }

        .nt-stat {
          font-size: 17px;
        }

        .nt-court-large .nt-score-names strong {
          font-size: clamp(27px,6vw,43px);
        }

        .nt-court-large .nt-points {
          font-size: clamp(52px,12vw,85px);
        }

        .nt-court-large .nt-score-head,
        .nt-court-large .nt-score-team {
          grid-template-columns:
            minmax(0,1fr) 85px;
        }

        .nt-standby {
          flex-direction: column;
          align-items: flex-start;
        }
      }

      @media (max-width: 390px) {
        .nt-brand > img {
          width: 35px;
          flex-basis: 35px;
        }

        .nt-partner-images img {
          width: 105px;
          height: 48px;
        }

        .nt-partner-images {
          gap: 12px;
        }
      }
    `}</style>
  );
}
