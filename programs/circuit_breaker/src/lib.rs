use anchor_lang::prelude::*;

declare_id!("9tQPx6NLzy81Lk3AQwA8EbnnCSPbrGezCmc58EkvDG8r");

pub const RISK_ORACLE_ID: Pubkey = pubkey!("u6LFtFvriSjCibNRsFBJgPi61m4LkDPLXM3HYndFMJX");
pub const THRESHOLD_OPEN: u8 = 80;
pub const THRESHOLD_RESTRICTED: u8 = 60;
pub const MAX_SCORE_AGE: i64 = 300;
pub const RATIO_OPEN_BPS: u64 = 15_000;
pub const RATIO_RESTRICTED_BPS: u64 = 20_000;

#[program]
pub mod circuit_breaker {
    use super::*;

    /// Read-only query — returns current protocol state.
    /// Called by frontend to display current state.
    pub fn query_state(ctx: Context<QueryState>) -> Result<StateResult> {
        let oracle = &ctx.accounts.oracle_state;
        let now = Clock::get()?.unix_timestamp;
        let score = effective_score(oracle.score, oracle.last_updated, now);
        let state = state_from_score(score);
        let ratio = ratio_bps(&state);
        Ok(StateResult { score, state, collateral_ratio_bps: ratio })
    }

    /// Gate check — called by rwa_vault before any state mutation.
    /// Errors if the requested operation is not permitted.
    pub fn check_and_gate(
        ctx: Context<CheckAndGate>,
        operation: u8, // 0=deposit, 1=mint, 2=withdraw, 3=repay
    ) -> Result<StateResult> {
        let oracle = &ctx.accounts.oracle_state;
        let now = Clock::get()?.unix_timestamp;
        let score = effective_score(oracle.score, oracle.last_updated, now);
        let state = state_from_score(score);

        let allowed = match state {
            ProtocolState::Open => true,
            ProtocolState::Restricted => operation == 2 || operation == 3, // only withdraw/repay
            ProtocolState::Frozen => operation == 3, // only repay
        };

        emit!(GateChecked {
            operation,
            score,
            allowed,
            timestamp: now,
        });

        require!(allowed, BreakerError::OperationBlocked);
        let ratio = ratio_bps(&state);
Ok(StateResult { score, state, collateral_ratio_bps: ratio })
    }
}

fn effective_score(score: u8, last_updated: i64, now: i64) -> u8 {
    if now.saturating_sub(last_updated) > MAX_SCORE_AGE { 0 } else { score }
}

fn state_from_score(score: u8) -> ProtocolState {
    if score >= THRESHOLD_OPEN { ProtocolState::Open }
    else if score >= THRESHOLD_RESTRICTED { ProtocolState::Restricted }
    else { ProtocolState::Frozen }
}

fn ratio_bps(state: &ProtocolState) -> u64 {
    match state {
        ProtocolState::Open => RATIO_OPEN_BPS,
        ProtocolState::Restricted => RATIO_RESTRICTED_BPS,
        ProtocolState::Frozen => RATIO_RESTRICTED_BPS,
    }
}

// ── Mirror of oracle account layout (avoids crate dependency) ────────────────
#[account]
pub struct OracleStateView {
    pub authority: Pubkey,
    pub score: u8,
    pub lr: u8,
    pub at: u8,
    pub od: u8,
    pub vs: u8,
    pub last_updated: i64,
    pub update_count: u64,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum ProtocolState { Open, Restricted, Frozen }

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct StateResult {
    pub score: u8,
    pub state: ProtocolState,
    pub collateral_ratio_bps: u64,
}

#[derive(Accounts)]
pub struct QueryState<'info> {
    #[account(
        seeds = [b"oracle_v1"],
        bump = oracle_state.bump,
        owner = RISK_ORACLE_ID @ BreakerError::InvalidOracle
    )]
    pub oracle_state: Account<'info, OracleStateView>,
}

#[derive(Accounts)]
pub struct CheckAndGate<'info> {
    #[account(
        seeds = [b"oracle_v1"],
        bump = oracle_state.bump,
        owner = RISK_ORACLE_ID @ BreakerError::InvalidOracle
    )]
    pub oracle_state: Account<'info, OracleStateView>,
}

#[event]
pub struct GateChecked {
    pub operation: u8,
    pub score: u8,
    pub allowed: bool,
    pub timestamp: i64,
}

#[error_code]
pub enum BreakerError {
    #[msg("Oracle account is not owned by risk_oracle program")] InvalidOracle,
    #[msg("Operation blocked by circuit breaker in current protocol state")] OperationBlocked,
}
