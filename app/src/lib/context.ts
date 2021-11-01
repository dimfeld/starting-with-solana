import { Commitment, Connection } from '@solana/web3.js';
import { getContext, setContext } from 'svelte';
import { Readable } from 'svelte/store';
import { WalletStore } from './wallets';

const SOLANA_CONTEXT_KEY = 'app_solana_context';

export interface SolanaContext {
  wallet: Readable<WalletStore>;
  connection: Connection;
  commitmentLevel: Commitment;
}

export function setSolanaContext(ctx: SolanaContext) {
  setContext(SOLANA_CONTEXT_KEY, ctx);
}

export function getSolanaContext(): SolanaContext {
  return getContext(SOLANA_CONTEXT_KEY);
}
