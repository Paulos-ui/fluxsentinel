use anchor_spl::token::{self, Mint, Token, TokenAccount, MintTo, Burn, Transfer};
use anchor_spl::associated_token::AssociatedToken;

declare_id!("27LUs2phpTGbAQ5vkb1K44Aa45HW2JoViFat5st8keFE");

pub const CIRCUIT_BREAKER_ID: Pubkey = pubkey!("9tQPx6NLzy81Lk3AQwA8EbnnCSPbrGezCmc58EkvDG8r");
pub const RISK_ORACLE_ID: Pubkey     = pubkey!("u6LFtFvriSjCibNRsFBJgPi61m4LkDPLXM3HYndFMJX");
pub const FLUX_DECIMALS: u8          = 6;
pub const MAX_SCORE_AGE: i64         = 300;
pub const RATIO_OPEN_BPS: u64        = 15_000;
pub const RATIO_RESTRICTED_BPS: u64  = 20_000;
pub const BPS_DENOM: u64             = 10_000;

#[program]
pub mod rwa_vault {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let cfg = &mut ctx.accounts.config;
        cfg.authority = ctx.accounts.authority.key();
        cfg.flux_mint = ctx.accounts.flux_mint.key();
        cfg.oracle    = ctx.accounts.oracle_state.key();
        cfg.total_collateral_usd = 0;
        cfg.total_flux_minted    = 0;
        cfg.vault_count          = 0;
        cfg.bump                 = ctx.bumps.config;
        cfg.flux_mint_bump       = ctx.bumps.flux_mint;

