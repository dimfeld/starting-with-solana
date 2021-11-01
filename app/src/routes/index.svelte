<script lang="ts">
  import { Program, Provider, web3 } from '@project-serum/anchor';
  import {
    WalletConnectionState,
    walletConnectionStateLabels,
  } from '$lib/wallets';
  import { getSolanaContext } from '$lib/context';
  import idl from '$lib/idl/p0001.json';
  import { PublicKey } from '@solana/web3.js';

  const { wallet, connection, commitmentLevel } = getSolanaContext();

  const programID = new PublicKey(idl.metadata.address);
  $: provider = new Provider(connection, $wallet, {
    preflightCommitment: commitmentLevel,
  });

  async function createCounter() {
    const program = new Program(idl, programID, provider);
  }
</script>

{#if !$wallet.wallet}
  <p>Loading...</p>
{:else if $wallet.wallet && $wallet.state === WalletConnectionState.connected}
  Ready
{/if}
