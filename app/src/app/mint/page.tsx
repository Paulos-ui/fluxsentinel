"use client";

import { useEffect } from "react";
import { useOracleStore } from "@/hooks/useOracle";
import { ScoreCard } from "@/components/oracle/ScoreCard";
import { VaultPanel } from "@/components/vault/VaultPanel";

export default function MintPage() {
  const { oracle, startPolling } = useOracleStore();

  useEffect(() => {
    const stop = startPolling();
    return stop;
  }, [startPolling]);

  return (
    <div className="p-8 animate-fade-in">
      <div className="mb-7">
        <h1 className="text-2xl text-bright mb-1.5" style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700 }}>
          Mint / Vault
        </h1>
        <p className="mono text-[10px] text-dim">
          Deposit RWA collateral → Mint FluxUSD · All operations enforced on-chain by circuit breaker
        </p>
      </div>

      <div className="grid grid-cols-12 gap-5">
        {/* Left: context */}
        <div className="col-span-4 space-y-4">
          <ScoreCard oracle={oracle} />

          <div className="panel p-5">
            <div className="label mb-3">FLOW</div>
            <div className="space-y-3 mono text-[11px] text-dim">
              {[
                ["1 · DEPOSIT",  "Send RWA tokens to vault escrow PDA"],
                ["2 · MINT",     "Mint FluxUSD up to collateral limit"],
                ["3 · REPAY",    "Burn FluxUSD to reduce debt"],
                ["4 · WITHDRAW", "Retrieve collateral (ratio enforced)"],
              ].map(([step, desc]) => (
                <div key={String(step)} className="flex gap-2.5">
                  <span className="text-cyan text-[9px] mt-0.5 shrink-0">{step}</span>
                  <span>{desc}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="panel p-5">
            <div className="label mb-3">RATIO BY STATE</div>
            <div className="space-y-2 mono text-xs">
              {[
                { state: "Open ≥80",       ratio: "150%", color: "#00FFD1" },
                { state: "Restricted ≥60", ratio: "200%", color: "#F59E0B" },
                { state: "Frozen <60",     ratio: "∞",    color: "#EF4444" },
              ].map((r) => (
                <div key={r.state} className="flex justify-between items-center">
                  <span style={{ color: r.color }}>{r.state}</span>
                  <span className="text-text">{r.ratio}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: vault operations */}
        <div className="col-span-8">
          <VaultPanel />
        </div>
      </div>
    </div>
  );
}
