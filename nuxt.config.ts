// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-05-15',
  devtools: { enabled: true },
  future: {
    compatibilityVersion: 4,
  },

  app: {
    head: {
      script: [
        {
          innerHTML: `
            (function() {
              const stored = localStorage.getItem('planning-poker-theme');
              const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
              const shouldBeDark = stored === 'dark' || (stored === 'system' && prefersDark) || (!stored && prefersDark);
              if (shouldBeDark) {
                document.documentElement.classList.add('dark');
              }
            })()
          `,
          type: 'text/javascript',
        },
      ],
    },
  },

  nitro: {
    preset: 'cloudflare_module',
    cloudflare: {
      deployConfig: false,
    },
    rollupConfig: {
      output: {
        exports: 'named',
      },
    },
    externals: {
      inline: ['server/poker-room.ts'],
    },
  },

  modules: ['@nuxtjs/tailwindcss'],
});
