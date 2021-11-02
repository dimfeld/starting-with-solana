use anchor_lang::prelude::*;
use anchor_lang::AccountsClose;

declare_id!("DbwyCYv83xm4TvTNtUFp8LwtKFtwaKK4P1HcDjAktoLb");

const NAME_SIZE: usize = 60;
const LIST_CAPACITY: usize = 32;

#[program]
pub mod p0001 {
    use anchor_lang::solana_program::{program::invoke, system_instruction::transfer};

    use super::*;
    pub fn new_list(ctx: Context<NewList>, name: String) -> ProgramResult {
        // Create a new account
        let list = &mut ctx.accounts.list;
        if name.len() > 60 {
            return Err(TodoListError::NameTooLong.into());
        }

        list.list_owner = *ctx.accounts.user.to_account_info().key;
        list.name = name;
        Ok(())
    }

    pub fn add(ctx: Context<Add>, name: String, bounty: u64) -> ProgramResult {
        if name.len() > NAME_SIZE {
            return Err(TodoListError::NameTooLong.into());
        }

        let user = &ctx.accounts.user;
        let list = &mut ctx.accounts.list;
        let item = &mut ctx.accounts.item;

        list.lines.push(*item.to_account_info().key);
        item.name = name;

        // Move the bounty on to the account.

        let account_lamports = **item.to_account_info().lamports.borrow();
        if bounty < account_lamports {
            return Err(TodoListError::BountyTooSmall.into());
        }

        let transfer_amount = bounty - account_lamports;
        if transfer_amount > 0 {
            invoke(
                &transfer(
                    user.to_account_info().key,
                    item.to_account_info().key,
                    bounty,
                ),
                &[
                    user.to_account_info(),
                    item.to_account_info(),
                    ctx.accounts.system_program.to_account_info(),
                ],
            )?;
        }

        Ok(())
    }

    pub fn cancel(ctx: Context<Cancel>) -> ProgramResult {
        let item = &mut ctx.accounts.item;
        let list = &mut ctx.accounts.list;

        // Return the tokens to the item creator
        item.close(item.to_account_info())?;

        let item_key = ctx.accounts.item.to_account_info().key;
        list.lines.retain(|key| key != item_key);

        Ok(())
    }

    pub fn finish(ctx: Context<Finish>) -> ProgramResult {
        let item = &mut ctx.accounts.item;
        let list = &mut ctx.accounts.list;
        let user = ctx.accounts.user.to_account_info().key;

        if &item.creator == user {
            item.creator_finished = true;
        }

        if &list.list_owner == user {
            item.list_owner_finished = true;
        }

        if item.creator_finished && item.list_owner_finished {
            item.close(ctx.accounts.list_owner.to_account_info())?;

            let item_key = item.to_account_info().key;
            list.lines.retain(|key| key != item_key);
        }

        Ok(())
    }
}

#[error]
pub enum TodoListError {
    #[msg("Name must be 60 bytes or less")]
    NameTooLong,
    #[msg("Bounty must be enough to pay rent")]
    BountyTooSmall,
}

#[derive(Accounts)]
pub struct NewList<'info> {
    // 8 bytes for discriminator, Up to 60 bytes of string data, up to 32 item pubkeys
    #[account(init, payer=user, space=8 + 4 + NAME_SIZE + 4 + 32 * LIST_CAPACITY)]
    pub list: Account<'info, TodoList>,
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Add<'info> {
    #[account(mut)]
    pub list: Account<'info, TodoList>,
    #[account(init, payer=user, space=8 + 1 + 1 + 4 + NAME_SIZE)]
    pub item: Account<'info, ListItem>,
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Cancel<'info> {
    #[account(mut)]
    pub list: Account<'info, TodoList>,
    #[account(has_one=creator)]
    pub item: Account<'info, ListItem>,
    pub creator: Signer<'info>,
}

#[derive(Accounts)]
pub struct Finish<'info> {
    #[account(mut, has_one=list_owner)]
    pub list: Account<'info, TodoList>,
    #[account(mut)]
    pub item: Account<'info, ListItem>,
    pub user: Signer<'info>,
    pub list_owner: UncheckedAccount<'info>,
}

#[account]
pub struct TodoList {
    pub list_owner: Pubkey,
    pub name: String,
    pub lines: Vec<Pubkey>,
}

#[account]
pub struct ListItem {
    pub creator: Pubkey,
    pub creator_finished: bool,
    pub list_owner_finished: bool,
    pub name: String,
}
