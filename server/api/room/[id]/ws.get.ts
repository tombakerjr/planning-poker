// WebSocket upgrade handler for room connections
export default defineEventHandler(async (event) => {
  const roomId = getRouterParam(event, 'id')

  if (!roomId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Room ID is required'
    })
  }

  // Check if this is a WebSocket upgrade request
  const upgradeHeader = event.node.req.headers.upgrade
  if (upgradeHeader !== 'websocket') {
    throw createError({
      statusCode: 426,
      statusMessage: 'Expected WebSocket upgrade'
    })
  }

  try {
    // Get Durable Object binding
    const binding = (event.context.cloudflare?.env as any)?.POKER_ROOM
    if (!binding) {
      throw new Error('Durable Object binding not available')
    }

    // Get the Durable Object instance for this room
    const id = binding.idFromName(roomId)
    const stub = binding.get(id)

    // Create a proper Request object for the Durable Object
    const url = event.node.req.url || ''
    const host = event.node.req.headers.host || 'localhost'
    const fullUrl = url.startsWith('http') ? url : `https://${host}${url}`

    const request = new Request(fullUrl, {
      headers: event.node.req.headers as HeadersInit,
    })

    // Forward the WebSocket upgrade request to the Durable Object
    const response = await stub.fetch(request)

    // Return the Response directly - Nitro on Cloudflare should pass it through
    return response

  } catch (error) {
    console.error('Error upgrading WebSocket:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to establish WebSocket connection'
    })
  }
})
