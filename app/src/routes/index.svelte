<script context="module">
  import { Buffer } from 'buffer'; // @ledger assumes this is available but it's only native to Node
  globalThis.Buffer = Buffer;
</script>

<script lang="ts">
  import { Program, Provider, web3 } from '@project-serum/anchor';
  import {
    createWalletStore,
    WalletConnectionState,
    walletConnectionStateLabels,
  } from '$lib/wallets';
  import { Connection } from '@solana/web3.js';
  import { onMount } from 'svelte';

  const wallet = createWalletStore({
    autoconnect: true,
  });

  onMount(async () => {
    const wallets = await import('@solana/wallet-adapter-wallets');
    const walletList = [wallets.getPhantomWallet()];
    console.dir(walletList);
    $wallet.setWallets(walletList);
    $wallet.select(walletList[0].name);
  });

  const commitmentLevel = 'processed';

  const network = 'http://127.0.0.1:8899';
  const connection = new Connection(network, commitmentLevel);
  $: provider = new Provider(connection, $wallet, {});
</script>

{#if $wallet.wallet && $wallet.state === WalletConnectionState.notready}
  <p>Initializing Wallet {$wallet.wallet.name}...</p>
  <a href={$wallet.wallet.url} target="_blank">Reconfigure Wallet</a>
{:else if !$wallet.wallet}
  <p>Select a wallet</p>
{:else}
  <h1>Wallet State: {walletConnectionStateLabels[$wallet.state]}</h1>
{/if}
