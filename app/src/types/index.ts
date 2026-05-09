export type ProtocolState = "Open" | "Restricted" | "Frozen" | "Unknown";
export interface OracleData { score: number; lr: number; at: number; od: number; vs: number; lastUpdated: number; updateCount: number; protocolState: ProtocolState; isStale: boolean; }
export interface VaultData { address: string; owner: string; collateralMint: string; collateralAmount: bigint; collateralUsd: bigint; fluxDebt: bigint; tokenUsdPrice: bigint; openedAt: number; collateralRatioPct: number; maxMintableUsd: bigint; }
export interface ProtocolStats { totalCollateralUsd: bigint; totalFluxMinted: bigint; vaultCount: bigint; }
export type TxStatus = "idle" | "pending" | "success" | "error";
export interface TxState { status: TxStatus; signature?: string; error?: string; }
export interface ScorePoint { timestamp: number; score: number; lr: number; at: number; od: number; vs: number; state: ProtocolState; }
