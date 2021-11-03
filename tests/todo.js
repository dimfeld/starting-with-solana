const assert = require('assert');
const anchor = require('@project-serum/anchor');
const expect = require('chai').expect;
const { SystemProgram, LAMPORTS_PER_SOL } = anchor.web3;

describe('todo', () => {
  const provider = anchor.Provider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.Todo;

  async function createUser(airdropBalance) {
    airdropBalance = airdropBalance ?? 5000 * LAMPORTS_PER_SOL;
    let user = anchor.web3.Keypair.generate();
    let sig = await provider.connection.requestAirdrop(user.publicKey, airdropBalance);
    await provider.connection.confirmTransaction(sig);
    return user;
  }

  async function createList(owner, name) {
    const listAccount = anchor.web3.Keypair.generate();
    await program.rpc.newList(name, {
      accounts: {
        list: listAccount.publicKey,
        user: owner.publicKey,
        systemProgram: SystemProgram.programId,
      },
      signers: [listAccount]
    });

    let list = program.account.list.fetch(listAccount.publicKey);
    return { publicKey: listAccount.publicKey, data: list };
  }

  async function addItem({list, user, name, bounty}) {
    const itemAccount = anchor.web3.Keypair.generate();
    await program.rpc.add(name, bounty, {
      accounts: {
        list: list.publicKey,
        item: itemAccount.publicKey,
        user: user.publicKey,
        systemProgram: SystemProgram.programId,
      },
      signers: [
        user,
        itemAccount,
      ]
    });

    let listData = await program.account.list.fetch(list.publicKey);
    let itemData = await program.account.item.fetch(itemAccount.publicKey);

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
    await program.rpc.cancel({
      accounts: {
        list: list.publicKey,
        item: item.publicKey,
        user: user.publicKey,
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
    await program.rpc.cancel({
      accounts: {
        list: list.publicKey,
        item: item.publicKey,
        user: user.publicKey,
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

      const list = await createList(owner, 'list');
      const result = await addItem({ list, user: adder, name: 'Do something', bounty: 1 * LAMPORTS_PER_SOL});

      expect(result.list.data.lines, 'Item is added').deep.equals([result.item.publicKey]);
      expect(result.item.data.creator, 'Item marked with creator').equals(adder.publicKey);
      expect(result.item.data.creator_finished, 'creator_finished is false').equals(false);
      expect(result.item.data.list_owner_finished, 'list_owner_finished is false').equals(false);
      expect(result.item.data.name, 'Name is set').equals('Do something');
    });

    it('fails if the name is too long');
    it('fails if the list is full');
    it('fails if the bounty is smaller than the rent-exempt amount');
  });

  describe('cancel', () => {
    it('List owner can cancel an item');
    it('Item creator can cancel an item');
    it('Other users can not cancel an item');
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
