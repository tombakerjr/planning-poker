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
      // In production, WebSocket connects to the same domain as the app
      // In development, still use localhost:8787 for the separate worker
      websocketUrl: process.env.NODE_ENV === 'production' 
        ? undefined // Will use current origin
        : "ws://localhost:8787",
    },
  },

  modules: ["@nuxtjs/tailwindcss"],
});
