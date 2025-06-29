#!/usr/bin/env node

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { resolve } from 'path'

console.log('🔧 Building worker with Nuxt app and Durable Objects...')

// Check if Nuxt build exists
const nuxtOutput = '.output/server/index.mjs'
if (!existsSync(nuxtOutput)) {
  console.error('❌ Nuxt build not found. Run "npm run build" first.')
  process.exit(1)
}

try {
  // Read the worker template
  const workerTemplate = readFileSync('worker.ts', 'utf-8')
  
  // Replace the placeholder with the actual Nuxt handler import
  const workerContent = workerTemplate.replace(
    'export default {\n  fetch: () => new Response(\'Build the Nuxt app first\', { status: 503 })\n}',
    'export { default } from \'./.output/server/index.mjs\''
  )
  
  // Write the final worker file
  writeFileSync('worker.js', 
    workerContent
      .replace(/import.*from '\.\/server\/lib\/PokerRoom'/g, 
               "import { PokerRoom } from './server/lib/PokerRoom.ts'")
      .replace(/\.ts'$/gm, ".ts'")
  )
  
  console.log('✅ Worker built successfully!')
  console.log('   - Durable Objects: PokerRoom')
  console.log('   - Nuxt App: Integrated')
  console.log('   - Ready for: wrangler deploy')
  
} catch (error) {
  console.error('❌ Failed to build worker:', error.message)
  process.exit(1)
}
