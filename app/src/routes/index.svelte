<script lang="ts">
  import { Program, Provider, web3 } from '@project-serum/anchor';
  import {
    WalletConnectionState,
    walletConnectionStateLabels,
  } from '$lib/wallets';
  import { getSolanaContext } from '$lib/context';
  import idl from '$lib/idl/p0001.json';
  import { Keypair, PublicKey, SystemProgram } from '@solana/web3.js';
  import { getContext, onMount } from 'svelte';

  const { wallet, connection, commitmentLevel } = getSolanaContext();
  const baseAccount: PublicKey = getContext('baseAccount');

  const programID = new PublicKey(idl.metadata.address);
  $: provider = new Provider(connection, $wallet, {
    preflightCommitment: commitmentLevel,
  });
  $: program = new Program(idl, programID, provider);

  let items = [];

  let baseAccountPubkey: PublicKey | null = null;

  onMount(() => {
    let savedBaseAccount = localStorage.getItem('p0001BaseAccount');
    if (savedBaseAccount) {
      baseAccountPubkey = new PublicKey(savedBaseAccount);
    }
  });

  async function initialize(firstLine: string) {
    let baseAccount = Keypair.generate();
    baseAccountPubkey = baseAccount.publicKey;
    localStorage.setItem('p0001BaseAccount', baseAccountPubkey.toBase58());

    try {
      await program.rpc.initialize(firstLine, {
        accounts: {
          baseAccount: baseAccount.publicKey,
          user: provider.wallet.publicKey,
          systemProgram: SystemProgram.programId,
        },
        signers: [baseAccount],
      });
      await readAccountData();
    } catch (e) {
      console.error(e);
    }
  }

  async function add(line: string) {
    try {
      await program.rpc.add(line, {
        accounts: {
          baseAccount: baseAccountPubkey,
          user: provider.wallet.publicKey,
        },
      });

      await readAccountData();
    } catch (e) {
      console.error(e);
    }
  }

  let textInput = '';
  async function handleAdd(e: Event) {
    e.preventDefault();
    if (!textInput) {
      return;
    }

    if (baseAccountPubkey) {
      await add(textInput);
    } else {
      await initialize(textInput);
    }

    textInput = '';
  }

  async function readAccountData() {
    const account = await program.account.baseAccount.fetch(baseAccountPubkey);
    items = account.data;
  }

  function resetAccount() {
    items = [];
    baseAccountPubkey = null;
  }
</script>

<div class="mx-auto max-w-lg">
  <form action="#" class="flex flex-row" on:submit={handleAdd}>
    <input type="text" bind:value={textInput} class="flex-grow" />
    <button class="ml-2" type="submit">Add</button>
  </form>
  <ul
    class="border border-gray-100 flex flex-col divide-y divide-gray-100 bg-white">
    {#each items as item}
      <li class="px-3 py-2">{item}</li>
    {:else}
      <li class="px-3 py-2">No items yet!</li>
    {/each}
  </ul>

  <button class="mt-4" type="button" on:click={resetAccount}
    >Reset Account</button>
  <p class="text-sm">
    Account Pubkey: {baseAccountPubkey?.toString() ?? 'Not Initialized'}
  </p>
</div>
