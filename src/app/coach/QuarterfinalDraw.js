
"use client";

import { useEffect, useMemo, useState } from "react";

import {
  playerName,
  sendTournamentEvent,
} from "@/lib/useTournament";

const COURTS = [1, 2, 3, 4, 5, 6];

function emptyDraw() {
  return Array.from({ length: 4 }, (_, index) => ({
    id: `QF${index + 1}`,
    courtId: index + 1,
    teams: [
      ["", ""],
      ["", ""],
    ],
  }));
}

function normalizeName(value) {
  return value.trim().replace(/\s+/g, " ");
}

/* ==========================================
   CONFIRMED DRAW VIEW
========================================== */

function ConfirmedDraw({ state }) {
  const matches =
    state.bracket?.quarterfinals || [];

  return (
    <section
      className="ac-panel"
      style={{ marginTop: 20 }}
    >
      <span className="ac-eyebrow">
        QUARTERFINAL DRAW
      </span>

      <h3>Confirmed Teams & Courts</h3>

      <p>
        All eight partnerships have been confirmed.
        These teams will remain together for the
        remainder of the knockout competition.
      </p>

      <div
        className="ac-grid"
        style={{ marginTop: 18 }}
      >
        {matches.map((match) => (
          <section
            className="ac-panel"
            key={match.id}
          >
            <span className="ac-eyebrow">
              {match.id} · COURT {match.courtId}
            </span>

            <h3>{match.label}</h3>

            {[0, 1].map((side) => (
              <div
                className="ac-team"
                key={side}
              >
                <span className="ac-team-label">
                  TEAM {side + 1}
                </span>

                {(match.teams?.[side] || []).map(
                  (id, index) => (
                    <p
                      key={id || index}
                      style={{
                        margin: "6px 0",
                        fontWeight: 500,
                        color: "#e4e2db",
                      }}
                    >
                      {playerName(state.players, id)}
                    </p>
                  )
                )}
              </div>
            ))}

            <div
              className="ac-notice"
              style={{
                marginTop: 14,
                marginBottom: 0,
              }}
            >
              {match.final
                ? `FINAL · ${match.points[0]} – ${match.points[1]}`
                : "First to 10 points · No timer"}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}

/* ==========================================
   QUARTERFINAL DRAW
========================================== */

export default function QuarterfinalDraw({
  state,
  connected,
}) {
  const [matches, setMatches] = useState(emptyDraw);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const drawConfirmed = Boolean(
    state?.qualification?.drawConfirmed
  );

  // Reset the form when a new tournament begins
  // or returns to the group stage.
  const tournamentId = state?.startedAt || "setup";

  useEffect(() => {
    setMatches(emptyDraw());
    setConfirmOpen(false);
    setError("");
    setSuccess("");
  }, [tournamentId]);

  /* ========================================
     VALIDATE ALL 16 ENTRIES
  ======================================== */

  const validation = useMemo(() => {
    const names = matches.flatMap(
      (match) =>
        match.teams.flat().map(normalizeName)
    );

    const filled = names.filter(Boolean);

    const normalized = filled.map(
      (name) => name.toLocaleLowerCase("en")
    );

    const courtIds = matches.map(
      (match) => Number(match.courtId)
    );

    const duplicateNames =
      new Set(normalized).size !== filled.length;

    const duplicateCourts =
      new Set(courtIds).size !== 4;

    const invalidNames = filled.some(
      (name) => name.length > 80
    );

    const complete =
      names.length === 16 &&
      filled.length === 16;

    return {
      valid:
        complete &&
        !duplicateNames &&
        !duplicateCourts &&
        !invalidNames,

      filledCount: filled.length,
      duplicateNames,
      duplicateCourts,
      invalidNames,
    };
  }, [matches]);

  /* ========================================
     EDIT DRAW
  ======================================== */

  function updatePlayer(
    matchIndex,
    teamIndex,
    slotIndex,
    value
  ) {
    setMatches((previous) =>
      previous.map((match, index) => {
        if (index !== matchIndex) {
          return match;
        }

        const teams = match.teams.map(
          (team) => [...team]
        );

        teams[teamIndex][slotIndex] = value;

        return {
          ...match,
          teams,
        };
      })
    );

    setError("");
    setSuccess("");
  }

  function updateCourt(matchIndex, courtId) {
    setMatches((previous) =>
      previous.map((match, index) =>
        index === matchIndex
          ? {
              ...match,
              courtId: Number(courtId),
            }
          : match
      )
    );

    setError("");
    setSuccess("");
  }

  /* ========================================
     SAVE CONFIRMED DRAW
  ======================================== */

  async function submitDraw() {
    if (
      !validation.valid ||
      busy ||
      !connected ||
      drawConfirmed
    ) {
      return;
    }

    setBusy(true);
    setError("");
    setSuccess("");

    try {
      const payload = matches.map((match) => ({
        courtId: Number(match.courtId),

        teams: match.teams.map(
          (team) =>
            team.map((name) =>
              normalizeName(name)
            )
        ),
      }));

      await sendTournamentEvent(
        "knockout:draw:confirm",
        {
          matches: payload,
        }
      );

      setConfirmOpen(false);

      setSuccess(
        "Quarterfinal draw confirmed. " +
        "All spectator and referee screens have been updated."
      );
    } catch (err) {
      setError(
        err.message || "Unable to confirm the draw."
      );
    } finally {
      setBusy(false);
    }
  }

  /* ========================================
     RENDER
  ======================================== */

  if (state?.stage !== "quarterfinals") {
    return null;
  }

  if (drawConfirmed) {
    return <ConfirmedDraw state={state} />;
  }

  return (
    <section
      className="ac-panel"
      style={{ marginTop: 20 }}
    >
      <span className="ac-eyebrow">
        KNOCKOUT PREPARATION
      </span>

      <h3>Manual Quarterfinal Draw</h3>

      <p>
        Enter 16 player names manually, including
        any last-minute replacements. Select two
        players per team and assign a court to
        each quarterfinal match.
      </p>

      <p>
        Partnerships will remain fixed through
        the semifinals, bronze match, and final.
      </p>

      {error && (
        <div
          className="ac-notice error"
          role="alert"
        >
          {error}
        </div>
      )}

      {success && (
        <div
          className="ac-notice"
          role="status"
        >
          {success}
        </div>
      )}

      {/* ==================================
          ASSIGNMENT STATUS
      ================================== */}

      <div className="ac-kpis">
        <div className="ac-kpi">
          <small>PLAYERS ENTERED</small>

          <strong>
            {validation.filledCount} / 16
          </strong>
        </div>

        <div className="ac-kpi">
          <small>TEAMS</small>
          <strong>08</strong>
        </div>

        <div className="ac-kpi">
          <small>QUARTERFINAL MATCHES</small>
          <strong>04</strong>
        </div>
      </div>

      {/* ==================================
          QUARTERFINAL ASSIGNMENTS
      ================================== */}

      <div
        className="ac-grid"
        style={{ marginTop: 20 }}
      >
        {matches.map(
          (match, matchIndex) => (
            <section
              className="ac-panel"
              key={match.id}
            >
              <span className="ac-eyebrow">
                QUARTERFINAL MATCH
              </span>

              <h3>{match.id}</h3>

              <label
                htmlFor={`court-${match.id}`}
                style={{
                  display: "block",
                  margin: "15px 0 8px",
                  fontSize: 12,
                  color: "#D5DCDC",
                }}
              >
                Playing on Court
              </label>

              <select
                id={`court-${match.id}`}
                className="ac-input"
                value={match.courtId}
                disabled={busy}
                onChange={(event) =>
                  updateCourt(
                    matchIndex,
                    event.target.value
                  )
                }
              >
                {COURTS.map((courtId) => (
                  <option
                    key={courtId}
                    value={courtId}
                  >
                    Court {courtId}
                  </option>
                ))}
              </select>

              {[0, 1].map((teamIndex) => (
                <div
                  className="ac-team"
                  key={teamIndex}
                >
                  <span className="ac-team-label">
                    TEAM {teamIndex + 1}
                  </span>

                  <div className="ac-selects">
                    {[0, 1].map((slotIndex) => (
                      <input
                        key={slotIndex}
                        className="ac-input"
                        type="text"
                        maxLength={80}
                        autoComplete="off"
                        placeholder={
                          `Player ${slotIndex + 1}`
                        }
                        aria-label={
                          `${match.id}, team ${teamIndex + 1}, ` +
                          `player ${slotIndex + 1}`
                        }
                        value={
                          match.teams[teamIndex][slotIndex]
                        }
                        disabled={busy}
                        onChange={(event) =>
                          updatePlayer(
                            matchIndex,
                            teamIndex,
                            slotIndex,
                            event.target.value
                          )
                        }
                      />
                    ))}
                  </div>
                </div>
              ))}

              <div
                className="ac-notice"
                style={{
                  marginTop: 16,
                  marginBottom: 0,
                }}
              >
                First to 10 points · No timer
              </div>
            </section>
          )
        )}
      </div>

      {/* ==================================
          VALIDATION MESSAGES
      ================================== */}

      {validation.duplicateNames && (
        <div
          className="ac-notice error"
          role="alert"
        >
          A player name has been entered more
          than once. Each player must appear
          on exactly one team.
        </div>
      )}

      {validation.duplicateCourts && (
        <div
          className="ac-notice error"
          role="alert"
        >
          Two quarterfinal matches are assigned
          to the same court. Select four different
          courts.
        </div>
      )}

      {validation.invalidNames && (
        <div
          className="ac-notice error"
          role="alert"
        >
          Each player name must contain no more
          than 80 characters.
        </div>
      )}

      {/* ==================================
          DRAW CONFIRMATION
      ================================== */}

      <div
        className="ac-panel"
        style={{ marginTop: 20 }}
      >
        <span className="ac-eyebrow">
          FINALISE THE DRAW
        </span>

        <h3>Confirm Quarterfinal Teams</h3>

        <p>
          Review all 16 names, eight partnerships,
          four matchups and court assignments
          before proceeding.
        </p>

        <p>
          QF1 and QF2 feed Semifinal 1.
          QF3 and QF4 feed Semifinal 2.
        </p>

        <button
          type="button"
          className="ac-btn"
          disabled={
            !validation.valid ||
            !connected ||
            busy
          }
          onClick={() => setConfirmOpen(true)}
        >
          CONFIRM QUARTERFINAL DRAW
        </button>
      </div>

      {/* ==================================
          STYLED CONFIRMATION MODAL
      ================================== */}

      {confirmOpen && (
        <div className="ac-overlay">
          <section
            className="ac-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="qf-confirm-heading"
          >
            <span className="ac-eyebrow">
              QUARTERFINAL DRAW
            </span>

            <h2 id="qf-confirm-heading">
              Lock All Eight Teams?
            </h2>

            <p>
              You are about to confirm all
              16 player names, eight partnerships,
              four quarterfinal matchups and
              four playing courts.
            </p>

            <p>
              The partnerships will remain locked
              for the rest of the knockout competition.
            </p>

            <div className="ac-dialog-actions">
              <button
                type="button"
                className="ac-btn secondary"
                disabled={busy}
                onClick={() =>
                  setConfirmOpen(false)
                }
              >
                Go Back
              </button>

              <button
                type="button"
                className="ac-btn"
                disabled={
                  busy ||
                  !connected ||
                  !validation.valid
                }
                onClick={submitDraw}
              >
                {busy
                  ? "Saving..."
                  : "Confirm Draw"}
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