        emit!(Initialized {
            authority: cfg.authority,
            flux_mint: cfg.flux_mint,
            timestamp: Clock::get()?.unix_timestamp,
        });
        Ok(())
    }

    pub fn open_vault(ctx: Context<OpenVault>, collateral_usd_price: u64) -> Result<()> {
        let vault_key = ctx.accounts.vault.key();
        let vault = &mut ctx.accounts.vault;
        vault.owner              = ctx.accounts.owner.key();
        vault.collateral_mint    = ctx.accounts.collateral_mint.key();
        vault.collateral_amount  = 0;
        vault.collateral_usd     = 0;
        vault.flux_debt          = 0;
        vault.token_usd_price    = collateral_usd_price;
        vault.opened_at          = Clock::get()?.unix_timestamp;
        vault.bump               = ctx.bumps.vault;

        let owner = vault.owner;
        let collateral_mint = vault.collateral_mint;
        let opened_at = vault.opened_at;

        let cfg = &mut ctx.accounts.config;
        cfg.vault_count = cfg.vault_count.checked_add(1).ok_or(VaultError::Overflow)?;

        emit!(VaultOpened {
            vault: vault_key,
            owner,
            collateral_mint,
            timestamp: opened_at,
        });
        Ok(())
    }

    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        require!(amount > 0, VaultError::ZeroAmount);
        gate_check(&ctx.accounts.oracle_state, 0)?;

        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from:      ctx.accounts.owner_ata.to_account_info(),
                    to:        ctx.accounts.escrow.to_account_info(),
                    authority: ctx.accounts.owner.to_account_info(),
                },
            ),
            amount,
        )?;

        let vault_key = ctx.accounts.vault.key();
        let vault = &mut ctx.accounts.vault;
        let usd_value = amount
            .checked_mul(vault.token_usd_price).ok_or(VaultError::Overflow)?
            .checked_div(1_000_000).ok_or(VaultError::Overflow)?;

        vault.collateral_amount = vault.collateral_amount.checked_add(amount).ok_or(VaultError::Overflow)?;
        vault.collateral_usd    = vault.collateral_usd.checked_add(usd_value).ok_or(VaultError::Overflow)?;

        let cfg = &mut ctx.accounts.config;
        cfg.total_collateral_usd = cfg.total_collateral_usd.checked_add(usd_value).ok_or(VaultError::Overflow)?;

        emit!(Deposited {
            vault: vault_key,
            amount,
            usd_value,
            timestamp: Clock::get()?.unix_timestamp,
        });
        Ok(())
    }

    pub fn mint_flux(ctx: Context<MintFlux>, amount_usd_cents: u64) -> Result<()> {
        require!(amount_usd_cents > 0, VaultError::ZeroAmount);

        let ratio_bps = gate_check_with_ratio(&ctx.accounts.oracle_state, 1)?;

        let vault = &ctx.accounts.vault;

        let max_mintable_usd = vault.collateral_usd
            .checked_mul(BPS_DENOM).ok_or(VaultError::Overflow)?
            .checked_div(ratio_bps).ok_or(VaultError::Overflow)?;

        let already_minted_usd = vault.flux_debt
            .checked_div(10_000).ok_or(VaultError::Overflow)?;

        let remaining = max_mintable_usd.saturating_sub(already_minted_usd);
        require!(amount_usd_cents <= remaining, VaultError::CollateralRatioExceeded);

        let token_amount = amount_usd_cents.checked_mul(10_000).ok_or(VaultError::Overflow)?;

        let cfg_bump = ctx.accounts.config.bump;
        let seeds: &[&[&[u8]]] = &[&[b"config", &[cfg_bump]]];
        token::mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                MintTo {
                    mint:      ctx.accounts.flux_mint.to_account_info(),
                    to:        ctx.accounts.owner_flux_ata.to_account_info(),
                    authority: ctx.accounts.config.to_account_info(),
                },
                seeds,
            ),
            token_amount,
        )?;

        let vault_key = ctx.accounts.vault.key();
        let vault = &mut ctx.accounts.vault;
        vault.flux_debt = vault.flux_debt.checked_add(token_amount).ok_or(VaultError::Overflow)?;

        let cfg = &mut ctx.accounts.config;
        cfg.total_flux_minted = cfg.total_flux_minted.checked_add(token_amount).ok_or(VaultError::Overflow)?;

        emit!(FluxMinted {
            vault: vault_key,
            amount_usd_cents,
            token_amount,
            ratio_bps,
            timestamp: Clock::get()?.unix_timestamp,
        });
        Ok(())
    }

    pub fn repay(ctx: Context<Repay>, token_amount: u64) -> Result<()> {
        require!(token_amount > 0, VaultError::ZeroAmount);

        {
            let vault = &ctx.accounts.vault;
            require!(token_amount <= vault.flux_debt, VaultError::RepayExceedsDebt);
        }

        token::burn(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Burn {
                    mint:      ctx.accounts.flux_mint.to_account_info(),
                    from:      ctx.accounts.owner_flux_ata.to_account_info(),
                    authority: ctx.accounts.owner.to_account_info(),
                },
            ),
            token_amount,
        )?;

        let vault_key = ctx.accounts.vault.key();
        let vault = &mut ctx.accounts.vault;
        vault.flux_debt = vault.flux_debt.checked_sub(token_amount).ok_or(VaultError::Overflow)?;
        let remaining_debt = vault.flux_debt;

        let cfg = &mut ctx.accounts.config;
        cfg.total_flux_minted = cfg.total_flux_minted.saturating_sub(token_amount);

        emit!(Repaid {
            vault: vault_key,
            token_amount,
            remaining_debt,
            timestamp: Clock::get()?.unix_timestamp,
        });
        Ok(())
    }

    pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
        require!(amount > 0, VaultError::ZeroAmount);
        let ratio_bps = gate_check_with_ratio(&ctx.accounts.oracle_state, 2)?;

        let (vault_owner, vault_mint, vault_bump, withdraw_usd) = {
            let vault = &ctx.accounts.vault;
            require!(amount <= vault.collateral_amount, VaultError::InsufficientCollateral);

            let withdraw_usd = amount
                .checked_mul(vault.token_usd_price).ok_or(VaultError::Overflow)?
                .checked_div(1_000_000).ok_or(VaultError::Overflow)?;

            let remaining_usd = vault.collateral_usd.checked_sub(withdraw_usd)
                .ok_or(VaultError::InsufficientCollateral)?;

            if vault.flux_debt > 0 {
                let debt_usd = vault.flux_debt.checked_div(10_000).ok_or(VaultError::Overflow)?;
                let required = debt_usd.checked_mul(ratio_bps).ok_or(VaultError::Overflow)?
                    .checked_div(BPS_DENOM).ok_or(VaultError::Overflow)?;
                require!(remaining_usd >= required, VaultError::WouldUndercollateralize);
            }

            (vault.owner, vault.collateral_mint, vault.bump, withdraw_usd)
        };

        let signer: &[&[&[u8]]] = &[&[b"vault", vault_owner.as_ref(), vault_mint.as_ref(), &[vault_bump]]];

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from:      ctx.accounts.escrow.to_account_info(),
                    to:        ctx.accounts.owner_ata.to_account_info(),
                    authority: ctx.accounts.vault.to_account_info(),
                },
                signer,
            ),
            amount,
        )?;

        let vault_key = ctx.accounts.vault.key();
        let vault = &mut ctx.accounts.vault;
        vault.collateral_amount = vault.collateral_amount.checked_sub(amount).ok_or(VaultError::Overflow)?;
        vault.collateral_usd    = vault.collateral_usd.saturating_sub(withdraw_usd);

        let cfg = &mut ctx.accounts.config;
        cfg.total_collateral_usd = cfg.total_collateral_usd.saturating_sub(withdraw_usd);

        emit!(Withdrawn {
            vault: vault_key,
            amount,
            withdraw_usd,
            timestamp: Clock::get()?.unix_timestamp,
        });
        Ok(())
    }
}

