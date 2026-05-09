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

        <h1 className="text-5xl md:text-7xl font-bold leading-tight mb-6">
          On-chain Risk Engine for{" "}
          <span className="bg-grad-brand bg-clip-text text-transparent">RWAs.</span>
        </h1>

        <p className="text-dim text-lg mb-8 max-w-lg mx-auto">
          A Solana-native stablecoin protocol that scores collateral 24/7 and dynamically enforces protocol safety on every transaction.
        </p>

        <div className="flex gap-3 justify-center">
          <Link href="/dashboard" className="btn-primary">
            Launch Dashboard →
          </Link>
          
            href="https://github.com/Paulos-ui/fluxsentinel"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary"
          >
            View on GitHub
          </a>
        </div>

        <div className="mt-16 grid grid-cols-3 gap-4">
          <div className="card p-5">
            <div className="text-cyan text-2xl mb-2">⚡</div>
            <h3 className="text-bright font-semibold mb-1">Real-time scoring</h3>
            <p className="text-dim text-sm">Score updated every 30 seconds</p>
          </div>
          <div className="card p-5">
            <div className="text-violet text-2xl mb-2">◈</div>
            <h3 className="text-bright font-semibold mb-1">Dynamic enforcement</h3>
            <p className="text-dim text-sm">Auto-adjusts collateral ratios</p>
          </div>
          <div className="card p-5">
            <div className="text-coral text-2xl mb-2">⌬</div>
            <h3 className="text-bright font-semibold mb-1">RWA vaults</h3>
            <p className="text-dim text-sm">Mint FluxUSD, redeem anytime</p>
          </div>
        </div>
      </div>
    </div>
  );
}