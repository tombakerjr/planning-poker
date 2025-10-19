// Custom worker entrypoint that exports both the default export and Durable Objects
import * as nitroApp from './.output/server/index.mjs'
export { PokerRoom } from './server/poker-room'

interface Env {
  POKER_ROOM: DurableObjectNamespace
  ASSETS: Fetcher
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // Check if this is a WebSocket upgrade request for a room
    const url = new URL(request.url)
    const wsMatch = url.pathname.match(/^\/api\/room\/([^\/]+)\/ws$/)

    if (wsMatch && request.headers.get('Upgrade') === 'websocket') {
      const roomId = wsMatch[1]

      // Get the Durable Object instance for this room
      const id = env.POKER_ROOM.idFromName(roomId)
      const stub = env.POKER_ROOM.get(id)

      // Forward the WebSocket upgrade request to the Durable Object
      return stub.fetch(request)
    }

    // For all other requests, pass to the Nuxt handler
    return nitroApp.default.fetch(request, env, ctx)
  }
}