// ── Gate helpers ─────────────────────────────────────────────────────────────
// We accept UncheckedAccount and manually validate ownership + parse fields.
// This avoids Anchor's automatic owner check (which would compare against
// rwa_vault's program ID instead of risk_oracle's).

fn get_score(oracle: &UncheckedAccount) -> Result<(u8, u64)> {
    // Manual ownership validation
    require_keys_eq!(*oracle.owner, RISK_ORACLE_ID, VaultError::InvalidOracle);

    // Parse OracleState fields manually:
    //   discriminator     [0..8]    8 bytes
    //   authority         [8..40]   32 bytes
    //   score             [40]      1 byte
    //   lr                [41]      1 byte
    //   at                [42]      1 byte
    //   od                [43]      1 byte
    //   vs                [44]      1 byte
    //   last_updated      [45..53]  8 bytes (i64 LE)
    let data = oracle.try_borrow_data()?;
    require!(data.len() >= 53, VaultError::InvalidOracle);

    let score = data[40];
    let last_updated = i64::from_le_bytes(
        data[45..53].try_into().map_err(|_| VaultError::InvalidOracle)?
    );

    let now = Clock::get().map(|c| c.unix_timestamp).unwrap_or(0);
    let effective_score = if now.saturating_sub(last_updated) > MAX_SCORE_AGE { 0 } else { score };
    let ratio = if effective_score >= 80 { RATIO_OPEN_BPS } else { RATIO_RESTRICTED_BPS };
    Ok((effective_score, ratio))
}

fn gate_check(oracle: &UncheckedAccount, op: u8) -> Result<()> {
    let (score, _) = get_score(oracle)?;
    let allowed = if score >= 80 { true }
        else if score >= 60 { op == 2 || op == 3 }
        else { op == 3 };
    require!(allowed, VaultError::GateBlocked);
    Ok(())
}

fn gate_check_with_ratio(oracle: &UncheckedAccount, op: u8) -> Result<u64> {
    let (score, ratio) = get_score(oracle)?;
    let allowed = if score >= 80 { true }
        else if score >= 60 { op == 2 || op == 3 }
        else { op == 3 };
    require!(allowed, VaultError::GateBlocked);
    Ok(ratio)
}

