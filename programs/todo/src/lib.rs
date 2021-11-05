use anchor_lang::prelude::*;
use anchor_lang::AccountsClose;

declare_id!("DbwyCYv83xm4TvTNtUFp8LwtKFtwaKK4P1HcDjAktoLb");

#[program]
pub mod todo {
    use anchor_lang::solana_program::{program::invoke, system_instruction::transfer};

    use super::*;
    pub fn new_list(ctx: Context<NewList>, name: String, capacity: u16) -> ProgramResult {
        // Create a new account
        let list = &mut ctx.accounts.list;
        list.list_owner = *ctx.accounts.user.to_account_info().key;
        list.name = name;
        list.capacity = capacity;
        Ok(())
    }

    pub fn add(ctx: Context<Add>, name: String, bounty: u64) -> ProgramResult {
        let user = &ctx.accounts.user;
        let list = &mut ctx.accounts.list;
        let item = &mut ctx.accounts.item;

        if list.lines.len() >= list.capacity as usize {
            return Err(TodoListError::ListFull.into());
        }

        list.lines.push(*item.to_account_info().key);
        item.name = name;
        item.creator = *user.to_account_info().key;

        // Move the bounty to the account. We account for the rent amount that the account init
        // already transferred into the account.
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
                    transfer_amount,
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
        let list = &mut ctx.accounts.list;
        let item = &mut ctx.accounts.item;
        let item_creator = &ctx.accounts.item_creator;

        let user = ctx.accounts.user.to_account_info().key;

        if &list.list_owner != user && &item.creator != user {
            return Err(TodoListError::CancelPermissions.into());
        }

        if !list.lines.contains(item.to_account_info().key) {
            return Err(TodoListError::ItemNotFound.into());
        }

        // Return the tokens to the item creator
        item.close(item_creator.to_account_info())?;

        let item_key = ctx.accounts.item.to_account_info().key;
        list.lines.retain(|key| key != item_key);

        Ok(())
    }

    pub fn finish(ctx: Context<Finish>) -> ProgramResult {
        let item = &mut ctx.accounts.item;
        let list = &mut ctx.accounts.list;
        let user = ctx.accounts.user.to_account_info().key;

        if !list.lines.contains(item.to_account_info().key) {
            return Err(TodoListError::ItemNotFound.into());
        }

        if &item.creator == user {
            item.creator_finished = true;
        } else if &list.list_owner == user {
            item.list_owner_finished = true;
        } else {
            return Err(TodoListError::FinishPermissions.into());
        }

        if item.creator_finished && item.list_owner_finished {
            let item_key = item.to_account_info().key;
            list.lines.retain(|key| key != item_key);
            item.close(ctx.accounts.list_owner.to_account_info())?;
        }

        Ok(())
    }
}

#[error]
pub enum TodoListError {
    #[msg("This list is full")]
    ListFull,
    #[msg("Bounty must be enough to mark account rent-exempt")]
    BountyTooSmall,
    #[msg("Only the list owner or item creator may cancel an item")]
    CancelPermissions,
    #[msg("Only the list owner or item creator may finish an item")]
    FinishPermissions,
    #[msg("Item does not belong to this todo list")]
    ItemNotFound,
    #[msg("Specified list owner does not match the pubkey in the list")]
    WrongListOwner,
    #[msg("Specified item creator does not match the pubkey in the item")]
    WrongItemCreator,
}

#[derive(Accounts)]
#[instruction(name: String, capacity: u16)]
pub struct NewList<'info> {
    // 8 bytes discriminator, 4 + name.len for name, 32 * capacity for pubkeys
    #[account(init, payer=user, space=TodoList::space(&name, capacity))]
    pub list: Account<'info, TodoList>,
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(name: String, bounty: u64)]
pub struct Add<'info> {
    #[account(mut)]
    pub list: Account<'info, TodoList>,
    // 8 byte discriminator,
    #[account(init, payer=user, space=ListItem::space(&name))]
    pub item: Account<'info, ListItem>,
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Cancel<'info> {
    #[account(mut)]
    pub list: Account<'info, TodoList>,
    #[account(mut)]
    pub item: Account<'info, ListItem>,
    #[account(mut, address=item.creator @ TodoListError::WrongItemCreator)]
    pub item_creator: UncheckedAccount<'info>,
    pub user: Signer<'info>,
}

#[derive(Accounts)]
pub struct Finish<'info> {
    #[account(mut, has_one=list_owner @ TodoListError::WrongListOwner)]
    pub list: Account<'info, TodoList>,
    #[account(mut)]
    pub item: Account<'info, ListItem>,
    #[account(mut)]
    pub list_owner: UncheckedAccount<'info>,
    pub user: Signer<'info>,
}

#[account]
pub struct TodoList {
    pub list_owner: Pubkey,
    pub capacity: u16,
    pub name: String,
    pub lines: Vec<Pubkey>,
}

impl TodoList {
    fn space(name: &str, capacity: u16) -> usize {
        // discriminator + owner pubkey + capacity
        8 + 32 + 2 +
            // name string
            4 + name.len() +
            // vec of itemspubkeys
            4 + (capacity as usize) * std::mem::size_of::<Pubkey>()
    }
}

#[account]
pub struct ListItem {
    pub creator: Pubkey,
    pub creator_finished: bool,
    pub list_owner_finished: bool,
    pub name: String,
}

impl ListItem {
    fn space(name: &str) -> usize {
        // discriminator + creator pubkey + 2 bools + name string
        8 + 32 + 1 + 1 + 4 + name.len()
    }
}
