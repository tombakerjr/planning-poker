// Nitro plugin to add PokerRoom export to the main entry
import { PokerRoom } from '../server/lib/PokerRoom'

export default defineNitroPlugin((nitroApp) => {
  // Make PokerRoom available globally for Cloudflare Workers
  if (typeof globalThis !== 'undefined') {
    (globalThis as any).PokerRoom = PokerRoom
  }
})