// ── Account data structs ─────────────────────────────────────────────────────

#[account]
pub struct ProgramConfig {
    pub authority:           Pubkey,
    pub flux_mint:           Pubkey,
    pub oracle:              Pubkey,
    pub total_collateral_usd: u64,
    pub total_flux_minted:   u64,
    pub vault_count:         u64,
    pub bump:                u8,
    pub flux_mint_bump:      u8,
}
impl ProgramConfig { pub const LEN: usize = 8 + 32 + 32 + 32 + 8 + 8 + 8 + 1 + 1; }

#[account]
pub struct VaultAccount {
    pub owner:             Pubkey,
    pub collateral_mint:   Pubkey,
    pub collateral_amount: u64,
    pub collateral_usd:    u64,
    pub flux_debt:         u64,
    pub token_usd_price:   u64,
    pub opened_at:         i64,
    pub bump:              u8,
}
impl VaultAccount { pub const LEN: usize = 8 + 32 + 32 + 8 + 8 + 8 + 8 + 8 + 1; }

// OracleView definition kept for documentation purposes only — we now parse
// the oracle account manually inside get_score() to avoid Anchor's automatic
// owner check.
#[account]
pub struct OracleView {
    pub authority:    Pubkey,
    pub score:        u8,
    pub lr:           u8,
    pub at:           u8,
    pub od:           u8,
    pub vs:           u8,
    pub last_updated: i64,
    pub update_count: u64,
    pub bump:         u8,
}

// ── Instruction account contexts ─────────────────────────────────────────────

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init, payer = authority,
        space = ProgramConfig::LEN,
        seeds = [b"config"], bump
    )]
    pub config: Account<'info, ProgramConfig>,

    #[account(
        init, payer = authority,
        mint::decimals = FLUX_DECIMALS,
        mint::authority = config,
        seeds = [b"flux_mint"], bump
    )]
    pub flux_mint: Account<'info, Mint>,

    /// CHECK: oracle account validated manually in downstream calls
    pub oracle_state: UncheckedAccount<'info>,

    #[account(mut)]
    pub authority: Signer<'info>,
    pub token_program:  Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent:           Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct OpenVault<'info> {
    #[account(
        init, payer = owner,
        space = VaultAccount::LEN,
        seeds = [b"vault", owner.key().as_ref(), collateral_mint.key().as_ref()],
        bump
    )]
    pub vault: Account<'info, VaultAccount>,

    #[account(mut, seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, ProgramConfig>,

    pub collateral_mint: Account<'info, Mint>,

    #[account(mut)]
    pub owner: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(
        mut,
        seeds = [b"vault", owner.key().as_ref(), vault.collateral_mint.as_ref()],
        bump = vault.bump,
        has_one = owner @ VaultError::NotOwner
    )]
    pub vault: Account<'info, VaultAccount>,

    #[account(mut, seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, ProgramConfig>,

    /// CHECK: validated manually inside get_score() — must be owned by RISK_ORACLE_ID
    pub oracle_state: UncheckedAccount<'info>,

    #[account(mut)]
    pub owner_ata: Account<'info, TokenAccount>,

    #[account(
        init_if_needed, payer = owner,
        associated_token::mint = collateral_mint,
        associated_token::authority = vault
    )]
    pub escrow: Account<'info, TokenAccount>,

    pub collateral_mint:         Account<'info, Mint>,
    #[account(mut)]
    pub owner:                   Signer<'info>,
    pub token_program:           Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program:          Program<'info, System>,
    pub rent:                    Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct MintFlux<'info> {
    #[account(
        mut,
        seeds = [b"vault", owner.key().as_ref(), vault.collateral_mint.as_ref()],
        bump = vault.bump,
        has_one = owner @ VaultError::NotOwner
    )]
    pub vault: Account<'info, VaultAccount>,

    #[account(mut, seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, ProgramConfig>,

    #[account(mut, seeds = [b"flux_mint"], bump = config.flux_mint_bump)]
    pub flux_mint: Account<'info, Mint>,

    /// CHECK: validated manually inside get_score() — must be owned by RISK_ORACLE_ID
    pub oracle_state: UncheckedAccount<'info>,

    #[account(
        init_if_needed, payer = owner,
        associated_token::mint = flux_mint,
        associated_token::authority = owner
    )]
    pub owner_flux_ata: Account<'info, TokenAccount>,

    #[account(mut)]
    pub owner:                   Signer<'info>,
    pub token_program:           Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program:          Program<'info, System>,
    pub rent:                    Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct Repay<'info> {
    #[account(
        mut,
        seeds = [b"vault", owner.key().as_ref(), vault.collateral_mint.as_ref()],
        bump = vault.bump,
        has_one = owner @ VaultError::NotOwner
    )]
    pub vault: Account<'info, VaultAccount>,

    #[account(mut, seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, ProgramConfig>,

    #[account(mut, seeds = [b"flux_mint"], bump = config.flux_mint_bump)]
    pub flux_mint: Account<'info, Mint>,

    #[account(mut)]
    pub owner_flux_ata: Account<'info, TokenAccount>,

    pub owner:          Signer<'info>,
    pub token_program:  Program<'info, Token>,
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(
        mut,
        seeds = [b"vault", owner.key().as_ref(), vault.collateral_mint.as_ref()],
        bump = vault.bump,
        has_one = owner @ VaultError::NotOwner
    )]
    pub vault: Account<'info, VaultAccount>,

    #[account(mut, seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, ProgramConfig>,

    /// CHECK: validated manually inside get_score() — must be owned by RISK_ORACLE_ID
    pub oracle_state: UncheckedAccount<'info>,

    #[account(mut)]
    pub escrow: Account<'info, TokenAccount>,

    #[account(mut)]
    pub owner_ata: Account<'info, TokenAccount>,

    pub collateral_mint: Account<'info, Mint>,
    pub owner:           Signer<'info>,
    pub token_program:   Program<'info, Token>,
}

