import { PokerRoom } from './lib/PokerRoom';

// Export the PokerRoom Durable Object for the Workers runtime
export { PokerRoom };

// Default export for the worker
export default {
  // This will be handled by Nuxt's server routes
  fetch: () => new Response('Not Found', { status: 404 })
};
