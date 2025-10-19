import { nanoid } from 'nanoid'

export default defineEventHandler(async (event) => {
  try {
    // Generate a unique room ID
    const roomId = nanoid(10) // 10 character room ID
    
    // Return the room ID
    return {
      roomId
    }
  } catch (error) {
    console.error('Error creating room:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to create room'
    })
  }
})