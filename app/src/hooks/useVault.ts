"use client";

import { useState, useCallback, useEffect } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddress } from "@solana/spl-token";
import { VaultData, TxState } from "@/types";
import {
  fetchVaultData,
  buildOpenVaultTx,
  buildDepositTx,
  buildMintFluxTx,
  buildRepayTx,
  buildWithdrawTx,
} from "@/lib/program";
import { FLUX_MINT_PDA } from "@/config";

export function useVault(collateralMint: PublicKey | null) {
  const { connection } = useConnection();
  const wallet = useWallet();

  const [vault, setVault]           = useState<VaultData | null>(null);
  const [loading, setLoading]       = useState(false);
  const [txState, setTxState]       = useState<TxState>({ status: "idle" });
  const [fluxBalance, setFluxBalance] = useState<bigint>(0n);

  // ── Refresh vault and FluxUSD balance ────────────────────────────
  const refresh = useCallback(async () => {
    if (!wallet.publicKey || !collateralMint) return;
    setLoading(true);
    try {
      const data = await fetchVaultData(connection, wallet.publicKey, collateralMint);
      setVault(data);

      // Fetch FluxUSD ATA balance
      try {
        const ata  = await getAssociatedTokenAddress(FLUX_MINT_PDA, wallet.publicKey);
        const info = await connection.getAccountInfo(ata);
        if (info && info.data.length >= 72) {
          // SPL token account: amount is at offset 64, u64 LE
          const amount = info.data.readBigUInt64LE(64);
          setFluxBalance(amount);
        } else {
          setFluxBalance(0n);
        }
      } catch {
        setFluxBalance(0n);
      }
    } catch (e) {
      console.warn("vault refresh error:", e);
    } finally {
      setLoading(false);
    }
  }, [connection, wallet.publicKey, collateralMint]);

  // Auto-refresh when wallet connects
  useEffect(() => {
    if (wallet.connected && wallet.publicKey && collateralMint) {
      refresh();
    }
  }, [wallet.connected, wallet.publicKey, collateralMint, refresh]);

  // ── Generic transaction sender ────────────────────────────────────
  const sendTx = useCallback(
    async (buildFn: () => Promise<any>) => {
      if (!wallet.publicKey || !wallet.sendTransaction) return;
      setTxState({ status: "pending" });

      try {
        const tx  = await buildFn();
        const sig = await wallet.sendTransaction(tx, connection, {
          skipPreflight: false,
          maxRetries: 3,
        });

        // Wait for confirmation
        const { blockhash, lastValidBlockHeight } =
          await connection.getLatestBlockhash("confirmed");
        await connection.confirmTransaction(
          { signature: sig, blockhash, lastValidBlockHeight },
          "confirmed"
        );

        setTxState({ status: "success", signature: sig });

        // Auto-clear after 6s and refresh vault
        setTimeout(() => setTxState({ status: "idle" }), 6000);
        await refresh();
      } catch (e: any) {
        const message =
          e?.message ??
          e?.logs?.join("\n") ??
          "Transaction failed";
        setTxState({ status: "error", error: message });
        setTimeout(() => setTxState({ status: "idle" }), 8000);
      }
    },
    [wallet, connection, refresh]
  );

  // ── Individual action builders ────────────────────────────────────
  const openVault = useCallback(
    (pricePerToken: bigint) => {
      if (!collateralMint) return Promise.resolve();
      return sendTx(() =>
        buildOpenVaultTx(connection, wallet, collateralMint, pricePerToken)
      );
    },
    [connection, wallet, collateralMint, sendTx]
  );

  const deposit = useCallback(
    (amount: bigint) => {
      if (!collateralMint) return Promise.resolve();
      return sendTx(() =>
        buildDepositTx(connection, wallet, collateralMint, amount)
      );
    },
    [connection, wallet, collateralMint, sendTx]
  );

  const mintFlux = useCallback(
    (amountUsdCents: bigint) => {
      if (!collateralMint) return Promise.resolve();
      return sendTx(() =>
        buildMintFluxTx(connection, wallet, collateralMint, amountUsdCents)
      );
    },
    [connection, wallet, collateralMint, sendTx]
  );

  const repay = useCallback(
    (tokenAmount: bigint) => {
      if (!collateralMint) return Promise.resolve();
      return sendTx(() =>
        buildRepayTx(connection, wallet, collateralMint, tokenAmount)
      );
    },
    [connection, wallet, collateralMint, sendTx]
  );

  const withdraw = useCallback(
    (amount: bigint) => {
      if (!collateralMint) return Promise.resolve();
      return sendTx(() =>
        buildWithdrawTx(connection, wallet, collateralMint, amount)
      );
    },
    [connection, wallet, collateralMint, sendTx]
  );

  return {
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
  };
}
