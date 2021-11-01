use anchor_lang::prelude::*;

declare_id!("DbwyCYv83xm4TvTNtUFp8LwtKFtwaKK4P1HcDjAktoLb");

#[program]
pub mod p0001 {
    use super::*;
    pub fn initialize(ctx: Context<Initialize>, first_line: String) -> ProgramResult {
        let base_account = &mut ctx.accounts.base_account;
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
    #[account(init, payer=user, space=8+128)]
    pub base_account: Account<'info, BaseAccount>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Add<'info> {
    #[account(mut)]
    pub base_account: Account<'info, BaseAccount>,
}

#[account]
pub struct BaseAccount {
    pub lines: Vec<String>,
}
