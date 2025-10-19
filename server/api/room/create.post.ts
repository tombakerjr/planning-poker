import { nanoid } from 'nanoid'
import { logger } from '~/server/utils/logger'

const MAX_ROOMS_PER_MINUTE = 5;
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute

// Simple in-memory rate limit tracking
// In production, consider using Cloudflare KV or Durable Objects for distributed rate limiting
const rateLimitMap = new Map<string, { count: number; windowStart: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const rateLimit = rateLimitMap.get(ip);

  if (!rateLimit) {
    rateLimitMap.set(ip, { count: 1, windowStart: now });
    return true;
  }

  // Check if we're in a new window
  if (now - rateLimit.windowStart >= RATE_LIMIT_WINDOW_MS) {
    rateLimit.count = 1;
    rateLimit.windowStart = now;
    return true;
  }

  // Increment count
  rateLimit.count++;

  if (rateLimit.count > MAX_ROOMS_PER_MINUTE) {
    return false;
  }

  return true;
}

export default defineEventHandler(async (event) => {
  try {
    // Get client IP for rate limiting
    const ip = getRequestHeader(event, 'cf-connecting-ip') ||
               getRequestHeader(event, 'x-forwarded-for') ||
               'unknown';

    // Check rate limit
    if (!checkRateLimit(ip)) {
      throw createError({
        statusCode: 429,
        statusMessage: 'Too many room creation requests. Please try again later.'
      });
    }

    // Generate a unique room ID
    const roomId = nanoid(10) // 10 character room ID

    // Return the room ID
    return {
      roomId
    }
  } catch (error) {
    logger.error('Error creating room:', error)

    // Re-throw if it's already a createError
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error;
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to create room'
    })
  }
})