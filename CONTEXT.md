Project Context: Planning Poker Application
This document provides a persistent context brief for the AI assistant about the Planning Poker application project.

1. Project Overview
   This is a real-time, web-based planning poker application designed for agile development teams. The goal is to allow geographically distributed team members to vote on story points and see updates instantly.

2. Core Architecture & Technology Stack
   The application is built on a modern, serverless stack leveraging Cloudflare's ecosystem.

Framework: Nuxt 3 using Vue 3.

Deployment Target: Cloudflare Workers (direct worker deployment, not Cloudflare Pages).

Real-time Communication: Cloudflare Durable Objects. Each poker room will be managed by its own Durable Object instance, which handles WebSocket connections and state synchronization between participants.

Database: Cloudflare D1 will be used to persist room information.

Styling: Tailwind CSS.

3. Key Features
   Real-time Rooms: Users can create poker rooms that are accessible via a unique, shareable, and difficult-to-guess URL (/room/[id]).

Live Updates: All actions within a room (a user joining, a user voting, votes being revealed) are broadcast to all participants in real-time using WebSockets.

Optional Authentication: Users can optionally authenticate with their Google account for identification purposes.

Anonymous Users: Users who do not authenticate will be assigned a randomly generated guest name (e.g., "Guest-12345").

4. Development Conventions & Environment
   Node.js Version: v22 (LTS). A .nvmrc file should be used to enforce this.

Package Manager: pnpm.

Code Style:

All code is written in TypeScript.

Vue components use the Composition API with the <script setup> syntax.

Styling is done exclusively with Tailwind CSS utility classes.

5. Deployment
   Host: The application is deployed as a Cloudflare Worker, accessible at https://planning-poker.tombaker.workers.dev/.

CI/CD: Automatic deployments are configured through the Cloudflare dashboard's GitHub integration, triggering on pushes to the main branch.

Configuration:

nuxt.config.ts uses the nitro: { preset: "cloudflare_module" } option.

wrangler.toml is present in the root to configure the worker's name and compatibility date for deployments.
