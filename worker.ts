// Main worker entry point that exports Durable Objects and handles Nuxt requests
import { PokerRoom } from './server/lib/PokerRoom'

// Export Durable Object classes for Cloudflare Workers
export { PokerRoom }

// This will be replaced with the actual Nuxt handler after build
export default {
  fetch: () => new Response('Build the Nuxt app first', { status: 503 })
}
