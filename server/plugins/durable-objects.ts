// Nitro plugin to export Durable Objects for Cloudflare Workers
import { PokerRoom } from '../poker-room';

export default defineNitroPlugin(() => {
  // Plugin to ensure PokerRoom is available at runtime
});

// Re-export for Cloudflare Workers
export { PokerRoom };
