● Planning Poker App - Current State Summary

Overview

A planning poker application built with Nuxt.js, designed to run on Cloudflare Workers with WebSocket support via a separate websockets worker. The app
allows users to join rooms, vote on story points, and see results in real-time.

Architecture

- Main Worker: Nuxt.js app deployed to planning-poker.tombaker.workers.dev
- WebSocket Worker: Separate worker at planning-poker-websockets.tombaker.workers.dev
- Service Binding: Main worker connects to websockets worker via WEBSOCKET_SERVICE binding
- State Management: Uses Cloudflare Durable Objects for room state synchronization

Current Status

✅ Working: App loads, room creation API works, users can join rooms❌ Broken: WebSocket connections not establishing properly - real-time features
non-functional

Key Files and Configuration

wrangler.jsonc

{
"name": "planning-poker",
"main": "./.output/server/index.mjs",
"compatibility_date": "2025-05-07",
"compatibility_flags": ["nodejs_compat"],
"services": [
{ "binding": "WEBSOCKET_SERVICE", "service": "planning-poker-websockets" }
],
"migrations": [
{ "tag": "v1", "deleted_classes": ["PokerRoom"] }
]
}

nuxt.config.ts - WebSocket URL Configuration

runtimeConfig: {
public: {
websocketUrl: process.env.NUXT_PUBLIC_WEBSOCKET_URL || (
process.env.NODE_ENV === 'production' || process.env.CF_PAGES
? "wss://planning-poker-websockets.tombaker.workers.dev"
: "ws://localhost:8787"
),
},
},
nitro: {
preset: "cloudflare_module",
cloudflare: { deployConfig: false },
},

composables/usePokerRoom.ts - WebSocket Client Logic

Uses @vueuse/core WebSocket with message-based authentication:
const { send, open, close, status } = useWebSocket(websocketUrl, {
onConnected: () => {
if (currentUser.value) {
send(JSON.stringify({
type: 'auth',
roomId: roomId,
userId: userId
}))
}
},
// ... error handling
})

server/api/room/create.post.ts - Room Creation API

import { nanoid } from 'nanoid'
export default defineEventHandler(async (event) => {
try {
const roomId = nanoid(10)
return { roomId }
} catch (error) {
console.error('Error creating room:', error)
throw createError({
statusCode: 500,
statusMessage: 'Failed to create room'
})
}
})

websockets/index.ts - WebSocket Worker

Handles WebSocket connections with message-based authentication:
interface AuthMessage {
type: "auth";
roomId: string;
userId: string;
}

// Accepts connections without upfront auth, handles auth via first message
if (parsed.type === 'auth') {
ws.serializeAttachment({
room: parsed.roomId,
userId: parsed.userId,
});
this.ctx.acceptWebSocket(ws, [parsed.roomId, parsed.userId]);
return;
}

Debugging Added

Recent debugging logs added to usePokerRoom.ts:
console.log('WebSocket URL:', websocketUrl)
console.log('Runtime config:', runtimeConfig.public)
console.log('Environment check:', {
NODE_ENV: process.env.NODE_ENV,
isClient: process.client,
isProduction: runtimeConfig.public.websocketUrl?.includes('wss')
})

Known Issues

Primary Issue: WebSocket Connection Failure

- Symptom: "The websocket doesn't seem to be connecting properly"
- Status: User can join rooms but real-time features don't work
- Last Action: Deployed debugging version to analyze connection logs

Previous Issues (Resolved)

1. ✅ Empty worker.ts causing deployment failures - Removed file
2. ✅ 404 on room creation - Added missing API endpoint
3. ✅ WebSocket protocol errors - Switched to message-based auth
4. ✅ Template reference errors - Fixed wsState → status references

Cloudflare Account Details

- Account: tombaker.me (active account set)
- Main Worker: planning-poker
- WebSocket Worker: planning-poker-websockets
- Service Binding: Configured and working

Next Steps for New Session

1. Check browser console logs for WebSocket URL and connection details from debugging
2. Analyze Cloudflare observability logs for websockets worker to see if connections are reaching it
3. Verify WebSocket URL resolution - ensure production environment correctly uses WSS URL
4. Test WebSocket worker directly if needed to isolate connection issues
5. Consider alternative WebSocket connection approaches if current method continues failing

Deployment Commands

- Build: npm run build
- Deploy: npx wrangler deploy
- URLs:
  - Main app: https://planning-poker.tombaker.workers.dev
  - WebSocket worker: wss://planning-poker-websockets.tombaker.workers.dev

User Quote

Last reported: "The websocket doesn't seem to be connecting properly" (after successfully joining rooms)
