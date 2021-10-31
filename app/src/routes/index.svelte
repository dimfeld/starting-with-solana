<script lang="ts">
  import { Program, Provider, web3 } from '@project-serum/anchor';
  import {
    WalletConnectionState,
    walletConnectionStateLabels,
  } from '$lib/wallets';
  import { getSolanaContext } from '$lib/context';

  const { wallet, connection } = getSolanaContext();

  $: provider = new Provider(connection, $wallet, {});
</script>

{#if !$wallet.wallet}
  <p>Loading...</p>
{:else if $wallet.wallet && $wallet.state === WalletConnectionState.connected}
  Ready
{/if}
