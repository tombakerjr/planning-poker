// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "2025-05-15",
  devtools: { enabled: true },

  nitro: {
    preset: "cloudflare_module",
    cloudflare: {
      deployConfig: false,
      nodeCompat: true,
    },
  },

  modules: ["@nuxtjs/tailwindcss"],
});
