
"use client";

import { useEffect, useMemo, useState } from "react";

import {
  playerName,
  sendTournamentEvent,
} from "@/lib/useTournament";

const EMPTY_MATCHES = () =>
  Array.from({ length: 4 }, (_, index) => ({
    id: `QF${index + 1}`,
    courtId: index + 1,
    teams: [
      ["", ""],
      ["", ""],
    ],
  }));

export default function QuarterfinalDraw({
  state,
  connected,
}) {
  const qualification = state?.qualification;

  const qualifiedIds =
    qualification?.qualifiedPlayerIds || [];

  const qualifiedKey = qualifiedIds.join("|");

  const [matches, setMatches] = useState(EMPTY_MATCHES);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Initialize the draw whenever the qualified roster changes.
  useEffect(() => {
    setMatches(EMPTY_MATCHES());
    setConfirmOpen(false);
    setError("");
    setSuccess("");
  }, [qualifiedKey]);

  const confirmed = Boolean(
    qualification?.drawConfirmed
  );

  const assignedIds = useMemo(
    () =>
      matches.flatMap((match) =>
        match.teams.flat().filter(Boolean)
      ),
    [matches]
  );

  const assignedCount = new Set(assignedIds).size;

  const duplicatePlayers =
    assignedIds.length !== assignedCount;

  const assignedCourts = matches.map(
    (match) => Number(match.courtId)
  );

  const duplicateCourts =
    new Set(assignedCourts).size !== 4;

  const valid = Boolean(
    qualifiedIds.length === 16 &&
    assignedIds.length === 16 &&
    assignedCount === 16 &&
    !duplicatePlayers &&
    !duplicateCourts &&
    assignedIds.every((id) => qualifiedIds.includes(id))
  );

  const qualifiers = useMemo(() => {
    const all = state?.players || [];

    return qualifiedIds.map((id) =>
      all.find((player) => player.id === id)
    ).filter(Boolean);
  }, [state?.players, qualifiedKey]);

  function updatePlayer(matchIndex, teamIndex, slot, id) {
    setMatches((previous) =>
      previous.map((match, index) => {
        if (index !== matchIndex) return match;

        const nextTeams = match.teams.map(
          (team) => [...team]
        );

        nextTeams[teamIndex][slot] = id;

        return {
          ...match,
          teams: nextTeams,
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
          ? { ...match, courtId: Number(courtId) }
          : match
      )
    );

    setError("");
    setSuccess("");
  }

  async function submitDraw() {
    if (!valid || busy || !connected) return;

    setBusy(true);
    setError("");
    setSuccess("");

    try {
      await sendTournamentEvent(
        "knockout:draw:confirm",
        {
          matches: matches.map((match) => ({
            courtId: Number(match.courtId),
            teams: match.teams.map((team) => [...team]),
          })),
        }
      );

      setConfirmOpen(false);
      setSuccess(
        "Quarterfinal draw confirmed. All spectator and referee screens have been updated."
      );
    } catch (error) {
      setError(error.message);
    } finally {
      setBusy(false);
    }
  }

  if (state?.stage !== "quarterfinals") {
    return null;
  }

  if (confirmed) {
    return (
      <section className="ac-panel">
        <span className="ac-eyebrow">
          QUARTERFINAL DRAW
        </span>

        <h3>Teams Confirmed</h3>

        <p>
          All eight partnerships are locked for the remainder
          of the knockout competition.
        </p>

        <div
          className="ac-grid"
          style={{ marginTop: 16 }}
        >
          {(state.bracket?.quarterfinals || []).map(
            (match) => (
              <div
                key={match.id}
                className="ac-panel"
              >
                <span className="ac-eyebrow">
                  {match.id} · COURT {match.courtId}
                </span>

                {match.teams.map((team, index) => (
                  <p key={index}>
                    <strong>Team {index + 1}</strong>
                    {" — "}
                    {team.map((id) =>
                      playerName(state.players, id)
                    ).join(" & ")}
                  </p>
                ))}
              </div>
            )
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="ac-panel" style={{ marginTop: 20 }}>
      <span className="ac-eyebrow">
        KNOCKOUT PREPARATION
      </span>

      <h3>Quarterfinal Draw & Court Assignments</h3>

      <p>
        The top 16 qualified players are ready. Draw the
        partnerships, choose which teams face each other,
        then assign a physical court to each quarterfinal.
        Partners remain together through the semifinals,
        championship final, and bronze match.
      </p>

      {error && (
        <div className="ac-notice error" role="alert">
          {error}
        </div>
      )}

      {success && (
        <div className="ac-notice" role="status">
          {success}
        </div>
      )}

      <div className="ac-kpis">
        <div className="ac-kpi">
          <small>QUALIFIED PLAYERS</small>
          <strong>{qualifiedIds.length} / 16</strong>
        </div>

        <div className="ac-kpi">
          <small>ASSIGNED PLAYERS</small>
          <strong>{assignedCount} / 16</strong>
        </div>

        <div className="ac-kpi">
          <small>QUARTERFINAL MATCHES</small>
          <strong>04</strong>
        </div>
      </div>

      <div className="ac-panel">
        <span className="ac-eyebrow">
          QUALIFIED PLAYER POOL
        </span>

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(160px, 1fr))",
            gap: 9,
          }}
        >
          {qualifiers.map((player) => {
            const used = assignedIds.includes(player.id);

            return (
              <div
                key={player.id}
                style={{
                  border: "1px solid rgba(213,220,220,.25)",
                  padding: "10px 12px",
                  opacity: used ? 0.5 : 1,
                }}
              >
                <strong>{player.name}</strong>

                <div
                  style={{
                    color: "#D5DCDC",
                    fontSize: 11,
                    marginTop: 5,
                  }}
                >
                  GROUP {player.group}
                  {" · "}
                  {used ? "ASSIGNED" : "AVAILABLE"}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div
        className="ac-grid"
        style={{ marginTop: 19 }}
      >
        {matches.map((match, matchIndex) => (
          <section
            className="ac-panel"
            key={match.id}
          >
            <span className="ac-eyebrow">
              KNOCKOUT MATCH
            </span>

            <h3>{match.id}</h3>

            <label
              style={{
                display: "block",
                marginBottom: 8,
                fontSize: 12,
              }}
            >
              Playing on Court
            </label>

            <select
              className="ac-input"
              value={match.courtId}
              onChange={(event) =>
                updateCourt(matchIndex, event.target.value)
              }
              disabled={busy}
            >
              {[1, 2, 3, 4, 5, 6].map((courtId) => (
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
                  {[0, 1].map((slot) => {
                    const currentId =
                      match.teams[teamIndex][slot];

                    return (
                      <select
                        className="ac-input"
                        key={slot}
                        value={currentId}
                        disabled={busy}
                        aria-label={
                          `${match.id} Team ${teamIndex + 1} ` +
                          `Player ${slot + 1}`
                        }
                        onChange={(event) =>
                          updatePlayer(
                            matchIndex,
                            teamIndex,
                            slot,
                            event.target.value
                          )
                        }
                      >
                        <option value="">
                          Select Player
                        </option>

                        {qualifiers.map((player) => {
                          const usedElsewhere =
                            assignedIds.includes(player.id) &&
                            player.id !== currentId;

                          return (
                            <option
                              key={player.id}
                              value={player.id}
                              disabled={usedElsewhere}
                            >
                              {player.name}
                            </option>
                          );
                        })}
                      </select>
                    );
                  })}
                </div>
              </div>
            ))}
          </section>
        ))}
      </div>

      {duplicatePlayers && (
        <div className="ac-notice error">
          A player has been assigned more than once.
        </div>
      )}

      {duplicateCourts && (
        <div className="ac-notice error">
          Two quarterfinal matches share the same court.
          Select four different courts.
        </div>
      )}

      <div
        className="ac-panel"
        style={{ marginTop: 20 }}
      >
        <span className="ac-eyebrow">
          FINALISE THE DRAW
        </span>

        <h3>Confirm Quarterfinal Assignments</h3>

        <p>
          QF1 and QF2 feed Semifinal 1. QF3 and QF4
          feed Semifinal 2. The semifinal winners play
          for gold and the losers play for bronze.
        </p>

        <button
          type="button"
          className="ac-btn"
          disabled={!valid || !connected || busy}
          onClick={() => setConfirmOpen(true)}
        >
          CONFIRM QUARTERFINAL DRAW
        </button>
      </div>

      {confirmOpen && (
        <div className="ac-overlay">
          <section
            className="ac-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="qf-confirm-title"
          >
            <span className="ac-eyebrow">
              QUARTERFINAL DRAW
            </span>

            <h2 id="qf-confirm-title">
              Lock All Eight Teams?
            </h2>

            <p>
              This confirms all 16 players, eight
              partnerships, four matchups, and four
              court assignments. These teams will
              remain together until the tournament ends.
            </p>

            <div className="ac-dialog-actions">
              <button
                type="button"
                className="ac-btn secondary"
                disabled={busy}
                onClick={() => setConfirmOpen(false)}
              >
                Go Back
              </button>

              <button
                type="button"
                className="ac-btn"
                disabled={busy || !valid || !connected}
                onClick={submitDraw}
              >
                {busy ? "Saving..." : "Confirm Draw"}
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
