# TaPTaP JSON-Driven Engine

This repository contains a JSON-driven game engine with:

- `Engine/Frontend`: React + TypeScript engine runtime and UI shell
- `Engine/Backend`: Express + SQLite leaderboard and game-config API
- `Games`: runtime-loaded JSON game definitions

Core engine logic lives inside `Engine`, and game content lives inside `Games`. Swapping JSON files changes gameplay without changing engine code.

## Run

1. Install dependencies from the repo root with `npm install`
2. Start backend with `npm run dev:backend`
3. Start frontend with `npm run dev:frontend`

The frontend loads available games from the backend at runtime, validates configs, and runs the full engine lifecycle.

## Deployment

This repo is set up for:

- `Vercel`: frontend static app
- `Render`: backend API + SQLite leaderboard

### Vercel

Deploy the repo root. `vercel.json` already builds `Engine/Frontend` and publishes `Engine/Frontend/dist`.

Set this environment variable in Vercel:

- `VITE_API_BASE_URL=https://your-render-backend.onrender.com`

You can copy the value from `Engine/Frontend/.env.example`.

### Render

Deploy the repo root with the included `render.yaml`. The backend service uses:

- `PORT`
- `CORS_ORIGIN`
- `DATABASE_PATH`
- `GAMES_ROOT`

Set `CORS_ORIGIN` to your Vercel app URL, for example `https://your-frontend.vercel.app`.

`DATABASE_PATH` is configured for Render persistent disk storage at `/var/data/leaderboard.db`, so leaderboard data survives restarts.

`GAMES_ROOT` points to `../../Games` because the backend runs from the `Engine/Backend` workspace at runtime.

You can copy the defaults from `Engine/Backend/.env.example`.
