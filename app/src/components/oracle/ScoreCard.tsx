"use client";

import { useEffect, useRef, useState } from "react";
import { OracleData } from "@/types";
import { scoreToColor, stateLabel } from "@/hooks/useOracle";

// ── Animated number counter ───────────────────────────────────────────────────
export function ScoreCounter({
  value,
  color,
}: {
  value: number;
  color: string;
}) {
  const [displayed, setDisplayed] = useState(value);
  const prevRef = useRef(value);

  useEffect(() => {
    const from = prevRef.current;
    const to = value;
    if (from === to) return;

    const duration = 700;
    const startTime = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setDisplayed(Math.round(from + (to - from) * eased));
      if (progress < 1) requestAnimationFrame(tick);
      else prevRef.current = to;
    };

    requestAnimationFrame(tick);
  }, [value]);

  return (
    <span
      className="font-display tabular-nums leading-none select-none"
      style={{
        fontFamily: "'Syne', sans-serif",
        fontSize: "clamp(4rem, 8vw, 7rem)",
        fontWeight: 700,
        color,
        textShadow: `0 0 60px ${color}30`,
      }}
    >
      {String(displayed).padStart(2, "0")}
    </span>
  );
}

// ── State badge ───────────────────────────────────────────────────────────────
export function StateBadge({ oracle }: { oracle: OracleData | null }) {
  const score = oracle?.score ?? 0;
  const stale = oracle?.isStale ?? true;
  const label = stateLabel(score, stale);
  const color = scoreToColor(score, stale);

  return (
    <span
      className="inline-flex items-center gap-1.5 mono text-[10px] font-medium px-2.5 py-1 tracking-widest uppercase"
      style={{
        color,
        borderColor: `${color}30`,
        background: `${color}0D`,
        border: `1px solid ${color}30`,
      }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ background: color }}
      />
      {label}
    </span>
  );
}

// ── Single component risk bar ─────────────────────────────────────────────────
function ComponentBar({
  abbr,
  label,
  value,
  weight,
  color,
}: {
  abbr: string;
  label: string;
  value: number;
  weight: string;
  color: string;
}) {
  const [animated, setAnimated] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setAnimated(value), 120);
    return () => clearTimeout(t);
  }, [value]);

  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <span className="mono text-[9px] tracking-widest text-dim uppercase">
            {abbr}
          </span>
          <span className="text-[11px] text-dim">{label}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="mono text-[9px] text-muted">{weight}</span>
          <span className="mono text-xs tabular-nums" style={{ color }}>
            {value}
          </span>
        </div>
      </div>
      <div className="h-px bg-border relative overflow-hidden">
        <div
          className="absolute top-0 left-0 h-full transition-all duration-1000 ease-out"
          style={{ width: `${animated}%`, background: color }}
        />
      </div>
    </div>
  );
}

// ── Full score card ───────────────────────────────────────────────────────────
export function ScoreCard({
  oracle,
  compact = false,
}: {
  oracle: OracleData | null;
  compact?: boolean;
}) {
  const score = oracle?.score ?? 0;
  const stale = oracle?.isStale ?? true;
  const color = scoreToColor(score, stale);

  const components = [
    {
      abbr: "Lr",
      label: "Liquidity Risk",
      value: oracle?.lr ?? 0,
      weight: "w=0.35",
      color: "#00FFD1",
    },
    {
      abbr: "At",
      label: "Anomaly Score",
      value: oracle?.at ?? 0,
      weight: "w=0.30",
      color: "#F59E0B",
    },
    {
      abbr: "Od",
      label: "Oracle Deviation",
      value: oracle?.od ?? 0,
      weight: "w=0.20",
      color: "#818CF8",
    },
    {
      abbr: "Vs",
      label: "Volatility Stress",
      value: oracle?.vs ?? 0,
      weight: "w=0.15",
      color: "#F472B6",
    },
  ];

  if (compact) {
    return (
      <div className="flex items-center gap-3">
        <ScoreCounter value={score} color={color} />
        <StateBadge oracle={oracle} />
      </div>
    );
  }

  return (
    <div
      className="panel p-6 relative overflow-hidden"
      style={{ borderColor: `${color}20` }}
    >
      {/* Subtle gradient corner */}
      <div
        className="absolute bottom-0 right-0 w-24 h-24 pointer-events-none"
        style={{
          background: `radial-gradient(circle at 100% 100%, ${color}10, transparent 70%)`,
        }}
      />

      <div className="label mb-4">SECURITY SCORE</div>

      <div className="flex items-end gap-3 mb-1">
        <ScoreCounter value={score} color={color} />
        <span className="mono text-sm text-muted mb-2">/ 100</span>
      </div>

      <div className="flex items-center justify-between mb-6">
        <StateBadge oracle={oracle} />
        <span className="mono text-[10px] text-muted">
          {oracle && !stale
            ? `Updated ${new Date(oracle.lastUpdated * 1000).toLocaleTimeString()}`
            : stale
            ? "SCORE STALE"
            : "Awaiting data"}
        </span>
      </div>

      <div className="space-y-3.5 border-t border-border pt-5">
        {components.map((c) => (
          <ComponentBar key={c.abbr} {...c} />
        ))}
      </div>

      <p className="mono text-[9px] text-muted mt-4 leading-relaxed">
        S(t) = 100 − (0.35·Lr + 0.30·At + 0.20·Od + 0.15·Vs)
      </p>
    </div>
  );
}
