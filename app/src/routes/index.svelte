<script lang="ts">
  import * as web3 from '@solana/web3.js';
  import { getPhantomWallet } from '@solana/wallet-adapter-wallets';
  import {
    createWalletStore,
    WalletConnectionState,
    walletConnectionStateLabels,
  } from '$lib/wallets';

  const walletList = [getPhantomWallet()];
  const wallet = createWalletStore({
    wallets: walletList,
    autoconnect: true,
  });

  $wallet.select(getPhantomWallet().name);
</script>

{#if $wallet.wallet && $wallet.state === WalletConnectionState.notready}
  <p>Initializing Wallet...</p>
  <a href={$wallet.wallet.url} target="_blank">Reconfigure Wallet</a>
{:else}
  <h1>Wallet State: {walletConnectionStateLabels[$wallet.state]}</h1>
{/if}
