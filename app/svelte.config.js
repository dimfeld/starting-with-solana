import preprocess from 'svelte-preprocess';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  // Consult https://github.com/sveltejs/svelte-preprocess
  // for more information about preprocessors
  preprocess: [
    preprocess({
      postcss: true,
    }),
  ],

  kit: {
    vite: () => ({
      define: {
        // Overrides for written code that assumes Node.js
        'global.TextDecoder': 'TextDecoder', // borsh
        'process.version': '"1000"', // pump which is imported by @torus
      },
      ssr: {},
      optimizeDeps: {
        include: ['eventemitter3'],
      },
    }),
    // hydrate the <div id="svelte"> element in src/app.html
    target: '#svelte',
  },
};

export default config;
