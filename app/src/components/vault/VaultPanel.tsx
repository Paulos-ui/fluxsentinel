"use client";

import { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { useVault } from "@/hooks/useVault";
import { useOracleStore, scoreToColor, stateLabel } from "@/hooks/useOracle";
import { TxToast } from "@/components/ui/TxToast";
import clsx from "clsx";

// ── Constants ─────────────────────────────────────────────────────────────────
// Devnet USDC mint used as demo collateral token
// In production this would be configurable per RWA asset type
const DEMO_COLLATERAL_MINT = new PublicKey(
  "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU" // devnet USDC
);
// Price: $1.00 per token = 100 cents × 1e6 (for 6 decimal token precision)
const TOKEN_PRICE_USD_CENTS = 100n * 1_000_000n; // 1.00 USD per token unit

type Tab = "deposit" | "mint" | "repay" | "withdraw";

// ── Formatting helpers ────────────────────────────────────────────────────────
function fmtFlux(raw: bigint): string {
  const n = Number(raw) / 1e6;
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  });
}

function fmtUsd(cents: bigint): string {
  const n = Number(cents) / 100;
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function fmtTokens(raw: bigint): string {
  const n = Number(raw) / 1e6;
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  });
}

// ── Vault Summary ─────────────────────────────────────────────────────────────
function VaultSummary({
  vault,
  fluxBalance,
}: {
  vault: NonNullable<ReturnType<typeof useVault>["vault"]>;
  fluxBalance: bigint;
}) {
  const oracle = useOracleStore((s) => s.oracle);
  const score  = oracle?.score ?? 100;

  const minRatio = score >= 80 ? "150%" : score >= 60 ? "200%" : "∞";
  const ratioColor =
    vault.collateralRatioPct > 200
      ? "#00FFD1"
      : vault.collateralRatioPct > 150
      ? "#F59E0B"
      : "#EF4444";

  const items = [
    {
      label: "Collateral",
      value: fmtUsd(vault.collateralUsd),
      sub: `${fmtTokens(vault.collateralAmount)} tokens`,
    },
    {
      label: "FluxUSD Debt",
      value: `${fmtFlux(vault.fluxDebt)} FUSD`,
      sub: fmtUsd(vault.fluxDebt / 10_000n),
    },
    {
      label: "Ratio",
      value:
        vault.collateralRatioPct === Infinity
          ? "∞"
          : `${vault.collateralRatioPct.toFixed(0)}%`,
      color: ratioColor,
      sub: `Min: ${minRatio}`,
    },
    {
      label: "Mintable",
      value:
        score < 80 ? "PAUSED" : fmtUsd(vault.maxMintableUsd),
      color: score >= 80 ? "#00FFD1" : "#6B7280",
      sub: score >= 80 ? "At 150% ratio" : "Protocol restricted",
    },
    {
      label: "FUSD Balance",
      value: `${fmtFlux(fluxBalance)} FUSD`,
      sub: "In wallet",
    },
  ];

  return (
    <div className="panel p-5 mb-4">
      <div className="label mb-4">VAULT SUMMARY</div>
      <div className="grid grid-cols-5 gap-3">
        {items.map((item) => (
          <div key={item.label}>
            <div className="label mb-1.5">{item.label}</div>
            <div
              className="mono text-sm font-medium"
              style={{ color: item.color ?? "#EBF0FA" }}
            >
              {item.value}
            </div>
            {item.sub && (
              <div className="mono text-[10px] text-dim mt-0.5">{item.sub}</div>
            )}
          </div>
        ))}
      </div>

      {/* Collateral ratio bar */}
      <div className="mt-4">
        <div className="flex justify-between mono text-[9px] text-muted mb-1">
          <span>Collateral ratio</span>
          <span>Danger: &lt;150% | Safe: &gt;200%</span>
        </div>
        <div className="h-px bg-border relative overflow-hidden">
          <div
            className="absolute top-0 left-0 h-full transition-all duration-700"
            style={{
              width: `${Math.min(100, (vault.collateralRatioPct / 300) * 100)}%`,
              background: ratioColor,
            }}
          />
          {/* 150% marker */}
          <div
            className="absolute top-[-3px] w-px h-[7px] bg-dim"
            style={{ left: "50%" }}
          />
          {/* 200% marker */}
          <div
            className="absolute top-[-3px] w-px h-[7px] bg-borderHi"
            style={{ left: "66.7%" }}
          />
        </div>
      </div>
    </div>
  );
}

