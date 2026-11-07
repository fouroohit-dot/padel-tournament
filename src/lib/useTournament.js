
"use client";

import { useEffect, useState } from "react";
import { io } from "socket.io-client";

let socket = null;

function getSocket() {
  if (typeof window === "undefined") return null;

  if (!socket) {
    socket = io({
      autoConnect: true,
      reconnection: true,
      transports: ["websocket", "polling"],
    });
  }

  if (!socket.connected) socket.connect();
  return socket;
}

export function getCoachToken() {
  if (typeof window === "undefined") return "";
  return window.sessionStorage.getItem("coachToken") || "";
}

export function saveCoachToken(token) {
  window.sessionStorage.setItem("coachToken", token);
}

export function clearCoachToken() {
  window.sessionStorage.removeItem("coachToken");
}

export function sendTournamentEvent(event, payload = {}, authenticated = true) {
  return new Promise((resolve, reject) => {
    const connection = getSocket();

    if (!connection) {
      reject(new Error("Socket connection unavailable."));
      return;
    }

    const body = authenticated
      ? { ...payload, token: getCoachToken() }
      : payload;

    connection.timeout(10000).emit(event, body, (err, result) => {
      if (err) {
        reject(new Error("Server did not respond. Check the connection."));
      } else if (!result?.ok) {
        reject(new Error(result?.error || "Action failed."));
      } else {
        resolve(result);
      }
    });
  });
}

export function playerName(players, id) {
  return (
    players.find((p) => p.id === id)?.name ||
    "Player TBC"
  );
}

export function displayPoints(score, team) {
  return String(score?.points?.[team] ?? 0);
}

export function stageLabel(state) {
  if (!state) return "Tournament";

  if (state.phase === "complete") return "TOURNAMENT COMPLETE";

  if (state.stage === "groups") {
    return `GROUP ${state.group} · ROUND ${state.round}`;
  }

  return {
    quarterfinals: "QUARTERFINALS",
    semifinals: "SEMIFINALS",
    finals: "FINAL & BRONZE",
  }[state.stage] || "TOURNAMENT";
}

export function timeRemaining(timer, now) {
  const duration = timer?.durationMs || 600000;

  if (timer?.endsAt == null) return duration;

  return Math.max(0, timer.endsAt - now);
}

export function formatClock(ms) {
  const seconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(seconds / 60);

  return `${String(minutes).padStart(2, "0")}:${String(
    seconds % 60
  ).padStart(2, "0")}`;
}

export default function useTournament() {
  const [state, setState] = useState(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const connection = getSocket();

    function onState(next) {
      setState(next);
    }

    function onConnect() {
      setConnected(true);
    }

    function onDisconnect() {
      setConnected(false);
    }

    connection.on("tournament:state", onState);
    connection.on("connect", onConnect);
    connection.on("disconnect", onDisconnect);

    setConnected(connection.connected);

    // Request a fresh state after every reconnection.
    // The server sends one automatically on connection.
    return () => {
      connection.off("tournament:state", onState);
      connection.off("connect", onConnect);
      connection.off("disconnect", onDisconnect);
    };
  }, []);

  return { state, connected, socket: getSocket() };
}
