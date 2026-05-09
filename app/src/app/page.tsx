"use client";

import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="min-h-screen w-full overflow-x-hidden">
      {/* Gradient frame wrapping the hero */}
      <div className="p-3 md:p-5">
        <div className="gradient-frame">
          <div className="gradient-frame-inner">

            {/* Top nav */}
            <nav className="relative z-10 flex items-center justify-between px-6 md:px-8 py-5">
              <div className="flex items-center gap-2.5">
                <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                  <defs>
                    <linearGradient id="logoG" x1="0" y1="0" x2="28" y2="28">
                      <stop offset="0" stopColor="#00FFD1" />
                      <stop offset="1" stopColor="#7B5FFF" />
                    </linearGradient>
                  </defs>
                  <path d="M14 2L26 9V19L14 26L2 19V9L14 2Z" stroke="url(#logoG)" strokeWidth="1.5" fill="none" />
                  <path d="M14 8L20 12V18L14 21L8 18V12L14 8Z" fill="url(#logoG)" opacity="0.4" />
                </svg>
                <div>
                  <div className="font-semibold text-[15px] tracking-tight">FluxSentinel</div>
                  <div className="mono text-[9px] text-dim tracking-[0.18em]">PROTOCOL · v0.1</div>
                </div>
              </div>

              <div className="hidden md:flex gap-8 text-[13px] text-dim">
                <a href="#protocol" className="text-bright">Protocol</a>
                <Link href="/mint" className="hover:text-bright transition-colors">Vault</Link>
                <Link href="/explorer" className="hover:text-bright transition-colors">Risk Engine</Link>
                <a href="#docs" className="hover:text-bright transition-colors">Docs</a>
              </div>

              <Link href="/dashboard" className="btn-primary">
                Launch App <span>→</span>
              </Link>
            </nav>

            {/* Hero content */}
            <div className="relative z-10 px-6 md:px-12 pt-8 pb-32 grid grid-cols-1 md:grid-cols-[1.1fr_1fr] gap-8 items-center min-h-[560px]">

              {/* Left: text */}
              <div>
                <div className="pill pill-violet mb-6">
                  <span className="live-dot" style={{ background: "#B8A8FF" }} />
                  REAL-TIME RISK SCORING
                </div>

                <h1 className="font-display text-5xl md:text-7xl lg:text-8xl font-bold leading-[0.95] tracking-tight mb-6">
                  On-chain<br />
                  Risk Engine<br />
                  for <span className="text-gradient">RWAs.</span>
                </h1>

                <p className="text-[15px] text-dim leading-relaxed max-w-md mb-8">
                  A Solana-native stablecoin protocol that scores your collateral 24/7 — and dynamically enforces protocol safety on every transaction.
                </p>

                <div className="flex flex-wrap gap-3 items-center">
                  <Link href="/dashboard" className="btn-primary">
                    Launch dashboard <span>→</span>
                  </Link>
                  <a
                    href="https://github.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-secondary"
                  >
                    View on GitHub
                  </a>
                </div>
              </div>

              {/* Right: animated score gauge */}
              <div className="flex justify-center items-center relative">
                <div className="absolute inset-0 bg-grad-mesh opacity-30 blur-3xl pointer-events-none" />

                <svg width="100%" height="100%" viewBox="0 0 380 380" className="max-w-[420px] relative z-10 animate-float">
                  <defs>
                    <linearGradient id="ringG" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0" stopColor="#00FFD1" />
                      <stop offset="0.5" stopColor="#7B5FFF" />
                      <stop offset="1" stopColor="#FF4365" />
                    </linearGradient>
                    <radialGradient id="coreG">
                      <stop offset="0" stopColor="#00FFD1" stopOpacity="0.4" />
                      <stop offset="0.6" stopColor="#7B5FFF" stopOpacity="0.2" />
                      <stop offset="1" stopColor="#FF4365" stopOpacity="0" />
                    </radialGradient>
                    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                      <feGaussianBlur stdDeviation="6" result="b" />
                      <feMerge>
                        <feMergeNode in="b" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                  </defs>

                  {/* Background grid circles */}
                  <g opacity="0.15">
                    <circle cx="190" cy="190" r="170" fill="none" stroke="#fff" strokeWidth="0.5" />
                    <circle cx="190" cy="190" r="130" fill="none" stroke="#fff" strokeWidth="0.5" />
                    <circle cx="190" cy="190" r="90" fill="none" stroke="#fff" strokeWidth="0.5" />
                  </g>

                  {/* Glow core */}
                  <circle cx="190" cy="190" r="100" fill="url(#coreG)" />

                  {/* Track ring */}
                  <circle cx="190" cy="190" r="130" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="14" />

                  {/* Score ring (87/100 = 70% of full ring) */}
                  <circle
                    cx="190"
                    cy="190"
                    r="130"
                    fill="none"
                    stroke="url(#ringG)"
                    strokeWidth="14"
                    strokeLinecap="round"
                    strokeDasharray="817"
                    strokeDashoffset="246"
                    transform="rotate(-90 190 190)"
                    filter="url(#glow)"
                  />

                  {/* Center text */}
                  <text x="190" y="178" textAnchor="middle" fill="#666" fontFamily="JetBrains Mono" fontSize="11" letterSpacing="3">
                    SECURITY SCORE
                  </text>
                  <text x="190" y="232" textAnchor="middle" fontFamily="Inter" fontSize="92" fontWeight="700" letterSpacing="-0.04em" fill="url(#ringG)">
                    87
                  </text>
                  <text x="190" y="262" textAnchor="middle" fill="#666" fontFamily="JetBrains Mono" fontSize="11">
                    / 100
                  </text>

                  {/* Floating badges */}
                  <g transform="translate(40 60)">
                    <rect x="0" y="0" width="80" height="32" rx="16" fill="rgba(0,255,209,0.1)" stroke="rgba(0,255,209,0.3)" strokeWidth="0.5" />
                    <circle cx="14" cy="16" r="3" fill="#00FFD1" />
                    <text x="26" y="20" fill="#00FFD1" fontFamily="JetBrains Mono" fontSize="10" fontWeight="500">OPEN</text>
                  </g>
                  <g transform="translate(290 290)">
                    <rect x="0" y="0" width="60" height="28" rx="14" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.1)" strokeWidth="0.5" />
                    <text x="30" y="18" textAnchor="middle" fill="#fff" fontFamily="JetBrains Mono" fontSize="9">+12.4%</text>
                  </g>
                  <g transform="translate(30 280)">
                    <rect x="0" y="0" width="80" height="28" rx="14" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.1)" strokeWidth="0.5" />
                    <text x="40" y="18" textAnchor="middle" fill="#aaa" fontFamily="JetBrains Mono" fontSize="9">14 SOURCES</text>
                  </g>
                </svg>
              </div>
            </div>

            {/* Backed by strip */}
            <div className="absolute bottom-6 left-6 md:left-12 right-6 md:right-12 flex flex-wrap items-center justify-between gap-4 border-t border-white/5 pt-5">
              <span className="text-[#555] text-[11px] mono tracking-widest">BACKED BY</span>
              <div className="flex flex-wrap gap-9 items-center font-medium text-[13px] text-dim">
                <span className="tracking-wider">PYTH</span>
                <span className="tracking-wider">SOLANA · FOUNDATION</span>
                <span className="tracking-wider">HELIUS</span>
                <span className="tracking-wider">JITO</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Feature strip below hero */}
      <div className="px-3 md:px-5 pb-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          {[
            {
              icon: "⚡",
              title: "Real-time scoring",
              desc: "On-chain S(t) updated every 30 seconds across 14 telemetry sources.",
              accent: "#00FFD1",
            },
            {
              icon: "◈",
              title: "Dynamic enforcement",
              desc: "Circuit breaker auto-adjusts collateral ratios as risk climbs.",
              accent: "#7B5FFF",
            },
            {
              icon: "⌬",
              title: "RWA-native vaults",
              desc: "Tokenize invoices, mint FluxUSD, withdraw — all governed by score.",
              accent: "#FF4365",
            },
          ].map((f) => (
            <div key={f.title} className="card p-6">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center mb-4 text-xl font-mono"
                style={{
                  background: `${f.accent}15`,
                  color: f.accent,
                  border: `1px solid ${f.accent}30`,
                }}
              >
                {f.icon}
              </div>
              <h3 className="text-bright text-[15px] font-semibold mb-2">{f.title}</h3>
              <p className="text-dim text-[13px] leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