// ── Tab forms ─────────────────────────────────────────────────────────────────
function DepositForm({
  onSubmit,
  blocked,
}: {
  onSubmit: (amount: bigint) => void;
  blocked: boolean;
}) {
  const [value, setValue] = useState("");

  return (
    <div className="space-y-4">
      <div>
        <div className="label mb-2">TOKEN AMOUNT</div>
        <div className="relative">
          <input
            className="flux-input pr-20"
            type="number"
            min="0"
            step="0.000001"
            placeholder="100.000000"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            disabled={blocked}
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 mono text-xs text-dim">
            TOKENS
          </span>
        </div>
        <p className="mono text-[10px] text-dim mt-2 leading-relaxed">
          Deposits RWA collateral tokens into vault escrow PDA. The circuit
          breaker is checked on-chain before transfer.
        </p>
      </div>
      <button
        className="btn-primary w-full"
        disabled={!value || Number(value) <= 0 || blocked}
        onClick={() => {
          const raw = BigInt(Math.round(parseFloat(value) * 1e6));
          onSubmit(raw);
          setValue("");
        }}
      >
        {blocked ? "FROZEN — OPERATION BLOCKED" : "DEPOSIT COLLATERAL"}
      </button>
    </div>
  );
}

function MintForm({
  onSubmit,
  maxUsd,
  blocked,
}: {
  onSubmit: (amountUsdCents: bigint) => void;
  maxUsd: bigint;
  blocked: boolean;
}) {
  const [value, setValue] = useState("");
  const maxDisplay = (Number(maxUsd) / 100).toFixed(2);

  return (
    <div className="space-y-4">
      <div>
        <div className="flex justify-between mb-2">
          <div className="label">MINT AMOUNT (USD)</div>
          <button
            className="mono text-[10px] text-cyan hover:underline"
            onClick={() => setValue(maxDisplay)}
            disabled={blocked}
          >
            MAX {fmtUsd(maxUsd)}
          </button>
        </div>
        <div className="relative">
          <input
            className="flux-input pr-16"
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            disabled={blocked}
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 mono text-xs text-dim">
            FUSD
          </span>
        </div>
      </div>

      {/* Live limit display */}
      <div className="panel p-4 bg-bg">
        <div className="label mb-2.5">CURRENT LIMITS</div>
        <div className="space-y-2 mono text-xs">
          {[
            { k: "Max mintable",       v: fmtUsd(maxUsd),  accent: true },
            { k: "Min collateral ratio", v: blocked ? "200% (Restricted)" : "150% (Open)" },
            { k: "Circuit breaker",    v: blocked ? "BLOCKED" : "OPEN", warn: blocked },
          ].map(({ k, v, accent, warn }) => (
            <div key={k} className="flex justify-between">
              <span className="text-dim">{k}</span>
              <span
                className={clsx(
                  warn ? "text-amber" : accent ? "text-cyan" : "text-text"
                )}
              >
                {v}
              </span>
            </div>
          ))}
        </div>
      </div>

      <button
        className="btn-primary w-full"
        disabled={!value || Number(value) <= 0 || blocked}
        onClick={() => {
          const cents = BigInt(Math.round(parseFloat(value) * 100));
          onSubmit(cents);
          setValue("");
        }}
      >
        {blocked ? "MINTING DISABLED — PROTOCOL RESTRICTED" : "MINT FLUXUSD"}
      </button>
    </div>
  );
}

