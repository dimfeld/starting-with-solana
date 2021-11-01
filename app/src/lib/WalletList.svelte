<script lang="ts">
  import { getSolanaContext } from './context';
  import { createEventDispatcher } from 'svelte';
  import type { Wallet } from '@solana/wallet-adapter-wallets';

  const dispatch = createEventDispatcher<{ select: Wallet }>();
  const { wallet } = getSolanaContext();

  function doSelect(newWallet: Wallet) {
    $wallet.select(newWallet.name);
    dispatch('select', newWallet);
  }
</script>

<ul>
  {#each Object.values($wallet.allWallets) as walletOption (walletOption.name)}
    <slot wallet={walletOption} select={() => doSelect(walletOption)}>
      <li>
        <div
          class="select-button hover"
          on:click={() => doSelect(walletOption)}>
          <img src={walletOption.icon} alt="Select {walletOption.name}" />
          <span class="wallet-name">{walletOption.name}</span>
        </div>
        <a
          class="wallet-website-link hover"
          href={walletOption.url}
          target="_blank"
          title="Open {walletOption.name} Website">
          <!-- heroicons.com link -->
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
      </li>
    </slot>
  {/each}
</ul>

<style>
  ul {
    display: flex;
    flex-direction: column;
    width: 11rem;
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1),
      0 4px 6px -2px rgba(0, 0, 0, 0.05);
  }

  li {
    list-style-type: none;
    display: flex;
    flex-direction: row;
    align-items: stretch;
    width: 100%;
  }

  li:not(:last-child) {
    border-bottom-width: 1px;
    border-color: rgba(229, 231, 235);
  }

  .hover {
    transition-property: background-color, border-color, color, fill, stroke,
      opacity, box-shadow, transform;
    transition-duration: 200ms;
    border-radius: 0.375rem;
  }

  .hover:hover {
    background-color: rgba(229, 231, 235);
  }

  .select-button {
    display: flex;
    padding-top: 0.5rem;
    padding-bottom: 0.5rem;
    padding-left: 0.5rem;
    flex-direction: row;
    flex-grow: 1;
    align-items: center;
    cursor: default;
  }

  .wallet-name {
    margin-left: 0.5rem;
  }

  .wallet-website-link {
    padding-left: 0.5rem;
    padding-right: 0.5rem;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }

  img {
    width: 2rem;
    height: 2rem;
  }

  svg {
    width: 1.5rem;
    height: 1.5rem;
  }
</style>
