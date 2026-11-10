
"use client";

import { useEffect, useState } from "react";
import { io } from "socket.io-client";

let socket = null;

/* ==========================================
   SHARED SOCKET CONNECTION
========================================== */

function getSocket() {
  if (typeof window === "undefined") {
    return null;
  }

  if (!socket) {
    socket = io({
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      transports: ["websocket", "polling"],
    });
  }

  return socket;
}

/* ==========================================
   COACH SESSION
========================================== */

export function getCoachToken() {
  if (typeof window === "undefined") {
    return "";
  }

  return (
    window.sessionStorage.getItem("coachToken") || ""
  );
}

export function saveCoachToken(token) {
  if (typeof window === "undefined") return;

  window.sessionStorage.setItem(
    "coachToken",
    token
  );
}

export function clearCoachToken() {
  if (typeof window === "undefined") return;

  window.sessionStorage.removeItem("coachToken");
}

/* ==========================================
   SEND AUTHENTICATED EVENT
========================================== */

export function sendTournamentEvent(
  event,
  payload = {},
  authenticated = true
) {
  return new Promise((resolve, reject) => {
    const connection = getSocket();

    if (!connection) {
      reject(
        new Error("Socket connection unavailable.")
      );
      return;
    }

    // Fail immediately when offline rather than
    // silently queuing referee scoring operations.
    if (!connection.connected) {
      reject(
        new Error(
          "Connection lost. Reconnect before scoring."
        )
      );
      return;
    }

    const body = authenticated
      ? {
          ...payload,
          token: getCoachToken(),
        }
      : payload;

    connection
      .timeout(10000)
      .emit(event, body, (err, result) => {
        if (err) {
          reject(
            new Error(
              "Server did not respond. Check the connection and score before retrying."
            )
          );
          return;
        }

        if (!result?.ok) {
          reject(
            new Error(
              result?.error || "Action failed."
            )
          );
          return;
        }

        resolve(result);
      });
  });
}

/* ==========================================
   PLAYER HELPERS
========================================== */

export function playerName(players, id) {
  return (
    (players || []).find(
      (player) => player.id === id
    )?.name || "Player TBC"
  );
}

export function displayPoints(score, team) {
  return String(
    score?.points?.[team] ?? 0
  );
}

/* ==========================================
   STAGE HELPERS
========================================== */

export function stageLabel(state) {
  if (!state) {
    return "Tournament";
  }

  if (state.phase === "complete") {
    return "TOURNAMENT COMPLETE";
  }

  if (state.stage === "groups") {
    return (
      `GROUP ${state.group} · ROUND ${state.round}`
    );
  }

  return {
    quarterfinals: "QUARTERFINALS",
    semifinals: "SEMIFINALS",
    finals: "FINAL & BRONZE",
  }[state.stage] || "TOURNAMENT";
}

/* ==========================================
   CLOCK HELPERS
========================================== */

export function timeRemaining(timer, now) {
  const duration =
    timer?.durationMs || 600000;

  if (timer?.endsAt == null) {
    return duration;
  }

  return Math.max(
    0,
    timer.endsAt - now
  );
}

export function formatClock(ms) {
  const seconds = Math.ceil(
    ms / 1000
  );

  const minutes = Math.floor(
    seconds / 60
  );

  return (
    `${String(minutes).padStart(2, "0")}:` +
    `${String(seconds % 60).padStart(2, "0")}`
  );
}

/* ==========================================
   TOURNAMENT HOOK
========================================== */

export default function useTournament() {
  const [state, setState] = useState(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const connection = getSocket();

    if (!connection) return;

    /* ======================================
       FULL STATE UPDATE
    ====================================== */

    function onState(nextState) {
      setState(nextState);
    }

    /* ======================================
       LIGHTWEIGHT SCORE UPDATE
    ====================================== */

    function onScore(update) {
      setState((current) => {
        if (!current) return current;

        // Ignore updates from an earlier match
        // after the server advances the stage.
        if (
          current.matchKey !== update.matchKey
        ) {
          return current;
        }

        if (
          !Array.isArray(update.points) ||
          update.points.length !== 2
        ) {
          return current;
        }

        const courtIndex = current.courts.findIndex(
          (court) =>
            court.id === update.courtId
        );

        if (courtIndex === -1) {
          return current;
        }

        const oldCourt =
          current.courts[courtIndex];

        // No update needed if values are identical.
        if (
          oldCourt.score.points[0] === update.points[0] &&
          oldCourt.score.points[1] === update.points[1] &&
          oldCourt.final === update.final
        ) {
          return current;
        }

        const updatedCourt = {
          ...oldCourt,

          final: update.final,

          score: {
            ...oldCourt.score,
            points: [...update.points],
          },
        };

        const updatedCourts = [
          ...current.courts,
        ];

        updatedCourts[courtIndex] =
          updatedCourt;

        return {
          ...current,
          courts: updatedCourts,
        };
      });
    }

    /* ======================================
       CONNECTION STATUS
    ====================================== */

    function onConnect() {
      setConnected(true);
    }

    function onDisconnect() {
      setConnected(false);
    }

    /* ======================================
       LISTENERS
    ====================================== */

    connection.on(
      "tournament:state",
      onState
    );

    connection.on(
      "tournament:score",
      onScore
    );

    connection.on(
      "connect",
      onConnect
    );

    connection.on(
      "disconnect",
      onDisconnect
    );

    setConnected(connection.connected);

    if (!connection.connected) {
      connection.connect();
    }

    // The server automatically sends a fresh
    // tournament snapshot on every connection.

    return () => {
      connection.off(
        "tournament:state",
        onState
      );

      connection.off(
        "tournament:score",
        onScore
      );

      connection.off(
        "connect",
        onConnect
      );

      connection.off(
        "disconnect",
        onDisconnect
      );
    };
  }, []);

  return {
    state,
    connected,
    socket: getSocket(),
  };
}
