export default defineEventHandler(async (event) => {
  // Only handle WebSocket upgrade requests
  const upgradeHeader = getHeader(event, 'upgrade');
  if (upgradeHeader !== 'websocket') {
    throw createError({
      statusCode: 426,
      statusMessage: 'Expected Upgrade: websocket',
    });
  }

  try {
    // Get the room ID from the route parameters
    const roomId = getRouterParam(event, 'id');
    if (!roomId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Room ID is required',
      });
    }

    // Access the Cloudflare environment bindings
    const env = event.context.cloudflare.env;
    
    // Get the Durable Object instance for this room
    const durableObjectId = env.POKER_ROOM.idFromString(roomId);
    const durableObject = env.POKER_ROOM.get(durableObjectId);

    // Get the original request from the event context.
    // This is crucial for WebSocket upgrades as it contains internal Cloudflare properties.
    const originalRequest = event.context.cloudflare.request;

    // Forward the original WebSocket upgrade request to the Durable Object
    return durableObject.fetch(originalRequest);

  } catch (error: any) {
    console.error('WebSocket upgrade failed:', error);
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to establish WebSocket connection',
    });
  }
});
