"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { useOracleStore, scoreToColor, stateLabel } from "@/hooks/useOracle";
import { WalletButton } from "@/components/wallet/WalletButton";
import { NETWORK } from "@/config";
import clsx from "clsx";

const LINKS = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <rect x="1" y="1" width="5" height="5" stroke="currentColor" strokeWidth="1.1" />
        <rect x="8" y="1" width="5" height="5" stroke="currentColor" strokeWidth="1.1" />
        <rect x="1" y="8" width="5" height="5" stroke="currentColor" strokeWidth="1.1" />
        <rect x="8" y="8" width="5" height="5" stroke="currentColor" strokeWidth="1.1" />
      </svg>
    ),
  },
  {
    href: "/mint",
    label: "Mint / Vault",
    icon: (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.1" />
        <path d="M7 4.5v5M4.5 7l2.5-2.5 2.5 2.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/explorer",
    label: "Risk Explorer",
    icon: (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <polyline
          points="1,11 4.5,6.5 7,8.5 10.5,4 13,5.5"
          stroke="currentColor"
          strokeWidth="1.1"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
    ),
  },
];

export function Nav() {
  const pathname = usePathname();
  const { oracle, startPolling } = useOracleStore();

  // Hide sidebar on landing page (root)
  const isLanding = pathname === "/";

  useEffect(() => {
    if (isLanding) return;
    const stop = startPolling();
    return stop;
  }, [startPolling, isLanding]);

  if (isLanding) return null;

  const score = oracle?.score ?? 0;
  const stale = oracle?.isStale ?? false;
  const color = scoreToColor(score, stale);
  const state = stateLabel(score, stale);

  return (
    <aside className="w-56 min-h-screen border-r border-white/5 bg-bg2/40 backdrop-blur-xl flex flex-col shrink-0 relative">
      {/* Subtle gradient accent at top */}
      <div
        className="absolute top-0 left-0 right-0 h-px"
        style={{
          background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
        }}
      />

      {/* Logo */}
      <div className="px-5 py-5 border-b border-white/5">
        <Link href="/" className="flex items-center gap-2.5">
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <defs>
              <linearGradient id="navLogoG" x1="0" y1="0" x2="22" y2="22">
                <stop offset="0" stopColor="#00FFD1" />
                <stop offset="1" stopColor="#7B5FFF" />
              </linearGradient>
            </defs>
            <path
              d="M11 1.5L20.5 7V15L11 20.5L1.5 15V7L11 1.5Z"
              stroke="url(#navLogoG)"
              strokeWidth="1.3"
              fill="none"
            />
            <path d="M11 6L16 9V14L11 16.5L6 14V9L11 6Z" fill="url(#navLogoG)" opacity="0.4" />
          </svg>
          <div>
            <div className="text-bright text-[13px] font-semibold tracking-tight">FluxSentinel</div>
            <div className="mono text-[8px] text-dim tracking-widest mt-0.5">v0.1 · MVP</div>
          </div>
        </Link>
      </div>

      {/* Live score panel */}
      <div className="px-5 py-4 border-b border-white/5">
        <div className="label mb-2">SECURITY SCORE</div>
        <div className="flex items-baseline gap-2">
          <span
            className="font-display text-[28px] font-bold tabular-nums tracking-tight"
            style={{ color, textShadow: `0 0 20px ${color}30` }}
          >
            {oracle ? String(oracle.score).padStart(2, "0") : "—"}
          </span>
          <span className="mono text-[9px] text-dim">/100</span>
        </div>
        <span
          className="inline-flex mt-2 mono text-[9px] px-2 py-0.5 rounded"
          style={{
            color,
            background: `${color}15`,
            border: `1px solid ${color}30`,
          }}
        >
          {state}
        </span>
      </div>

      {/* Nav links */}
      <nav className="flex-1 px-2.5 py-3 space-y-1">
        {LINKS.map((link) => {
          const active = pathname === link.href || pathname.startsWith(link.href + "/");
          return (
            <Link
              key={link.href}
              href={link.href}
              className={clsx(
                "flex items-center gap-2.5 px-3 py-2.5 rounded-lg transition-all duration-150",
                active
                  ? "bg-white/5 text-bright"
                  : "text-dim hover:text-text hover:bg-white/[0.03]"
              )}
            >
              <span className={clsx("shrink-0", active ? "opacity-100" : "opacity-50")}>
                {link.icon}
              </span>
              <span className="text-[13px]">{link.label}</span>
              {active && (
                <span
                  className="ml-auto w-1 h-4 shrink-0 rounded-full"
                  style={{ background: color, boxShadow: `0 0 8px ${color}` }}
                />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Wallet + network footer */}
      <div className="px-3 py-4 border-t border-white/5 space-y-3">
        <WalletButton />
        <div className="flex items-center gap-2 px-1">
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{
              background: color,
              boxShadow: `0 0 6px ${color}80`,
            }}
          />
          <span className="mono text-[9px] text-dim uppercase">{NETWORK}</span>
          {oracle && !stale && (
            <span className="ml-auto mono text-[9px] text-muted">
              #{oracle.updateCount}
            </span>
          )}
        </div>
      </div>
    </aside>
  );
}