function RepayForm({
  onSubmit,
  debtTokens,
  fluxBalance,
}: {
  onSubmit: (tokenAmount: bigint) => void;
  debtTokens: bigint;
  fluxBalance: bigint;
}) {
  const [value, setValue] = useState("");
  const maxRepay = debtTokens < fluxBalance ? debtTokens : fluxBalance;

  return (
    <div className="space-y-4">
      <div>
        <div className="flex justify-between mb-2">
          <div className="label">FLUXUSD TO BURN</div>
          <button
            className="mono text-[10px] text-cyan hover:underline"
            onClick={() => setValue(fmtFlux(maxRepay))}
          >
            MAX {fmtFlux(maxRepay)}
          </button>
        </div>
        <div className="relative">
          <input
            className="flux-input pr-16"
            type="number"
            min="0"
            step="0.000001"
            placeholder="0.000000"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 mono text-xs text-dim">
            FUSD
          </span>
        </div>
        <div className="flex justify-between mono text-[10px] text-dim mt-2">
          <span>Outstanding debt: {fmtFlux(debtTokens)} FUSD</span>
          <span>Wallet balance: {fmtFlux(fluxBalance)} FUSD</span>
        </div>
      </div>

      <div className="panel p-3 bg-bg border-cyan/20 border">
        <p className="mono text-[10px] text-dim leading-relaxed">
          Repayment burns FluxUSD and reduces vault debt. Always permitted —
          available in all protocol states including Frozen.
        </p>
      </div>

      <button
        className="btn-primary w-full"
        disabled={!value || Number(value) <= 0 || debtTokens === 0n}
        onClick={() => {
          const raw = BigInt(Math.round(parseFloat(value) * 1e6));
          onSubmit(raw);
          setValue("");
        }}
      >
        REPAY FLUXUSD
      </button>
    </div>
  );
}

function WithdrawForm({
  onSubmit,
  collateralAmount,
  blocked,
}: {
  onSubmit: (amount: bigint) => void;
  collateralAmount: bigint;
  blocked: boolean;
}) {
  const [value, setValue] = useState("");

  return (
    <div className="space-y-4">
      <div>
        <div className="flex justify-between mb-2">
          <div className="label">TOKENS TO WITHDRAW</div>
          <span className="mono text-[10px] text-dim">
            In vault: {fmtTokens(collateralAmount)}
          </span>
        </div>
        <div className="relative">
          <input
            className="flux-input pr-20"
            type="number"
            min="0"
            step="0.000001"
            placeholder="0.000000"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            disabled={blocked}
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 mono text-xs text-dim">
            TOKENS
          </span>
        </div>
      </div>

      {blocked && (
        <div className="border border-red/30 bg-red/5 p-3">
          <p className="mono text-[11px] text-red">
            Protocol is Frozen. All withdrawals are blocked.
          </p>
        </div>
      )}

      <div className="panel p-3 bg-bg">
        <div className="label mb-2">POST-WITHDRAWAL CHECK</div>
        <p className="mono text-[10px] text-dim leading-relaxed">
          On-chain: remaining collateral must cover outstanding debt at the
          current minimum ratio. Transaction reverts if this check fails.
        </p>
      </div>

      <button
        className="btn-primary w-full"
        disabled={!value || Number(value) <= 0 || blocked}
        onClick={() => {
          const raw = BigInt(Math.round(parseFloat(value) * 1e6));
          onSubmit(raw);
          setValue("");
        }}
      >
        {blocked ? "FROZEN — BLOCKED" : "WITHDRAW COLLATERAL"}
      </button>
    </div>
  );
}

// ── Main VaultPanel ───────────────────────────────────────────────────────────
const TABS: { id: Tab; label: string }[] = [
  { id: "deposit",  label: "Deposit" },
  { id: "mint",     label: "Mint FUSD" },
  { id: "repay",    label: "Repay" },
  { id: "withdraw", label: "Withdraw" },
];

