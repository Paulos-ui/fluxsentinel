"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { NETWORK } from "@/config";

export function WalletButton() {
  const { connected, publicKey, disconnect, connecting } = useWallet();
  const { setVisible } = useWalletModal();

  if (connecting) {
    return (
      <button
        disabled
        className="w-full flex items-center justify-center gap-2 px-3 py-2 border border-border mono text-[10px] text-dim opacity-60 cursor-not-allowed"
      >
        <span className="w-3 h-3 border border-cyan border-t-transparent rounded-full animate-spin" />
        CONNECTING
      </button>
    );
  }

  if (connected && publicKey) {
    const addr = publicKey.toBase58();
    const short = `${addr.slice(0, 4)}...${addr.slice(-4)}`;

    return (
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => setVisible(true)}
          className="flex-1 flex items-center gap-2 px-2.5 py-1.5 border border-border hover:border-borderHi transition-colors"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-cyan" />
          <span className="mono text-[10px] text-text">{short}</span>
        </button>
        <button
          onClick={disconnect}
          title="Disconnect"
          className="px-2 py-1.5 border border-border hover:border-red/40 hover:text-red transition-colors mono text-[10px] text-dim"
        >
          ×
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setVisible(true)}
      className="w-full btn-primary py-2 text-[10px]"
    >
      CONNECT WALLET
    </button>
  );
}
