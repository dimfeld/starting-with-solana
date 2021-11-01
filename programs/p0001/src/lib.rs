use anchor_lang::prelude::*;

declare_id!("DbwyCYv83xm4TvTNtUFp8LwtKFtwaKK4P1HcDjAktoLb");

#[program]
pub mod p0001 {
    use super::*;
    pub fn initialize(ctx: Context<Initialize>, first_line: String) -> ProgramResult {
        let base_account = &mut ctx.accounts.base_account;
        base_account.user = ctx.accounts.user.key();
        base_account.lines.push(first_line);
        Ok(())
    }

    pub fn add(ctx: Context<Add>, line: String) -> ProgramResult {
        let base_account = &mut ctx.accounts.base_account;
        base_account.lines.push(line);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    // 8 bytes for discriminator, 32 bytes for pubkey, 512 bytes of string data.
    #[account(init, payer=user, space=8+32+512)]
    pub base_account: Account<'info, BaseAccount>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Add<'info> {
    #[account(mut, has_one=user)]
    pub base_account: Account<'info, BaseAccount>,
    pub user: Signer<'info>,
}

#[account]
pub struct BaseAccount {
    pub user: Pubkey,
    pub lines: Vec<String>,
}
