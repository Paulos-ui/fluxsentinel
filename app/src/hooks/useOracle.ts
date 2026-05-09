"use client";

import { create } from "zustand";
import { Connection } from "@solana/web3.js";
import { fetchOracleData, fetchProtocolStats } from "@/lib/program";
import { OracleData, ProtocolStats, ScorePoint, ProtocolState } from "@/types";
import { RPC_URL } from "@/config";

const MAX_HISTORY = 120;

interface OracleStore {
  oracle:    OracleData | null;
  stats:     ProtocolStats | null;
  history:   ScorePoint[];
  isLoading: boolean;
  lastFetch: number;
  fetch:        () => Promise<void>;
  startPolling: () => () => void;
}

let conn: Connection | null = null;
function getConn() {
  if (!conn) conn = new Connection(RPC_URL, "confirmed");
  return conn;
}

export const useOracleStore = create<OracleStore>((set, get) => ({
  oracle: null, stats: null, history: [], isLoading: false, lastFetch: 0,

  fetch: async () => {
    set({ isLoading: true });
    try {
      const [oracle, stats] = await Promise.all([
        fetchOracleData(getConn()),
        fetchProtocolStats(getConn()),
      ]);
      if (oracle) {
        const point: ScorePoint = {
          timestamp: oracle.lastUpdated,
          score: oracle.score, lr: oracle.lr, at: oracle.at,
          od: oracle.od, vs: oracle.vs, state: oracle.protocolState,
        };
        set((s) => ({
          oracle, stats: stats ?? s.stats, isLoading: false, lastFetch: Date.now(),
          history: [...s.history.filter(p => p.timestamp !== point.timestamp), point].slice(-MAX_HISTORY),
        }));
      } else { set({ isLoading: false }); }
    } catch (e) { console.warn("oracle fetch:", e); set({ isLoading: false }); }
  },

  startPolling: () => {
    const { fetch } = get();
    fetch();
    const id = setInterval(fetch, 10_000);
    return () => clearInterval(id);
  },
}));

export function scoreToColor(score: number, isStale = false): string {
  if (isStale) return "#6B7280";
  if (score >= 80) return "#00FFD1";
  if (score >= 60) return "#F59E0B";
  return "#EF4444";
}

export function stateLabel(score: number, isStale = false): string {
  if (isStale) return "STALE";
  if (score >= 80) return "Open";
  if (score >= 60) return "Restricted";
  return "Frozen";
}

export function ratioFromScore(score: number): string {
  if (score >= 80) return "150%";
  if (score >= 60) return "200%";
  return "∞";
}

export function protocolStateFromScore(score: number, stale = false): ProtocolState {
  if (stale) return "Frozen";
  if (score >= 80) return "Open";
  if (score >= 60) return "Restricted";
  return "Frozen";
}
