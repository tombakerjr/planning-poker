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
  },

  runtimeConfig: {
    public: {
      // Default for development - will be overridden in production
      websocketUrl: "ws://localhost:8787",
    },
  },

  modules: ["@nuxtjs/tailwindcss"],
});
