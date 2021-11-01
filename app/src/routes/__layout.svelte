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

  const wallet = createWalletStore({
    autoconnect: true,
  });

  const commitmentLevel : Commitment = 'processed';

  const network = 'http://127.0.0.1:8899';
  const connection = new Connection(network, commitmentLevel);

  setSolanaContext({ wallet, connection, commitmentLevel });

  onMount(async () => {
    const wallets = await import('@solana/wallet-adapter-wallets');
    const walletList = [wallets.getPhantomWallet()];
    $wallet.setWallets(walletList);
    if (!$wallet.wallet) {
      $wallet.select(walletList[0].name);
    }
  });

  $: console.log('layout', $wallet.state);
</script>

<div class="bg-gray-50 min-h-screen w-full">
  <div class="mx-auto container">
    <header class="bg-white">
      <span>Wallet State: {walletConnectionStateLabels[$wallet.state]}</span>
    </header>
    <main class="pt-2">
      <slot />
    </main>
  </div>
</div>
