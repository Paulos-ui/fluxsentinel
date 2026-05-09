"use client";

import { TxState } from "@/types";
import { NETWORK } from "@/config";
import clsx from "clsx";

export function TxToast({ tx }: { tx: TxState }) {
  if (tx.status === "idle") return null;

  const explorerBase = "https://solscan.io/tx";
  const clusterParam =
    NETWORK === "mainnet-beta" ? "" : `?cluster=${NETWORK === "localnet" ? "custom&customUrl=http%3A%2F%2Flocalhost%3A8899" : NETWORK}`;

  return (
    <div
      className={clsx(
        "fixed bottom-5 right-5 z-50 panel px-5 py-4 max-w-sm",
        "animate-slide-up shadow-2xl",
        tx.status === "success" && "border-green/40",
        tx.status === "error" && "border-red/40",
        tx.status === "pending" && "border-cyan/30"
      )}
    >
      <div className="flex items-start gap-3">
        {/* Spinner / icon */}
        <div className="shrink-0 mt-0.5">
          {tx.status === "pending" && (
            <div className="w-3.5 h-3.5 border border-cyan border-t-transparent rounded-full animate-spin" />
          )}
          {tx.status === "success" && (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="7" r="6" stroke="#10B981" strokeWidth="1.2" />
              <path d="M4.5 7l2 2 3-3" stroke="#10B981" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
          {tx.status === "error" && (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="7" r="6" stroke="#EF4444" strokeWidth="1.2" />
              <path d="M5 5l4 4M9 5l-4 4" stroke="#EF4444" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div
            className={clsx(
              "mono text-[11px] font-medium mb-1",
              tx.status === "success" && "text-green",
              tx.status === "error" && "text-red",
              tx.status === "pending" && "text-cyan"
            )}
          >
            {tx.status === "pending" && "SUBMITTING TRANSACTION..."}
            {tx.status === "success" && "TRANSACTION CONFIRMED"}
            {tx.status === "error" && "TRANSACTION FAILED"}
          </div>

          {tx.status === "success" && tx.signature && (
            <a
              href={`${explorerBase}/${tx.signature}${clusterParam}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mono text-[10px] text-dim hover:text-cyan transition-colors block truncate"
            >
              {tx.signature.slice(0, 20)}...{tx.signature.slice(-8)} ↗
            </a>
          )}

          {tx.status === "error" && tx.error && (
            <p className="mono text-[10px] text-red/70 leading-relaxed">
              {tx.error.slice(0, 140)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
