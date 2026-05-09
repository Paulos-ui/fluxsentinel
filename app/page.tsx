"use client";

import Link from "next/link";

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8">
      <div className="max-w-2xl text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet/10 border border-violet/30 mb-6">
          <span className="w-2 h-2 rounded-full bg-violet animate-pulse" />
          <span className="mono text-xs text-violetLight">REAL-TIME RISK SCORING</span>
        </div>

        <h1 className="text-5xl md:text-7xl font-bold leading-tight mb-6 text-bright">
          On-chain Risk Engine for{" "}
          <span className="bg-grad-brand bg-clip-text text-transparent">RWAs.</span>
        </h1>

        <p className="text-dim text-lg mb-8 max-w-lg mx-auto">
          A Solana-native stablecoin protocol that scores collateral 24/7 and dynamically enforces protocol safety on every transaction.
        </p>

        <div className="flex gap-3 justify-center mb-16">
          <Link
            href="/dashboard"
            className="bg-cyan text-bg px-6 py-3 rounded-lg font-semibold hover:bg-cyanDim transition-colors"
          >
            Launch Dashboard →
          </Link>
          
            href="https://github.com/Paulos-ui/fluxsentinel"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-surface border border-border text-text px-6 py-3 rounded-lg font-semibold hover:border-borderHi transition-colors"
          >
            View on GitHub
          </a>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
          <div className="bg-surface border border-border rounded-2xl p-5">
            <div className="text-cyan text-2xl mb-2">⚡</div>
            <h3 className="text-bright font-semibold mb-1">Real-time scoring</h3>
            <p className="text-dim text-sm">Score updated every 30 seconds</p>
          </div>
          <div className="bg-surface border border-border rounded-2xl p-5">
            <div className="text-violet text-2xl mb-2">◈</div>
            <h3 className="text-bright font-semibold mb-1">Dynamic enforcement</h3>
            <p className="text-dim text-sm">Auto-adjusts collateral ratios</p>
          </div>
          <div className="bg-surface border border-border rounded-2xl p-5">
            <div className="text-coral text-2xl mb-2">⌬</div>
            <h3 className="text-bright font-semibold mb-1">RWA vaults</h3>
            <p className="text-dim text-sm">Mint FluxUSD, redeem anytime</p>
          </div>
        </div>
      </div>
    </div>
  );
}