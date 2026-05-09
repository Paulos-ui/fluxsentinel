"use client";

import { useEffect } from "react";
import {
  useOracleStore,
  scoreToColor,
  stateLabel,
  ratioFromScore,
} from "@/hooks/useOracle";
import { useWallet } from "@solana/wallet-adapter-react";

// ── Mock ticker data (replace with Pyth/Jupiter feed in production) ──────────
const TICKER = [
  { sym: "SOL",   px: "$184.2",     chg: "+2.4%",  up: true  },
  { sym: "JTO",   px: "$3.84",      chg: "+2.1%",  up: true  },
  { sym: "PYTH",  px: "$0.62",      chg: "+5.4%",  up: true  },
  { sym: "WIF",   px: "$2.18",      chg: "-3.2%",  up: false },
  { sym: "BONK",  px: "$0.000028",  chg: "+8.1%",  up: true  },
  { sym: "RAY",   px: "$4.72",      chg: "+1.4%",  up: true  },
  { sym: "ORCA",  px: "$3.21",      chg: "-0.8%",  up: false },
];

// ── Components ─────────────────────────────────────────────────────────────────

function Ticker() {
  return (
    <div className="border-y border-white/5 bg-black/30 px-6 py-3 overflow-hidden">
      <div className="flex gap-8 mono text-[12px] text-dim flex-wrap">
        {TICKER.map((t) => (
          <span key={t.sym} className="whitespace-nowrap">
            {t.sym} <span className="text-bright">{t.px}</span>{" "}
            <span className={t.up ? "text-green" : "text-red"}>
              {t.up ? "▲" : "▼"} {t.chg.replace(/^[+-]/, "")}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string;
  sub: string;
  change: string;
  changeUp: boolean;
  accent: string;
  icon: React.ReactNode;
  spark: string; // SVG path d= attribute for sparkline
}

function StatCard({ label, value, sub, change, changeUp, accent, icon, spark }: StatCardProps) {
  return (
    <div
      className="card p-5"
      style={{
        background: `linear-gradient(135deg, ${accent}10 0%, rgba(15,15,22,0.5) 100%)`,
      }}
    >
      <div className="flex justify-between items-start mb-4">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: `${accent}20`, border: `1px solid ${accent}30` }}
        >
          {icon}
        </div>
        <span className={changeUp ? "chg-up" : "chg-down"}>
          {changeUp ? "↗" : "↘"} {change}
        </span>
      </div>
      <div className="label mb-2">{label}</div>
      <div className="text-[28px] font-bold tracking-tight text-bright">{value}</div>
      <div className="text-dim text-[11px] mt-1.5">{sub}</div>
      <svg viewBox="0 0 200 30" className="w-full h-6 mt-3" preserveAspectRatio="none">
        <path d={spark} stroke={accent} strokeWidth="1.5" fill="none" />
      </svg>
    </div>
  );
}

function RadialScore({ score, color }: { score: number; color: string }) {
  const circumference = 2 * Math.PI * 80;
  const offset = circumference - (score / 100) * circumference;

  return (
    <svg width="220" height="220" viewBox="0 0 220 220">
      <defs>
        <linearGradient id="ringDash" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#00FFD1" />
          <stop offset="0.5" stopColor="#7B5FFF" />
          <stop offset="1" stopColor="#FF4365" />
        </linearGradient>
        <radialGradient id="cgDash">
          <stop offset="0" stopColor={color} stopOpacity="0.3" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </radialGradient>
        <filter id="ringGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <circle cx="110" cy="110" r="80" fill="url(#cgDash)" />
      <circle cx="110" cy="110" r="80" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10" />
      <circle
        cx="110"
        cy="110"
        r="80"
        fill="none"
        stroke="url(#ringDash)"
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform="rotate(-90 110 110)"
        filter="url(#ringGlow)"
        style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(0.4, 0, 0.2, 1)" }}
      />
      <text x="110" y="98" textAnchor="middle" fill="#666" fontFamily="JetBrains Mono" fontSize="9" letterSpacing="3">
        SCORE
      </text>
      <text
        x="110"
        y="132"
        textAnchor="middle"
        fontFamily="Inter"
        fontSize="56"
        fontWeight="700"
        fill="url(#ringDash)"
        letterSpacing="-0.04em"
      >
        {score}
      </text>
      <text x="110" y="156" textAnchor="middle" fill="#888" fontFamily="JetBrains Mono" fontSize="10">
        {score >= 80 ? "EXCELLENT" : score >= 60 ? "WATCH" : "CRITICAL"}
      </text>
    </svg>
  );
}

function ComponentBars({ oracle }: { oracle: any }) {
  const items = [
    { label: "Liquidity Risk",    value: oracle?.lr ?? 0, color: "#00FFD1", grad: "linear-gradient(90deg, #00FFD1, #00E89E)" },
    { label: "Anomaly Score",     value: oracle?.at ?? 0, color: "#F59E0B", grad: "linear-gradient(90deg, #F59E0B, #FFC547)" },
    { label: "Oracle Deviation",  value: oracle?.od ?? 0, color: "#7B5FFF", grad: "linear-gradient(90deg, #7B5FFF, #B8A8FF)" },
    { label: "Volatility Stress", value: oracle?.vs ?? 0, color: "#FF4365", grad: "linear-gradient(90deg, #FF4365, #FF8295)" },
  ];

  return (
    <div className="flex flex-col gap-4">
      {items.map((item) => (
        <div key={item.label}>
          <div className="flex justify-between mb-2">
            <span className="text-[12px] text-text/80">{item.label}</span>
            <span className="mono text-[12px]" style={{ color: item.color }}>
              {item.value}
            </span>
          </div>
          <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-1000"
              style={{ width: `${item.value}%`, background: item.grad }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function ThreatRadar({ oracle }: { oracle: any }) {
  // Map score components to radar vertices (out of 100, displayed inverted: high = good)
  const lr = 100 - (oracle?.lr ?? 0);
  const at = 100 - (oracle?.at ?? 0);
  const od = 100 - (oracle?.od ?? 0);
  const vs = 100 - (oracle?.vs ?? 0);
  const concentration = 70;
  const contract = 80;

  // Hexagon vertices (centered at 140,130, radius 90)
  const cx = 140, cy = 130, r = 90;
  const angles = [0, 60, 120, 180, 240, 300]; // degrees
  const labels = ["LIQUIDITY", "VOLATILITY", "CONCENTR.", "CONTRACT", "MARKET", "ORACLE"];
  const values = [lr, vs, concentration, contract, at, od];

  const points = values.map((v, i) => {
    const angle = ((angles[i] - 90) * Math.PI) / 180;
    const dist = (v / 100) * r;
    return {
      x: cx + dist * Math.cos(angle),
      y: cy + dist * Math.sin(angle),
    };
  });

  const polyPoints = points.map((p) => `${p.x},${p.y}`).join(" ");

  // Outer hexagon for grid
  const gridSizes = [r, r * 0.66, r * 0.33];

  const labelPoints = angles.map((a, i) => {
    const angle = ((a - 90) * Math.PI) / 180;
    const dist = r + 18;
    return {
      x: cx + dist * Math.cos(angle),
      y: cy + dist * Math.sin(angle) + 3,
    };
  });

  const overallRisk = Math.round((100 - lr + 100 - at + 100 - od + 100 - vs) / 4);
  const riskLabel = overallRisk < 30 ? "LOW" : overallRisk < 60 ? "MEDIUM" : "HIGH";
  const riskColor = overallRisk < 30 ? "pill-green" : overallRisk < 60 ? "pill-amber" : "pill-coral";

  return (
    <div className="card p-6 min-h-[340px]">
      <div className="flex justify-between items-start mb-4">
        <div>
          <div className="label mb-1">RISK SURFACE</div>
          <div className="text-[18px] font-semibold text-bright">Threat Vectors</div>
        </div>
        <span className={`pill ${riskColor}`}>{riskLabel}</span>
      </div>

      <svg width="100%" height="280" viewBox="0 0 280 260">
        {/* Hexagon grid */}
        <g stroke="rgba(255,255,255,0.07)" strokeWidth="0.5" fill="none">
          {gridSizes.map((size, i) => {
            const pts = angles.map((a) => {
              const angle = ((a - 90) * Math.PI) / 180;
              return `${cx + size * Math.cos(angle)},${cy + size * Math.sin(angle)}`;
            }).join(" ");
            return <polygon key={i} points={pts} />;
          })}
        </g>
        {/* Axis lines */}
        <g stroke="rgba(255,255,255,0.06)" strokeWidth="0.5">
          {angles.map((a, i) => {
            const angle = ((a - 90) * Math.PI) / 180;
            return (
              <line
                key={i}
                x1={cx}
                y1={cy}
                x2={cx + r * Math.cos(angle)}
                y2={cy + r * Math.sin(angle)}
              />
            );
          })}
        </g>
        {/* Data shape */}
        <polygon
          points={polyPoints}
          fill="rgba(123,95,255,0.18)"
          stroke="#7B5FFF"
          strokeWidth="1.5"
          style={{ transition: "all 0.6s ease" }}
        />
        {/* Vertex dots */}
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="3.5" fill="#7B5FFF" />
        ))}
        {/* Labels */}
        {labelPoints.map((p, i) => (
          <text
            key={i}
            x={p.x}
            y={p.y}
            textAnchor="middle"
            fill="#888"
            fontFamily="JetBrains Mono"
            fontSize="9"
            letterSpacing="2"
          >
            {labels[i]}
          </text>
        ))}
      </svg>
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { oracle, stats, history, startPolling } = useOracleStore();
  const { connected, publicKey } = useWallet();

  useEffect(() => {
    const stop = startPolling();
    return stop;
  }, [startPolling]);

  const score = oracle?.score ?? 87;
  const stale = oracle?.isStale ?? false;
  const color = scoreToColor(score, stale);
  const walletShort = publicKey
    ? `${publicKey.toBase58().slice(0, 4)}...${publicKey.toBase58().slice(-4)}`
    : "Not connected";

  return (
    <div className="min-h-screen pb-12">
      {/* Top header */}
      <div className="px-6 py-5 border-b border-white/5 flex flex-wrap justify-between items-center gap-4">
        <div>
          <div className="label mb-1">OVERVIEW</div>
          <h1 className="font-display text-[22px] font-semibold tracking-tight text-bright">
            Sentinel Command
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <input
              placeholder="Search wallet, vault, or transaction..."
              className="flux-input pl-10 w-[300px] md:w-[360px]"
            />
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-dim"
            >
              <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.2" />
              <path d="M9.5 9.5L12 12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
          </div>
          {connected ? (
            <div className="flex items-center gap-2 pill pill-green">
              <span className="live-dot" />
              <span>Connected · {walletShort}</span>
            </div>
          ) : (
            <div className="pill pill-amber">
              <span className="live-dot" style={{ background: "#F59E0B" }} />
              Not connected
            </div>
          )}
        </div>
      </div>

      {/* Live ticker */}
      <Ticker />

      <div className="p-6 flex flex-col gap-5">

        {/* Stat cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="TOTAL VALUE LOCKED"
            value={stats ? `$${(Number(stats.totalCollateralUsd) / 100 / 1000).toFixed(2)}K` : "$2.84M"}
            sub="across protocol vaults"
            change="+12.4%"
            changeUp
            accent="#7B5FFF"
            icon={
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <rect x="2" y="4" width="14" height="11" rx="2" stroke="#B8A8FF" strokeWidth="1.4" />
                <path d="M2 8h14" stroke="#B8A8FF" strokeWidth="1.4" />
              </svg>
            }
            spark="M0,22 L20,18 L40,20 L60,15 L80,12 L100,14 L120,9 L140,11 L160,7 L180,5 L200,3"
          />
          <StatCard
            label="PROTOCOL HEALTH"
            value={oracle ? `${oracle.score}.${(oracle.lr % 10)}` : "92.4"}
            sub="status: stable"
            change="+3.1%"
            changeUp
            accent="#00E89E"
            icon={
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M9 2L15 5V9.5C15 13 12.5 15.5 9 16.5C5.5 15.5 3 13 3 9.5V5L9 2Z" stroke="#00E89E" strokeWidth="1.4" fill="none" />
                <path d="M6.5 9L8 10.5L11.5 7" stroke="#00E89E" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            }
            spark="M0,15 L20,17 L40,14 L60,15 L80,12 L100,13 L120,11 L140,10 L160,8 L180,9 L200,7"
          />
          <StatCard
            label="ACTIVE YIELD (APY)"
            value="14.7%"
            sub="weighted average"
            change="-1.8%"
            changeUp={false}
            accent="#7B5FFF"
            icon={
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M2 14L6 9L9 12L16 4" stroke="#B8A8FF" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M11 4H16V9" stroke="#B8A8FF" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            }
            spark="M0,8 L20,10 L40,12 L60,9 L80,15 L100,11 L120,14 L140,18 L160,16 L180,20 L200,17"
          />
          <StatCard
            label="RISK PREMIUM"
            value="0.42"
            sub="bps · last hour"
            change="-8.2%"
            changeUp={false}
            accent="#FF4365"
            icon={
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <circle cx="9" cy="9" r="7" stroke="#FF8295" strokeWidth="1.4" />
                <path d="M9 5V9L12 11" stroke="#FF8295" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
            }
            spark="M0,5 L20,8 L40,7 L60,12 L80,10 L100,15 L120,13 L140,18 L160,16 L180,22 L200,20"
          />
        </div>

        {/* Main grid: oracle score + threat radar */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-4">

          {/* Oracle score */}
          <div className="card p-6 min-h-[340px]">
            <div className="flex justify-between items-start mb-5 flex-wrap gap-3">
              <div>
                <div className="flex items-center gap-3 mb-1.5">
                  <span className="label">ORACLE SCORE</span>
                  <span className="pill pill-green">
                    <span className="live-dot" />
                    LIVE
                  </span>
                </div>
                <div className="text-[20px] font-semibold text-bright">Wallet Creditworthiness</div>
                <div className="text-dim text-[12px] mt-0.5">
                  Real-time risk telemetry · {history.length || 14} on-chain sources
                </div>
              </div>
              <div className="flex gap-1.5">
                {["24H", "7D", "30D"].map((r, i) => (
                  <button
                    key={r}
                    className={
                      i === 1
                        ? "pill pill-green cursor-pointer"
                        : "pill bg-white/[0.04] border border-white/[0.08] text-dim hover:text-text cursor-pointer"
                    }
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-6 items-center">
              <div className="flex justify-center">
                <RadialScore score={score} color={color} />
              </div>
              <ComponentBars oracle={oracle} />
            </div>
          </div>

          {/* Threat radar */}
          <ThreatRadar oracle={oracle} />
        </div>

        {/* Bottom row: protocol info */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="card p-5">
            <div className="label mb-3">CIRCUIT BREAKER</div>
            <div className="flex items-center gap-3 mb-3">
              <div
                className="w-3 h-3 rounded-full"
                style={{ background: color, boxShadow: `0 0 12px ${color}` }}
              />
              <span className="text-[20px] font-semibold text-bright">
                {stateLabel(score, stale)}
              </span>
            </div>
            <div className="text-dim text-[12px]">
              Min. collateral ratio: <span className="text-bright mono">{ratioFromScore(score)}</span>
            </div>
          </div>

          <div className="card p-5">
            <div className="label mb-3">ORACLE STATE</div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[12px]">
              <span className="text-dim">Update #</span>
              <span className="mono text-bright text-right">
                {oracle ? `#${oracle.updateCount}` : "—"}
              </span>
              <span className="text-dim">Last updated</span>
              <span className="mono text-bright text-right">
                {oracle
                  ? new Date(oracle.lastUpdated * 1000).toLocaleTimeString()
                  : "—"}
              </span>
              <span className="text-dim">Status</span>
              <span className={`mono text-right ${stale ? "text-red" : "text-green"}`}>
                {oracle ? (stale ? "STALE ⚠" : "FRESH") : "WAITING"}
              </span>
            </div>
          </div>

          <div className="card p-5">
            <div className="label mb-3">SCORE THRESHOLDS</div>
            <div className="space-y-2 text-[12px]">
              <div className="flex justify-between">
                <span className="text-cyan">Open ≥80</span>
                <span className="mono text-text">150% min ratio</span>
              </div>
              <div className="flex justify-between">
                <span className="text-amber">Restricted ≥60</span>
                <span className="mono text-text">200% min ratio</span>
              </div>
              <div className="flex justify-between">
                <span className="text-red">Frozen &lt;60</span>
                <span className="mono text-text">all blocked</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
