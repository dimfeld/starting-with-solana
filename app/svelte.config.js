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
        'process.version': '"1000"', // @torus imports pump which checks for Node 0.x
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
