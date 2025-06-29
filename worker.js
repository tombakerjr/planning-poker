// Main worker entry point that exports Durable Objects and handles Nuxt requests
import { PokerRoom } from './server/lib/PokerRoom.ts'

// Export Durable Object classes for Cloudflare Workers
export { PokerRoom }

// This will be replaced with the actual Nuxt handler after build
export { default } from './.output/server/index.mjs'
