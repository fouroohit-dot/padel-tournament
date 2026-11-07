
"use client";

import { useParams } from "next/navigation";

import useTournament, {
  stageLabel,
} from "@/lib/useTournament";

import {
  BroadcastHeader,
  BroadcastStyles,
  Partners,
  CourtScoreboard,
} from "@/app/components/TournamentBroadcast";

export default function CourtViewClient() {
  const params = useParams();
  const courtId = Number(params?.id);

  const { state, connected } = useTournament();

  if (
    !Number.isInteger(courtId) ||
    courtId < 1 ||
    courtId > 6
  ) {
    return (
      <main
        style={{
          minHeight: "100vh",
          padding: 30,
          background: "#446463",
          color: "#e4e2db",
        }}
      >
        Court not found.
      </main>
    );
  }

  if (!state) {
    return (
      <main
        style={{
          minHeight: "100vh",
          padding: 30,
          background: "#446463",
          color: "#e4e2db",
        }}
      >
        Connecting to Court {courtId}...
      </main>
    );
  }

  const court = state.courts.find(
    (c) => c.id === courtId
  );

  return (
    <main className="new-tourney">
      <BroadcastStyles />

      <style>{`
        .ipad-court-layout .nt-court-large {
          min-height: min(67vh, 780px);
          display:flex;
          flex-direction:column;
        }

        .ipad-court-layout .nt-court-large .nt-score-team {
          flex:1;
          min-height:clamp(170px,25vh,310px);
        }

        @media (max-width: 1100px) {
          .ipad-court-layout .nt-header {
            gap:13px;
          }

          .ipad-court-layout .nt-brand h1 {
            font-size:clamp(21px,2.5vw,30px);
          }

          .ipad-court-layout .nt-partner-images img {
            width:clamp(100px,12vw,150px);
          }

          .ipad-court-layout .nt-court-large
          .nt-score-names strong {
            font-size:clamp(32px,4.8vw,54px);
          }
        }

        @media (max-width: 700px) {
          .ipad-court-layout .nt-court-large {
            min-height:auto;
          }

          .ipad-court-layout .nt-court-large
          .nt-score-team {
            min-height:165px;
          }

          .ipad-court-layout .nt-court-large
          .nt-score-names strong {
            font-size:clamp(27px,6vw,40px);
          }

          .ipad-court-layout .nt-court-large
          .nt-points {
            font-size:clamp(55px,11vw,80px);
          }
        }
      `}</style>

      <div className="nt-container narrow ipad-court-layout">
        <BroadcastHeader
          state={state}
          connected={connected}
        />

        <section className="nt-section-head">
          <div>
            <h2>
              COURT {String(courtId).padStart(2, "0")}
            </h2>

            <p>{stageLabel(state)}</p>
          </div>

          <Partners />
        </section>

        {state.awaitingStart && (
          <div className="nt-standby">
            <strong>NEXT MATCH READY</strong>
            <span>
              Waiting for the coach to begin the countdown.
            </span>
          </div>
        )}

        {court?.active ? (
          <CourtScoreboard
            court={court}
            players={state.players}
            large
          />
        ) : (
          <section className="nt-empty">
            <h2>NO MATCH SCHEDULED</h2>
            <p>
              Court {courtId} is not used for
              the current knockout stage.
            </p>
          </section>
        )}
      </div>
    </main>
  );
}
