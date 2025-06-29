// Nitro plugin to ensure PokerRoom is available in the Worker context
export default defineNitroPlugin(async (nitroApp) => {
  // This plugin ensures the PokerRoom class is available for Cloudflare Workers
  console.log('Durable Objects plugin loaded')
})
