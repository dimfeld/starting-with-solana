<script context="module">
  import { Buffer } from 'buffer'; // @ledger assumes this is available but it's only native to Node
  globalThis.Buffer = Buffer;
</script>

<script lang="ts">
  import '../app.css';
  import {
    createWalletStore,
    WalletConnectionState,
    walletConnectionStateLabels,
  } from '$lib/wallets';
  import { setSolanaContext } from '$lib/context';
  import { Commitment, Connection } from '@solana/web3.js';
  import { onMount, setContext } from 'svelte';
  import WalletList from '../lib/WalletList.svelte';
  import WalletGrid from '../lib/WalletGrid.svelte';

  const wallet = createWalletStore({
    autoconnect: true,
  });

  const commitmentLevel: Commitment = 'processed';

  const network = 'http://127.0.0.1:8899';
  const connection = new Connection(network, commitmentLevel);

  setSolanaContext({ wallet, connection, commitmentLevel });

  onMount(async () => {
    const wallets = await import('@solana/wallet-adapter-wallets');
    const walletList = [
      wallets.getPhantomWallet(),
      wallets.getSlopeWallet(),
      wallets.getBitpieWallet(),
      wallets.getSolflareWallet(),
    ];
    $wallet.setWallets(walletList);
  });

  let switchWalletMenuOpen = false;
</script>

<div class="bg-gray-50 min-h-screen w-full">
  <div class="mx-auto container">
    <header class="bg-white flex flex-row justify-between">
      <span>Wallet State: {walletConnectionStateLabels[$wallet.state]}</span>
      <div class="relative">
        <button
          on:click={() => (switchWalletMenuOpen = !switchWalletMenuOpen)}
          class="text-sm font-medium text-gray-800 rounded-lg border border-gray-200 px-3 py-2"
          >Switch Wallets</button>
        {#if switchWalletMenuOpen}
          <div class="absolute right-0">
            <WalletList on:select={() => (switchWalletMenuOpen = false)} />
          </div>
        {/if}
      </div>
    </header>
    <main class="pt-2">
      <div class="max-w-lg" />
      {#if $wallet.wallet}
        <slot />
      {:else}
        <WalletGrid />
      {/if}
    </main>
  </div>
</div>
