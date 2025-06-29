export default defineEventHandler(async (event) => {
  try {
    // Access the Cloudflare environment bindings from the event context
    const env = event.context.cloudflare.env;

    // Create a new unique ID for the Durable Object
    const id = env.POKER_ROOM.newUniqueId();

    // Return the ID as a string
    return { roomId: id.toString() };
  } catch (error: any) {
    console.error('Failed to create room:', error);
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to create room',
    });
  }
});
