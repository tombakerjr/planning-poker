// Main entry point for Cloudflare Workers
// This file ensures PokerRoom is properly exported for Durable Objects

export { PokerRoom } from './lib/PokerRoom';

// Default export for the worker - will be overridden by Nuxt
export default {
  fetch: () => new Response('Not Found', { status: 404 })
};
