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
        <img
          class="hover"
          alt="Select {walletOption.name}"
          on:click={() => doSelect(walletOption)}
          src={walletOption.icon} />
        <div class="bottom-row">
          <span>{walletOption.name}</span>
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
        </div>
      </li>
    </slot>
  {/each}
</ul>

<style>
  ul {
    display: grid;
    grid-template-columns: repeat(auto-fill, 10rem);
    gap: 1rem;
  }

  li {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 1rem;

    list-style: none;
    cursor: default;
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1),
      0 4px 6px -2px rgba(0, 0, 0, 0.05);
  }

  img {
    padding: 0.5rem;
    width: 8rem;
    height: 8rem;
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

  .bottom-row {
    display: flex;
    flex-direction: row;
    align-items: center;
    margin-top: 0.5rem;
  }

  .wallet-website-link {
    margin-left: 0.5rem;
  }

  svg {
    display: inline;
    width: 1.5rem;
    height: 1.5rem;
  }
</style>
