// Main worker entry point that exports Durable Objects and handles Nuxt requests
import { PokerRoom } from './server/lib/PokerRoom'

// Export Durable Object classes for Cloudflare Workers
export { PokerRoom }

// This will be replaced with the actual Nuxt handler after build
const nuxtHandler = {
  fetch: () => new Response('Build the Nuxt app first', { status: 503 })
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)
    
    // Handle WebSocket upgrade requests directly
    if (request.headers.get('Upgrade') === 'websocket' && url.pathname.includes('/api/room/') && url.pathname.endsWith('/ws')) {
      // Extract room ID from the path
      const pathParts = url.pathname.split('/')
      const roomIndex = pathParts.indexOf('room')
      if (roomIndex !== -1 && pathParts[roomIndex + 1]) {
        const roomId = pathParts[roomIndex + 1]
        
        // Get the Durable Object instance
        const durableObjectId = env.POKER_ROOM.idFromString(roomId)
        const durableObject = env.POKER_ROOM.get(durableObjectId)
        
        // Forward the request to the Durable Object
        return durableObject.fetch(request)
      }
      
      return new Response('Invalid room ID', { status: 400 })
    }
    
    // For all other requests, use the Nuxt handler
    return nuxtHandler.fetch(request, env, ctx)
  }
}
