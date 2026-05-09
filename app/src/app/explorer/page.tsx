"use client";

import { useEffect, useState } from "react";
import { useOracleStore, scoreToColor } from "@/hooks/useOracle";
import { ScorePoint } from "@/types";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, LineChart, Line,
} from "recharts";
import { format } from "date-fns";

function ScoreTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d: ScorePoint = payload[0].payload;
  const color = scoreToColor(d.score);
  return (
    <div className="panel p-4 min-w-[160px] border-borderHi shadow-xl">
      <div className="mono text-[10px] text-dim mb-2">{format(new Date(d.timestamp * 1000), "HH:mm:ss")}</div>
      <div className="mono text-3xl font-medium mb-2" style={{ color }}>{d.score}</div>
      <div className="space-y-1 border-t border-border pt-2 mono text-[10px]">
        {[
          { k: "Lr", v: d.lr, c: "#00FFD1" },
          { k: "At", v: d.at, c: "#F59E0B" },
          { k: "Od", v: d.od, c: "#818CF8" },
          { k: "Vs", v: d.vs, c: "#F472B6" },
        ].map((r) => (
          <div key={r.k} className="flex justify-between">
            <span className="text-dim">{r.k}</span>
            <span style={{ color: r.c }}>{r.v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Sparkline({ data, dataKey, color, label }: { data: ScorePoint[]; dataKey: keyof ScorePoint; color: string; label: string; }) {
  const latest = data.length > 0 ? (data[data.length - 1][dataKey] as number) : 0;
  return (
    <div className="panel p-4">
      <div className="flex justify-between items-center mb-2">
        <div className="label">{label}</div>
        <span className="mono text-sm" style={{ color }}>{latest}</span>
      </div>
      <ResponsiveContainer width="100%" height={44}>
        <LineChart data={data} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
          <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={1.2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function ExplorerPage() {
  const { oracle, history, startPolling } = useOracleStore();
  const [range, setRange] = useState<20 | 60 | 120>(60);

  useEffect(() => {
    const stop = startPolling();
    return stop;
  }, [startPolling]);

  const data = history.slice(-range);

  return (
    <div className="p-8 animate-fade-in">
      <div className="flex items-center justify-between mb-7">
        <div>
          <h1 className="text-2xl text-bright mb-1.5" style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700 }}>
            Risk Explorer
          </h1>
          <p className="mono text-[10px] text-dim">Historical security score and component breakdown</p>
        </div>
        <div className="flex border border-border">
          {([20, 60, 120] as const).map((r) => (
            <button key={r} onClick={() => setRange(r)}
              className={`px-4 py-2 mono text-[10px] border-r border-border last:border-r-0 transition-colors ${range === r ? "bg-border text-bright" : "text-dim hover:text-text"}`}>
              {r === 20 ? "10m" : r === 60 ? "30m" : "1hr"}
            </button>
          ))}
        </div>
      </div>

      {/* Main chart */}
      <div className="panel p-6 mb-4">
        <div className="flex items-center justify-between mb-4">
          <div className="label">S(t) — COMPOSITE SCORE</div>
          <div className="flex items-center gap-5 mono text-[9px] text-dim">
            <span><span className="inline-block w-4 h-px bg-cyan mr-1 align-middle" />Score</span>
            <span><span className="inline-block w-4 border-t border-dashed border-cyan/40 mr-1 align-middle" style={{width:16}} />Open ≥80</span>
            <span><span className="inline-block w-4 border-t border-dashed border-amber/40 mr-1 align-middle" style={{width:16}} />Restricted ≥60</span>
          </div>
        </div>

        {data.length === 0 ? (
          <div className="h-48 flex items-center justify-center mono text-[11px] text-dim">
            No data yet — start the mock engine and wait 30s
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00FFD1" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#00FFD1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="0" stroke="#1A1F2A" />
              <XAxis dataKey="timestamp" tickFormatter={(v) => format(new Date(v * 1000), "HH:mm")}
                tick={{ fill: "#6B7280", fontSize: 9, fontFamily: "JetBrains Mono" }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} ticks={[0, 20, 40, 60, 80, 100]}
                tick={{ fill: "#6B7280", fontSize: 9, fontFamily: "JetBrains Mono" }} axisLine={false} tickLine={false} />
              <Tooltip content={<ScoreTooltip />} />
              <ReferenceLine y={80} stroke="#00FFD1" strokeDasharray="3 3" strokeOpacity={0.35} />
              <ReferenceLine y={60} stroke="#F59E0B" strokeDasharray="3 3" strokeOpacity={0.35} />
              <Area type="monotone" dataKey="score" stroke="#00FFD1" strokeWidth={1.5}
                fill="url(#scoreGrad)" dot={false} activeDot={{ r: 3, fill: "#00FFD1", strokeWidth: 0 }} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Component sparklines */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        <Sparkline data={data} dataKey="lr" color="#00FFD1" label="Lr · LIQUIDITY" />
        <Sparkline data={data} dataKey="at" color="#F59E0B" label="At · ANOMALY" />
        <Sparkline data={data} dataKey="od" color="#818CF8" label="Od · ORACLE DEV" />
        <Sparkline data={data} dataKey="vs" color="#F472B6" label="Vs · VOLATILITY" />
      </div>

      {/* Current oracle data */}
      <div className="panel p-5">
        <div className="label mb-4">CURRENT ORACLE ACCOUNT</div>
        {oracle ? (
          <div className="grid grid-cols-2 gap-x-10 gap-y-2 mono text-xs max-w-lg">
            {[
              ["Score S(t)", oracle.score],
              ["Lr", oracle.lr],
              ["At", oracle.at],
              ["Od", oracle.od],
              ["Vs", oracle.vs],
              ["Update #", oracle.updateCount],
              ["Last Updated", new Date(oracle.lastUpdated * 1000).toLocaleString()],
              ["Status", oracle.isStale ? "STALE ⚠" : "Fresh"],
            ].map(([k, v]) => (
              <div key={String(k)} className="flex justify-between border-b border-border/40 pb-1.5">
                <span className="text-dim">{k}</span>
                <span className={v === "STALE ⚠" ? "text-red" : v === "Fresh" ? "text-cyan" : "text-text"}>{String(v)}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="mono text-[11px] text-dim">
            Oracle not found. Deploy programs and run: <span className="text-cyan">yarn dev:engine</span>
          </div>
        )}
      </div>
    </div>
  );
}
