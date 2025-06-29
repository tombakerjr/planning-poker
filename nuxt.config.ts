// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "2025-05-15",
  devtools: { enabled: true },

  nitro: {
    preset: "cloudflare_module",
    
    cloudflare: {
      deployConfig: true,
      nodeCompat: true,
    },

    // Include the PokerRoom in the bundle
    externals: {
      inline: ["./server/lib/PokerRoom"]
    },

    // Ensure proper module loading
    experimental: {
      wasm: true
    }
  },

  modules: ["@nuxtjs/tailwindcss"],
});
