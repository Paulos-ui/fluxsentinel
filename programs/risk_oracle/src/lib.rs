use anchor_lang::prelude::*;

declare_id!("u6LFtFvriSjCibNRsFBJgPi61m4LkDPLXM3HYndFMJX");

pub const MAX_SCORE_AGE_SECONDS: i64 = 300;
pub const THRESHOLD_OPEN: u8 = 80;
pub const THRESHOLD_RESTRICTED: u8 = 60;

#[program]
pub mod risk_oracle {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>, authority: Pubkey) -> Result<()> {
        let state = &mut ctx.accounts.oracle_state;
        state.authority = authority;
        state.score = 100;
        state.lr = 0;
        state.at = 0;
        state.od = 0;
        state.vs = 0;
        state.last_updated = Clock::get()?.unix_timestamp;
        state.update_count = 0;
        state.bump = ctx.bumps.oracle_state;

        emit!(OracleInitialized {
            authority,
            timestamp: state.last_updated,
        });
        Ok(())
    }

    pub fn update_score(
        ctx: Context<UpdateScore>,
        score: u8,
        lr: u8,
        at: u8,
        od: u8,
        vs: u8,
    ) -> Result<()> {
        require!(score <= 100, OracleError::ScoreOutOfRange);
        require!(lr <= 100 && at <= 100 && od <= 100 && vs <= 100, OracleError::ComponentOutOfRange);

        let clock = Clock::get()?;
        let state = &mut ctx.accounts.oracle_state;
        require!(clock.unix_timestamp >= state.last_updated, OracleError::NonMonotonicTimestamp);

        let prev = state.score;
        state.score = score;
        state.lr = lr;
        state.at = at;
        state.od = od;
        state.vs = vs;
        state.last_updated = clock.unix_timestamp;
        state.update_count = state.update_count.checked_add(1).ok_or(OracleError::Overflow)?;

        emit!(ScoreUpdated {
            score,
            prev_score: prev,
            lr, at, od, vs,
            timestamp: clock.unix_timestamp,
            update_count: state.update_count,
        });

        // Emit threshold events for UI state changes
        if prev >= THRESHOLD_OPEN && score < THRESHOLD_OPEN {
            emit!(ThresholdCrossed { threshold: THRESHOLD_OPEN, score, direction: 0, timestamp: clock.unix_timestamp });
        } else if prev < THRESHOLD_OPEN && score >= THRESHOLD_OPEN {
            emit!(ThresholdCrossed { threshold: THRESHOLD_OPEN, score, direction: 1, timestamp: clock.unix_timestamp });
        }
        if prev >= THRESHOLD_RESTRICTED && score < THRESHOLD_RESTRICTED {
            emit!(ThresholdCrossed { threshold: THRESHOLD_RESTRICTED, score, direction: 0, timestamp: clock.unix_timestamp });
        }

        Ok(())
    }

    pub fn rotate_authority(ctx: Context<RotateAuthority>, new_authority: Pubkey) -> Result<()> {
        let state = &mut ctx.accounts.oracle_state;
        let old = state.authority;
        state.authority = new_authority;
        emit!(AuthorityRotated { old_authority: old, new_authority, timestamp: Clock::get()?.unix_timestamp });
        Ok(())
    }
}

#[account]
pub struct OracleState {
    pub authority: Pubkey,    // 32
    pub score: u8,            // 1  — composite S(t)
    pub lr: u8,               // 1  — liquidity risk component
    pub at: u8,               // 1  — anomaly score
    pub od: u8,               // 1  — oracle deviation
    pub vs: u8,               // 1  — volatility stress
    pub last_updated: i64,    // 8
    pub update_count: u64,    // 8
    pub bump: u8,             // 1
}

impl OracleState {
    pub const LEN: usize = 8 + 32 + 1 + 1 + 1 + 1 + 1 + 8 + 8 + 1; // 62 bytes

    pub fn effective_score(&self, now: i64) -> u8 {
        if now.saturating_sub(self.last_updated) > MAX_SCORE_AGE_SECONDS {
            0 // stale → treat as maximum risk
        } else {
            self.score
        }
    }

    pub fn protocol_state(&self, now: i64) -> ProtocolState {
        let s = self.effective_score(now);
        if s >= THRESHOLD_OPEN { ProtocolState::Open }
        else if s >= THRESHOLD_RESTRICTED { ProtocolState::Restricted }
        else { ProtocolState::Frozen }
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, Debug)]
pub enum ProtocolState { Open, Restricted, Frozen }

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = payer,
        space = OracleState::LEN,
        seeds = [b"oracle_v1"],
        bump
    )]
    pub oracle_state: Account<'info, OracleState>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateScore<'info> {
    #[account(
        mut,
        seeds = [b"oracle_v1"],
        bump = oracle_state.bump,
        has_one = authority @ OracleError::Unauthorized
    )]
    pub oracle_state: Account<'info, OracleState>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct RotateAuthority<'info> {
    #[account(
        mut,
        seeds = [b"oracle_v1"],
        bump = oracle_state.bump,
        has_one = authority @ OracleError::Unauthorized
    )]
    pub oracle_state: Account<'info, OracleState>,
    pub authority: Signer<'info>,
}

#[event] pub struct OracleInitialized { pub authority: Pubkey, pub timestamp: i64 }
#[event] pub struct ScoreUpdated { pub score: u8, pub prev_score: u8, pub lr: u8, pub at: u8, pub od: u8, pub vs: u8, pub timestamp: i64, pub update_count: u64 }
#[event] pub struct ThresholdCrossed { pub threshold: u8, pub score: u8, pub direction: u8, pub timestamp: i64 }
#[event] pub struct AuthorityRotated { pub old_authority: Pubkey, pub new_authority: Pubkey, pub timestamp: i64 }

#[error_code]
pub enum OracleError {
    #[msg("Score must be 0-100")] ScoreOutOfRange,
    #[msg("Component must be 0-100")] ComponentOutOfRange,
    #[msg("Not the oracle authority")] Unauthorized,
    #[msg("Timestamp must be monotonically increasing")] NonMonotonicTimestamp,
    #[msg("Arithmetic overflow")] Overflow,
}
