# Planning Poker

A modern, real-time Planning Poker application built with Nuxt.js 4 and Cloudflare Durable Objects.

## Features

- 🚀 **Real-time collaboration** via WebSocket connections
- 🏠 **Persistent rooms** using Cloudflare Durable Objects  
- 📱 **Mobile-responsive** design with Tailwind CSS
- 🔒 **Secure room access** with URL-based sharing
- 🎯 **Simple voting** with standard poker cards (1, 2, 3, 5, 8, 13, 21, ?, ☕️)
- 👀 **Vote revealing** and **round reset** functionality
- 🔄 **Auto-reconnection** handling

## Quick Start

1. **Install dependencies:**
   ```bash
   pnpm install
   ```

2. **Start development servers:**
   ```bash
   # Terminal 1: Start WebSocket worker
   pnpm dev:websockets
   
   # Terminal 2: Start Nuxt app  
   pnpm dev
   ```

3. **Open the app:**
   Visit http://localhost:3000

## Architecture

- **Frontend**: Nuxt.js 4 with Vue 3 and Tailwind CSS
- **Backend**: Cloudflare Durable Objects for persistent room state
- **Real-time**: WebSocket connections for live updates
- **Deployment**: Cloudflare Pages + Workers

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment instructions.

## Usage

1. **Create a room**: Enter a room name on the home page
2. **Join the room**: Share the room URL with your team
3. **Enter your name**: Each participant enters their name to join
4. **Vote**: Select your estimate from the poker cards
5. **Reveal**: Once everyone has voted, reveal all votes
6. **Reset**: Start a new round of voting

## Tech Stack

- [Nuxt.js 4](https://nuxt.com/) - Full-stack Vue framework
- [Vue 3](https://vuejs.org/) - Progressive JavaScript framework  
- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS framework
- [Cloudflare Durable Objects](https://developers.cloudflare.com/durable-objects/) - Stateful serverless objects
- [Cloudflare Workers](https://workers.cloudflare.com/) - Serverless WebSocket handling
- [@vueuse/core](https://vueuse.org/) - Vue composition utilities

## Development

The app uses a modern development setup:

- **Hot reload** for both frontend and WebSocket worker
- **TypeScript** for type safety
- **ESLint + Prettier** for code formatting
- **Composition API** with `<script setup>` syntax

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test locally with both dev servers running
5. Submit a pull request

## License

MIT License - see [LICENSE](./LICENSE) for details.

# pnpm
pnpm dev

# yarn
yarn dev

# bun
bun run dev
```

## Production

Build the application for production:

```bash
# npm
npm run build

# pnpm
pnpm build

# yarn
yarn build

# bun
bun run build
```

Locally preview production build:

```bash
# npm
npm run preview

# pnpm
pnpm preview

# yarn
yarn preview

# bun
bun run preview
```

Check out the [deployment documentation](https://nuxt.com/docs/getting-started/deployment) for more information.