export function VaultPanel() {
  const { connected, publicKey } = useWallet();
  const [activeTab, setActiveTab] = useState<Tab>("deposit");
  const oracle = useOracleStore((s) => s.oracle);
  const score  = oracle?.score ?? 100;

  const isFrozen     = score < 60;
  const isRestricted = score < 80;

  const {
    vault,
    loading,
    txState,
    fluxBalance,
    refresh,
    openVault,
    deposit,
    mintFlux,
    repay,
    withdraw,
  } = useVault(DEMO_COLLATERAL_MINT);

  if (!connected) {
    return (
      <div className="panel p-12 text-center">
        <div className="w-12 h-12 border border-border mx-auto mb-4 flex items-center justify-center">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <rect x="2" y="6" width="16" height="12" rx="1" stroke="#6B7280" strokeWidth="1.3" />
            <path d="M6 6V5a4 4 0 018 0v1" stroke="#6B7280" strokeWidth="1.3" />
            <circle cx="10" cy="12" r="1.5" fill="#6B7280" />
          </svg>
        </div>
        <div className="mono text-sm text-dim">Connect your wallet to access the vault</div>
        <p className="mono text-[11px] text-muted mt-2">
          Supports Phantom and Solflare on devnet/localnet
        </p>
      </div>
    );
  }

  return (
    <div>
      <TxToast tx={txState} />

      {/* Protocol state alert */}
      {isRestricted && (
        <div
          className={clsx(
            "border p-4 mb-4 flex gap-3",
            isFrozen
              ? "border-red/30 bg-red/5"
              : "border-amber/30 bg-amber/5"
          )}
        >
          <span className={isFrozen ? "text-red mt-0.5" : "text-amber mt-0.5"}>
            ⚠
          </span>
          <div>
            <div
              className={clsx(
                "mono text-xs font-medium mb-1",
                isFrozen ? "text-red" : "text-amber"
              )}
            >
              Protocol {isFrozen ? "Frozen" : "Restricted"} — Score {score}
            </div>
            <p className="mono text-[11px] text-dim leading-relaxed">
              {isFrozen
                ? "Score below 60. All mutations blocked on-chain. Only repayment is permitted."
                : "Score below 80. Minting and deposits are paused. Withdrawals and repayments remain available."}
            </p>
          </div>
        </div>
      )}

      {/* No vault — show open button */}
      {!loading && !vault && (
        <div className="panel p-8 text-center mb-4">
          <div className="mono text-sm text-text mb-2">No vault found</div>
          <p className="mono text-[11px] text-dim mb-5">
            Open a vault to deposit collateral and mint FluxUSD stablecoin.
          </p>
          <button
            className="btn-primary"
            onClick={() => openVault(TOKEN_PRICE_USD_CENTS)}
          >
            OPEN VAULT
          </button>
          <p className="mono text-[10px] text-muted mt-3">
            Uses devnet USDC as demo collateral ($1.00/token)
          </p>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="panel p-6 text-center mb-4">
          <div className="flex items-center justify-center gap-2 mono text-xs text-dim">
            <span className="w-3.5 h-3.5 border border-cyan border-t-transparent rounded-full animate-spin" />
            Loading vault...
          </div>
        </div>
      )}

      {/* Vault found — show summary + operations */}
      {vault && (
        <>
          <VaultSummary vault={vault} fluxBalance={fluxBalance} />

          {/* Tab operations */}
          <div className="panel">
            <div className="flex border-b border-border">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={clsx(
                    "px-4 py-3 mono text-[11px] uppercase tracking-wider border-b-2 -mb-px transition-colors",
                    activeTab === tab.id
                      ? "border-cyan text-cyan"
                      : "border-transparent text-dim hover:text-text"
                  )}
                >
                  {tab.label}
                </button>
              ))}

              {/* Refresh button */}
              <button
                onClick={refresh}
                className="ml-auto px-4 py-3 mono text-[10px] text-muted hover:text-dim transition-colors"
                title="Refresh vault"
              >
                ↻
              </button>
            </div>

            <div className="p-5">
              {activeTab === "deposit" && (
                <DepositForm onSubmit={deposit} blocked={isFrozen} />
              )}
              {activeTab === "mint" && (
                <MintForm
                  onSubmit={mintFlux}
                  maxUsd={vault.maxMintableUsd}
                  blocked={isRestricted}
                />
              )}
              {activeTab === "repay" && (
                <RepayForm
                  onSubmit={repay}
                  debtTokens={vault.fluxDebt}
                  fluxBalance={fluxBalance}
                />
              )}
              {activeTab === "withdraw" && (
                <WithdrawForm
                  onSubmit={withdraw}
                  collateralAmount={vault.collateralAmount}
                  blocked={isFrozen}
                />
              )}
            </div>
          </div>

          {/* Security note */}
          <div className="mt-4 px-4 py-3 border-l-2 border-border">
            <p className="mono text-[10px] text-muted leading-relaxed">
              All operations are enforced on-chain via the circuit breaker
              program. The UI reflects on-chain state — protocol restrictions
              cannot be bypassed through this interface.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
