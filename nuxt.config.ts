// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "2025-05-15",
  devtools: { enabled: true },
  future: {
    compatibilityVersion: 4,
  },

  nitro: {
    preset: "cloudflare_module",
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

  modules: ["@nuxtjs/tailwindcss"],
});
