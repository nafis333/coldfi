# ColdFi

Zero-knowledge encrypted personal & group finance tracking app.

## Architecture

```
packages/
├── shared/       # Types, validation, calculation engines
├── backend/      # Fastify API server (Postgres + Redis)
└── web/          # React + Vite + Tailwind SPA
```

## Quick Start

```bash
npm install
# Start Postgres & Redis, then:
npm run dev
```

## Key Features

- **Zero-knowledge encryption**: AES-256-GCM, PBKDF2-SHA-512, PEK held as CryptoKey in memory
- **Personal finance**: Expenses, budgets, recurring bills, analytics, CSV import/export
- **Group finance**: Shared expenses, auto-settlements, activity log with integrity verification
- **Real-time**: WebSocket (Socket.IO), push notifications, multi-tab sync via BroadcastChannel
- **Admin panel**: 9-page dashboard (owner role-gated), monitoring, alert engine, audit log

## Docs

See `docs/` for architecture, plans, and reference materials. Start with `docs/MUST-READ/MASTER.md`.

## Tech Stack

- **Runtime**: Node 20, TypeScript 5
- **Backend**: Fastify 4, Postgres 15, Redis 7
- **Frontend**: React 18, Vite 5, Tailwind 3, Zustand, Recharts
- **Infra**: Docker Compose, Nginx, GHCR
