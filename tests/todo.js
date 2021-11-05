const anchor = require('@project-serum/anchor');
const BN = require('bn.js');
const expect = require('chai').expect;
const { SystemProgram, LAMPORTS_PER_SOL } = anchor.web3;

describe('todo', () => {
  const provider = anchor.Provider.env();
  anchor.setProvider(provider);
  const mainProgram = anchor.workspace.Todo;

  function expectBalance(actual, expected, message, slack=20000) {
    expect(actual, message).within(expected - slack, expected + slack)
  }

  async function createUser(airdropBalance) {
    airdropBalance = airdropBalance ?? 5000 * LAMPORTS_PER_SOL;
    let user = anchor.web3.Keypair.generate();
    let sig = await provider.connection.requestAirdrop(user.publicKey, airdropBalance);
    await provider.connection.confirmTransaction(sig);

    let wallet = new anchor.Wallet(user);
    let userProvider = new anchor.Provider(provider.connection, wallet, provider.opts);

    return {
      key: user,
      wallet,
      provider: userProvider,
    };
  }

  function createUsers(numUsers) {
    let promises = [];
    for(let i = 0; i < numUsers; i++) {
      promises.push(createUser());
    }

    return Promise.all(promises);
  }

  async function getAccountBalance(pubkey) {
    let account = await provider.connection.getAccountInfo(pubkey);
    return account?.lamports ?? 0;
  }

  function programForUser(user) {
    return new anchor.Program(mainProgram.idl, mainProgram.programId, user.provider);
  }

  async function createList(owner, name, capacity=16) {
    const listAccount = anchor.web3.Keypair.generate();
    let program = programForUser(owner);
    await program.rpc.newList(name, capacity, {
      accounts: {
        list: listAccount.publicKey,
        user: owner.key.publicKey,
        systemProgram: SystemProgram.programId,
      },
      signers: [listAccount]
    });

    let list = await program.account.todoList.fetch(listAccount.publicKey);
    return { publicKey: listAccount.publicKey, data: list };
  }

  async function addItem({list, user, name, bounty}) {
    const itemAccount = anchor.web3.Keypair.generate();
    let program = programForUser(user);
    await program.rpc.add(name, new BN(bounty), {
      accounts: {
        list: list.publicKey,
        item: itemAccount.publicKey,
        user: user.key.publicKey,
        systemProgram: SystemProgram.programId,
      },
      signers: [
        user.key,
        itemAccount,
      ]
    });

    let listData = await program.account.todoList.fetch(list.publicKey);
    let itemData = await program.account.listItem.fetch(itemAccount.publicKey);

    return {
      list: {
        publicKey: list.publicKey,
        data: listData,
      },
      item: {
        publicKey: itemAccount.publicKey,
        data: itemData,
      }
    };
  }

  async function cancelItem({ list, item, itemCreator, user }) {
    let program = programForUser(user);
    await program.rpc.cancel({
      accounts: {
        list: list.publicKey,
        item: item.publicKey,
        itemCreator: itemCreator.key.publicKey,
        user: user.key.publicKey,
      }
    });

    let listData = await program.account.todoList.fetch(list.publicKey);
    return {
      list: {
        publicKey: list.publicKey,
        data: listData,
      }
    }
  }

  async function finishItem({ list, listOwner, item, user, expectAccountClosed }) {
    let program = programForUser(user);
    await program.rpc.finish({
      accounts: {
        list: list.publicKey,
        item: item.publicKey,
        user: user.key.publicKey,
        listOwner: listOwner.key.publicKey,
      }
    });

    let [listData, itemData] = await Promise.all([
      program.account.todoList.fetch(list.publicKey),
      expectAccountClosed ? null : await program.account.listItem.fetch(item.publicKey),
    ]);

    return {
      list: {
        publicKey: list.publicKey,
        data: listData,
      },
      item: {
        publicKey: item.publicKey,
        data: itemData,
      }
    };
  }

  describe('new list', () => {
    it('creates a list', async () => {
      const owner = await createUser();
      let list = await createList(owner, 'A list');

      expect(list.data.listOwner.toString(), 'List owner is set').equals(owner.key.publicKey.toString());
      expect(list.data.name, 'List name is set').equals('A list');
      expect(list.data.lines.length, 'List has no items').equals(0);
    });
  });

  describe('add', () => {
    it('Anyone can add an item to a list', async () => {
      const [owner, adder] = await createUsers(2);

      const adderStartingBalance = await getAccountBalance(adder.key.publicKey);
      const list = await createList(owner, 'list');
      const result = await addItem({ list, user: adder, name: 'Do something', bounty: 1 * LAMPORTS_PER_SOL});

      expect(result.list.data.lines, 'Item is added').deep.equals([result.item.publicKey]);
      expect(result.item.data.creator.toString(), 'Item marked with creator').equals(adder.key.publicKey.toString());
      expect(result.item.data.creatorFinished, 'creator_finished is false').equals(false);
      expect(result.item.data.listOwnerFinished, 'list_owner_finished is false').equals(false);
      expect(result.item.data.name, 'Name is set').equals('Do something');
      expect(await getAccountBalance(result.item.publicKey), 'List account balance').equals(1 * LAMPORTS_PER_SOL);

      let adderNewBalance = await getAccountBalance(adder.key.publicKey);
      expectBalance(adderStartingBalance - adderNewBalance,  LAMPORTS_PER_SOL, 'Number of lamports removed from adder is equal to bounty');

      const again = await addItem({ list, user: adder, name: 'Another item', bounty: 1 * LAMPORTS_PER_SOL});
      expect(again.list.data.lines, 'Item is added').deep.equals([result.item.publicKey, again.item.publicKey]);
    });

    it('fails if the list is full', async () => {
      const MAX_LIST_SIZE = 4;
      const owner = await createUser();
      const list = await createList(owner, 'list', MAX_LIST_SIZE);

      await Promise.all(new Array(MAX_LIST_SIZE).fill(0).map((_, i) => {
        return addItem({
          list,
          user: owner,
          name: `Item ${i}`,
          bounty: 1 * LAMPORTS_PER_SOL,
        });
      }));

      const adderStartingBalance = await getAccountBalance(owner.key.publicKey);

      // Now the list should be full.
      try {
        let addResult = await addItem({
          list,
          user: owner,
          name: 'Full item',
          bounty: 1 * LAMPORTS_PER_SOL,
        });

        console.dir(addResult, { depth: null });
        expect.fail('Adding to full list should have failed');
      } catch(e) {
        expect(e.toString()).contains('This list is full');
      }

      let adderNewBalance = await getAccountBalance(owner.key.publicKey);
      expect(adderStartingBalance, 'Adder balance is unchanged').equals(adderNewBalance);
    });

    it('fails if the bounty is smaller than the rent-exempt amount', async () => {
      const owner = await createUser();
      const list = await createList(owner, 'list');
      const adderStartingBalance = await getAccountBalance(owner.key.publicKey);

      try {
        await addItem({
          list,
          user: owner,
          name: 'Small bounty item',
          bounty: 10,
        });
        expect.fail('Should have failed');
      } catch(e) {
        expect(e.toString()).equals('Bounty must be enough to mark account rent-exempt');
      }

      let adderNewBalance = await getAccountBalance(owner.key.publicKey);
      expect(adderStartingBalance, 'Adder balance is unchanged').equals(adderNewBalance);
    });
  });

  describe('cancel', () => {
    it('List owner can cancel an item', async () => {
      const [owner, adder] = await createUsers(2);

      const list = await createList(owner, 'list');

      const adderStartingBalance = await getAccountBalance(adder.key.publicKey);

      const result = await addItem({
        list,
        user: adder,
        bounty: LAMPORTS_PER_SOL,
        name: 'An item',
      });

      const adderBalanceAfterAdd = await getAccountBalance(adder.key.publicKey);

      expect(result.list.data.lines, 'Item is added to list').deep.equals([result.item.publicKey]);
      expect(adderBalanceAfterAdd, 'Bounty is removed from adder').lt(adderStartingBalance);

      const cancelResult = await cancelItem({
        list,
        item: result.item,
        itemCreator: adder,
        user: owner,
      });

      const adderBalanceAfterCancel = await getAccountBalance(adder.key.publicKey);
      expectBalance(adderBalanceAfterCancel, adderBalanceAfterAdd + LAMPORTS_PER_SOL, 'Cancel returns bounty to adder');
      expect(cancelResult.list.data.lines, 'Cancel removes item from list').deep.equals([]);
    });

    it('Item creator can cancel an item', async () => {
      const [owner, adder] = await createUsers(2);

      const list = await createList(owner, 'list');
      const adderStartingBalance = await getAccountBalance(adder.key.publicKey);

      const result = await addItem({
        list,
        user: adder,
        bounty: LAMPORTS_PER_SOL,
        name: 'An item',
      });

      const adderBalanceAfterAdd = await getAccountBalance(adder.key.publicKey);

      expect(result.list.data.lines, 'Item is added to list').deep.equals([result.item.publicKey]);
      expect(adderBalanceAfterAdd, 'Bounty is removed from adder').lt(adderStartingBalance);

      const cancelResult = await cancelItem({
        list,
        item: result.item,
        itemCreator: adder,
        user: adder,
      });

      const adderBalanceAfterCancel = await getAccountBalance(adder.key.publicKey);
      expectBalance(adderBalanceAfterCancel, adderBalanceAfterAdd + LAMPORTS_PER_SOL, 'Cancel returns bounty to adder');
      expect(cancelResult.list.data.lines, 'Cancel removes item from list').deep.equals([]);
    });

    it('Other users can not cancel an item', async () => {
      const [owner, adder, otherUser] = await createUsers(3);

      const list = await createList(owner, 'list');

      const adderStartingBalance = await getAccountBalance(adder.key.publicKey);

      const result = await addItem({
        list,
        user: adder,
        bounty: LAMPORTS_PER_SOL,
        name: 'An item',
      });

      const adderBalanceAfterAdd = await getAccountBalance(adder.key.publicKey);

      expect(result.list.data.lines, 'Item is added to list').deep.equals([result.item.publicKey]);
      expect(adderBalanceAfterAdd, 'Bounty is removed from adder').lt(adderStartingBalance);

      try {
        const cancelResult = await cancelItem({
          list,
          item: result.item,
          itemCreator: adder,
          user: otherUser,
        });
        expect.fail(`Removing another user's item should fail`);
      } catch(e) {
        expect(e.toString(), 'Error message').equals('Only the list owner or item creator may cancel an item');
      }

      const adderBalanceAfterCancel = await getAccountBalance(adder.key.publicKey);
      expect(adderBalanceAfterCancel, 'Failed cancel does not change adder balance').equals(adderBalanceAfterAdd);

      let listData = await mainProgram.account.todoList.fetch(list.publicKey);
      expect(listData.lines, 'Item is still in list after failed cancel').deep.equals([result.item.publicKey]);

      const itemBalance = await getAccountBalance(result.item.publicKey);
      expect(itemBalance, 'Item balance is unchanged after failed cancel').equals(LAMPORTS_PER_SOL);
    });

    it('item_creator key must match the key in the item account', async () => {
      const [owner, adder] = await createUsers(2);
      const list = await createList(owner, 'list');

      const result = await addItem({
        list,
        user: adder,
        bounty: LAMPORTS_PER_SOL,
        name: 'An item',
      });

      try {
        await cancelItem({
          list,
          item: result.item,
          itemCreator: owner, // Wrong creator
          user: owner,
        });
        expect.fail(`Listing the wrong item creator should fail`);
      } catch(e) {
        expect(e.toString(), 'Error message').equals('Specified item creator does not match the pubkey in the item');
      }
    });

    it('Can not cancel an item that is not in the given list', async () => {
      const [owner, adder] = await createUsers(2);
      const [list1, list2] = await Promise.all([
        createList(owner, 'list1'),
        createList(owner, 'list2'),
      ]);

      const result = await addItem({
        list: list1,
        user: adder,
        bounty: LAMPORTS_PER_SOL,
        name: 'An item',
      });

      try {
        await cancelItem({
          list: list2, // Wrong list
          item: result.item,
          itemCreator: adder,
          user: owner,
        });
        expect.fail(`Cancelling from the wrong list should fail`);
      } catch(e) {
        expect(e.toString(), 'Error message').equals('Item does not belong to this todo list');
      }
    });
  });

  describe('finish', () => {
    it('List owner then item creator', async () => {
      const [owner, adder] = await createUsers(2);

      const list = await createList(owner, 'list');
      const ownerInitial = await getAccountBalance(owner.key.publicKey);

      const bounty = 5 * LAMPORTS_PER_SOL;
      const { item } = await addItem({
        list,
        user: adder,
        bounty,
        name: 'An item',
      });

      expect(await getAccountBalance(item.publicKey), 'initialized account has bounty').equals(bounty);

      const firstResult = await finishItem({
        list,
        item,
        user: owner,
        listOwner: owner,
      });

      expect(firstResult.list.data.lines, 'Item still in list after first finish').deep.equals([item.publicKey]);
      expect(firstResult.item.data.creatorFinished, 'Creator finish is false after owner calls finish').equals(false);
      expect(firstResult.item.data.listOwnerFinished, 'Owner finish flag gets set after owner calls finish').equals(true);
      expect(await getAccountBalance(firstResult.item.publicKey), 'Bounty remains on item after one finish call').equals(bounty);

      const finishResult = await finishItem({
        list,
        item,
        user: adder,
        listOwner: owner,
        expectAccountClosed: true,
      });

      expect(finishResult.list.data.lines, 'Item removed from list after both finish').deep.equals([]);
      expect(await getAccountBalance(finishResult.item.publicKey), 'Bounty remains on item after one finish call').equals(0);
      expectBalance(await getAccountBalance(owner.key.publicKey), ownerInitial + bounty, 'Bounty transferred to owner');
    });


    it('Item creator then list owner', async () => {
      const [owner, adder] = await createUsers(2);

      const list = await createList(owner, 'list');
      const ownerInitial = await getAccountBalance(owner.key.publicKey);

      const bounty = 5 * LAMPORTS_PER_SOL;
      const { item } = await addItem({
        list,
        user: adder,
        bounty,
        name: 'An item',
      });

      expect(await getAccountBalance(item.publicKey), 'initialized account has bounty').equals(bounty);

      const firstResult = await finishItem({
        list,
        item,
        user: adder,
        listOwner: owner,
      });

      expect(firstResult.list.data.lines, 'Item still in list after first finish').deep.equals([item.publicKey]);
      expect(firstResult.item.data.creatorFinished, 'Creator finish is true after creator calls finish').equals(true);
      expect(firstResult.item.data.listOwnerFinished, 'Owner finish flag is false after creator calls finish').equals(false);
      expect(await getAccountBalance(firstResult.item.publicKey), 'Bounty remains on item after one finish call').equals(bounty);

      const finishResult = await finishItem({
        list,
        item,
        user: owner,
        listOwner: owner,
        expectAccountClosed: true,
      });

      expect(finishResult.list.data.lines, 'Item removed from list after both finish').deep.equals([]);
      expect(await getAccountBalance(finishResult.item.publicKey), 'Bounty remains on item after one finish call').equals(0);
      expectBalance(await getAccountBalance(owner.key.publicKey), ownerInitial + bounty, 'Bounty transferred to owner');
    });

    it('Other users can not call finish', async () => {
      const [owner, adder, otherUser] = await createUsers(3);

      const list = await createList(owner, 'list');

      const bounty = 5 * LAMPORTS_PER_SOL;
      const { item } = await addItem({
        list,
        user: adder,
        bounty,
        name: 'An item',
      });

      try {
        await finishItem({
          list,
          item,
          user: otherUser,
          listOwner: owner,
        });
        expect.fail('Finish by other user should have failed');
      } catch(e) {
        expect(e.toString(), 'error message').equals('Only the list owner or item creator may finish an item');
      }

      expect(await getAccountBalance(item.publicKey), 'Item balance did not change').equal(bounty);
    });

    it('Can not call finish on an item that is not in the given list', async () => {
      const [owner, adder, otherUser] = await createUsers(3);

      const [list1, list2] = await Promise.all([
        createList(owner, 'list1'),
        createList(owner, 'list2'),
      ]);

      const bounty = 5 * LAMPORTS_PER_SOL;
      const { item } = await addItem({
        list: list1,
        user: adder,
        bounty,
        name: 'An item',
      });

      try {
        await finishItem({
          list: list2,
          item,
          user: otherUser,
          listOwner: owner,
        });
        expect.fail('Finish by other user should have failed');
      } catch(e) {
        expect(e.toString(), 'error message').equals('Item does not belong to this todo list');
      }

      expect(await getAccountBalance(item.publicKey), 'Item balance did not change').equal(bounty);
    });

    it('Can not call finish with the wrong list owner', async () => {
      const [owner, adder] = await createUsers(2);

      const list  = await createList(owner, 'list1');

      const bounty = 5 * LAMPORTS_PER_SOL;
      const { item } = await addItem({
        list,
        user: adder,
        bounty,
        name: 'An item',
      });

      try {
        await finishItem({
          list,
          item,
          user: owner,
          listOwner: adder,
        });

        expect.fail('Finish by other user should have failed');
      } catch(e) {
        expect(e.toString(), 'error message').equals('Specified list owner does not match the pubkey in the list');
      }

      expect(await getAccountBalance(item.publicKey), 'Item balance did not change').equal(bounty);
    });

    it('Can not call finish on an already-finished item', async () => {
      const [owner, adder] = await createUsers(2);

      const list = await createList(owner, 'list');
      const ownerInitial = await getAccountBalance(owner.key.publicKey);

      const bounty = 5 * LAMPORTS_PER_SOL;
      const { item } = await addItem({
        list,
        user: adder,
        bounty,
        name: 'An item',
      });

      expect(await getAccountBalance(item.publicKey), 'initialized account has bounty').equals(bounty);

      await Promise.all([
        finishItem({
          list,
          item,
          user: owner,
          listOwner: owner,
          expectAccountClosed: true,
        }),

        finishItem({
          list,
          item,
          user: adder,
          listOwner: owner,
          expectAccountClosed: true,
        })
      ]);

      try {
        await finishItem({
          list,
          item,
          user: owner,
          listOwner: owner,
          expectAccountClosed: true,
        });

        expect.fail('Finish on an already-closed item should fail');
      } catch(e) {
        expect(e.toString(), 'error message').equal('The given account is not owned by the executing program')
      }

      expectBalance(await getAccountBalance(owner.key.publicKey), ownerInitial + bounty, 'Bounty transferred to owner just once');
    });
  });
});
