const assert = require('assert');
const anchor = require('@project-serum/anchor');
const BN = require('bn.js');
const fs = require('fs');
const path = require('path');
const expect = require('chai').expect;
const { SystemProgram, LAMPORTS_PER_SOL } = anchor.web3;

describe('todo', () => {
  const provider = anchor.Provider.env();
  anchor.setProvider(provider);
  const mainProgram = anchor.workspace.Todo;

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

  async function getAccountBalance(pubkey) {
    let account = await provider.connection.getAccountInfo(pubkey);
    return account.lamports;
  }

  function programForUser(user) {
    return new anchor.Program(mainProgram.idl, mainProgram.programId, user.provider);
  }

  async function createList(owner, name) {
    const listAccount = anchor.web3.Keypair.generate();
    let program = programForUser(owner);
    await program.rpc.newList(name, {
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

  async function cancelItem({ list, item, user }) {
    let program = programForUser(user);
    await program.rpc.cancel({
      accounts: {
        list: list.publicKey,
        item: item.publicKey,
        user: user.key.publicKey,
      }
    });

    let listData = await program.account.list.fetch(list.publicKey);
    return {
      list: {
        publicKey: list.publicKey,
        data: listData,
      }
    }
  }

  async function finishItem({ list, item, user }) {
    let program = programForUser(user);
    await program.rpc.cancel({
      accounts: {
        list: list.publicKey,
        item: item.publicKey,
        user: user.key.publicKey,
      }
    });

    let listData = await program.account.list.fetch(list.publicKey);
    let itemData = await program.account.item.fetch(item.publicKey);
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

      expect(list.data.list_owner, 'List owner is set').equals(owner.publicKey);
      expect(list.data.name, 'List name is set').equals('A list');
      expect(list.data.lines.length, 'List has no items').equals(0);
    });

    it('fails if the name is too long', async () => {
      const owner = await createUser();
      try {
        await createList(owner, 'joisefjiosefniosefniosnefio;vnsiefdnis;efniosefmklsfknsjkndjrl');
        assert.fail("Name too long should have failed");
      } catch(e) {
        assert.equal(e.toString(), 'Name must be 60 bytes or less');
      }
    });
  });

  describe('add', () => {
    it('Anyone can add an item to a list', async () => {
      const owner = await createUser();
      const adder = await createUser();

      const adderStartingBalance = await getAccountBalance(adder.key.publicKey);
      const list = await createList(owner, 'list');
      const result = await addItem({ list, user: adder, name: 'Do something', bounty: 1 * LAMPORTS_PER_SOL});

      console.dir(result);
      expect(result.list.data.lines, 'Item is added').deep.equals([result.item.publicKey]);
      expect(result.item.data.creator.toString(), 'Item marked with creator').equals(adder.key.publicKey.toString());
      expect(result.item.data.creatorFinished, 'creator_finished is false').equals(false);
      expect(result.item.data.listOwnerFinished, 'list_owner_finished is false').equals(false);
      expect(result.item.data.name, 'Name is set').equals('Do something');
      expect(await getAccountBalance(result.item.publicKey), 'List account balance').equals(1 * LAMPORTS_PER_SOL);

      let adderNewBalance = await getAccountBalance(adder.key.publicKey);
      expect(adderStartingBalance - adderNewBalance, 'Number of lamports removed from adder is equal to bounty').equals(1 * LAMPORTS_PER_SOL);
    });

    it('fails if the name is too long', async() => {
      const owner = await createUser();
      const list = await createList(owner, 'list');
      const adderStartingBalance = await getAccountBalance(owner.key.publicKey);

      try {
        const result = await addItem({
          list,
          user: owner,
          name: 'joisefjiosefniosefniosnefio;vnsiefdnis;efniosefmklsfknsjkndjrl',
          bounty: 1 * LAMPORTS_PER_SOL
        });
        assert.fail('Should have failed');
      } catch(e) {
        assert.equal(e.toString(), 'Name must be 60 bytes or less');
      }

      let adderNewBalance = await getAccountBalance(adder.key.publicKey);
      expect(adderStartingBalance, 'Adder balance is unchanged').equals(adderNewBalance);
    });

    it('fails if the list is full', async () => {
      const owner = await createUser();
      const list = await createList(owner, 'list');

      for(let i = 0; i < MAX_LIST_SIZE; i++) {
        await addItem({
          list,
          user: owner,
          name: `Item ${i}`,
          bounty: 1 * LAMPORTS_PER_SOL,
        });
      }

      const adderStartingBalance = await getAccountBalance(owner.key.publicKey);

      // Now the list should be full.
      try {
        await addItem({
          list,
          user: owner,
          name: 'Full item',
          bounty: 1 * LAMPORTS_PER_SOL,
        });
        assert.fail('Adding to full list should have failed');
      } catch(e) {
        assert.equal(e.toString(), 'This list is full');
      }

      let adderNewBalance = await getAccountBalance(adder.key.publicKey);
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
        assert.fail('Should have failed');
      } catch(e) {
        assert.equal(e.toString(), 'Bounty must be enough to mark account rent-exempt');
      }

      let adderNewBalance = await getAccountBalance(adder.key.publicKey);
      expect(adderStartingBalance, 'Adder balance is unchanged').equals(adderNewBalance);
    });
  });

  describe('cancel', () => {
    it('List owner can cancel an item', async () => {
      const owner = await createUser();
      const adder = await createUser();

      const list = await createList(owner, 'list');

      const adderStartingBalance = await getAccountBalance(adder.key.publicKey);

      const result = await addItem({
        list,
        user: adder,
        bounty: LAMPORTS_PER_SOL,
        name: 'An item',
      });

      const adderBalanceAfterAdd = await getAccountBalance(adder.key.publicKey);

      expect(cancelResult.list.data.lines, 'Item is added to list').deep.equals([result.item.publicKey]);
      expect(adderBalanceAfterAdd, 'Bounty is removed from adder').lt(adderStartingBalance);

      const cancelResult = await cancelItem({
        list,
        item: result.item,
        user: owner,
      });

      const adderBalanceAfterCancel = await getAccountBalance(adder.key.publicKey);
      expect(adderBalanceAfterCancel, 'Cancel returns bounty to adder').equals(adderStartingBalance);
      expect(cancelResult.list.data.lines, 'Cancel removes item from list').deep.equals([]);
    });

    it('Item creator can cancel an item', async () => {
      const owner = await createUser();
      const adder = await createUser();

      const list = await createList(owner, 'list');

      const adderStartingBalance = await getAccountBalance(adder.key.publicKey);

      const result = await addItem({
        list,
        user: adder,
        bounty: LAMPORTS_PER_SOL,
        name: 'An item',
      });

      const adderBalanceAfterAdd = await getAccountBalance(adder.key.publicKey);

      expect(cancelResult.list.data.lines, 'Item is added to list').deep.equals([result.item.publicKey]);
      expect(adderBalanceAfterAdd, 'Bounty is removed from adder').lt(adderStartingBalance);

      const cancelResult = await cancelItem({
        list,
        item: result.item,
        user: adder,
      });

      const adderBalanceAfterCancel = await getAccountBalance(adder.key.publicKey);
      expect(adderBalanceAfterCancel, 'Cancel returns bounty to adder').equals(adderStartingBalance);
      expect(cancelResult.list.data.lines, 'Cancel removes item from list').deep.equals([]);
    });

    it('Other users can not cancel an item', async () => {
      const owner = await createUser();
      const adder = await createUser();
      const otherUser = await createUser();

      const list = await createList(owner, 'list');

      const adderStartingBalance = await getAccountBalance(adder.key.publicKey);

      const result = await addItem({
        list,
        user: adder,
        bounty: LAMPORTS_PER_SOL,
        name: 'An item',
      });

      const adderBalanceAfterAdd = await getAccountBalance(adder.key.publicKey);

      expect(cancelResult.list.data.lines, 'Item is added to list').deep.equals([result.item.publicKey]);
      expect(adderBalanceAfterAdd, 'Bounty is removed from adder').lt(adderStartingBalance);

      try {
        const cancelResult = await cancelItem({
          list,
          item: result.item,
          user: otherUser,
        });
        expect.fail(`Removing another user's item should fail`);
      } catch(e) {
        expect(e.toString(), 'Error message').equals('Only the list owner or item creator may cancel an item');
      }

      const adderBalanceAfterCancel = await getAccountBalance(adder.key.publicKey);
      expect(adderBalanceAfterCancel, 'Cancel returns bounty to adder').equals(adderStartingBalance);
      expect(cancelResult.list.data.lines, 'Cancel removes item from list').deep.equals([]);

      let listData = await program.account.list.fetch(list.publicKey);
      expect(listData.lines, 'Item is still in list after failed cancel').deep.equals([result.item.publicKey]);

      const itemBalance = await getAccountBalance(result.item.publicKey);
      expect(itemBalance, 'Item balance is unchanged after failed cancel').equals(LAMPORTS_PER_SOL);
    });

    it('Can not cancel an item that is not in the given list');
  });

  describe('finish', () => {
    it('List owner can call finish on an item');
    it('Item creator can call finish on an item');
    it('Bounty is sent to the list owner once both parties call finish');
    it('Other users can not call finish');
    it('Can not call finish on an item that is not in the given list');
  });
});