// ── Events ────────────────────────────────────────────────────────────────────
#[event] pub struct Initialized      { pub authority: Pubkey, pub flux_mint: Pubkey, pub timestamp: i64 }
#[event] pub struct VaultOpened      { pub vault: Pubkey, pub owner: Pubkey, pub collateral_mint: Pubkey, pub timestamp: i64 }
#[event] pub struct Deposited        { pub vault: Pubkey, pub amount: u64, pub usd_value: u64, pub timestamp: i64 }
#[event] pub struct FluxMinted       { pub vault: Pubkey, pub amount_usd_cents: u64, pub token_amount: u64, pub ratio_bps: u64, pub timestamp: i64 }
#[event] pub struct Repaid           { pub vault: Pubkey, pub token_amount: u64, pub remaining_debt: u64, pub timestamp: i64 }
#[event] pub struct Withdrawn        { pub vault: Pubkey, pub amount: u64, pub withdraw_usd: u64, pub timestamp: i64 }

// ── Errors ────────────────────────────────────────────────────────────────────
#[error_code]
pub enum VaultError {
    #[msg("Amount must be > 0")] ZeroAmount,
    #[msg("Not vault owner")] NotOwner,
    #[msg("Oracle account invalid")] InvalidOracle,
    #[msg("Circuit breaker blocked operation")] GateBlocked,
    #[msg("Would exceed collateral ratio")] CollateralRatioExceeded,
    #[msg("Would undercollateralize vault")] WouldUndercollateralize,
    #[msg("Insufficient collateral")] InsufficientCollateral,
    #[msg("Repay amount exceeds debt")] RepayExceedsDebt,
    #[msg("Arithmetic overflow")] Overflow,
}
