
"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { io } from "socket.io-client";

export default function useTournament() {
  const socketRef = useRef(null);
  const [state, setState] = useState(null);
  const [connected, setConnected] = useState(false);
  const [token, setToken] = useState(null);

  useEffect(() => {
    setToken(sessionStorage.getItem("padel_coach_token"));

    const socket = io({
      transports: ["websocket", "polling"],
      reconnection: true,
    });

    socketRef.current = socket;

    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));
    socket.on("tournament:state", setState);

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  const send = useCallback((event, payload = {}) => {
    return new Promise((resolve, reject) => {
      const socket = socketRef.current;

      if (!socket?.connected) {
        reject(new Error("Connection lost. Reconnecting..."));
        return;
      }

      const session = sessionStorage.getItem("padel_coach_token");

      socket.timeout(6000).emit(
        event,
        { ...payload, token: session },
        (timeoutError, response) => {
          if (timeoutError) {
            reject(new Error("Server did not respond."));
          } else if (!response?.ok) {
            reject(new Error(response?.error || "Request failed."));
          } else {
            resolve(response);
          }
        }
      );
    });
  }, []);

  const login = useCallback(async (password) => {
    const response = await new Promise((resolve, reject) => {
      const socket = socketRef.current;

      if (!socket?.connected) {
        reject(new Error("Not connected to the server."));
        return;
      }

      socket.timeout(6000).emit(
        "coach:login",
        { password },
        (err, result) => {
          if (err) reject(new Error("Login timed out."));
          else resolve(result);
        }
      );
    });

    if (!response.ok) {
      throw new Error(response.error);
    }

    sessionStorage.setItem("padel_coach_token", response.token);
    setToken(response.token);
    return response;
  }, []);

  const logout = useCallback(() => {
    sessionStorage.removeItem("padel_coach_token");
    setToken(null);
  }, []);

  return {
    state,
    connected,
    token,
    send,
    login,
    logout,
  };
}

export function displayPoints(score, team) {
  if (score.tiebreak) return String(score.points[team]);

  const points = score.points;
  const mine = points[team];
  const theirs = points[1 - team];

  if (mine >= 3 && theirs >= 3) {
    if (mine === theirs) return "40";
    return mine > theirs ? "AD" : "40";
  }

  return ["0", "15", "30", "40"][Math.min(mine, 3)];
}

export function playerName(players, id) {
  return players.find(p => p.id === id)?.name || "Unassigned";
}
