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

## Admin Dashboard

The frontend now includes an Admin Dashboard view for:

- Creating new JSON games
- Updating and deleting existing games
- Reviewing per-game stats (submissions, players, high score)
- Previewing leaderboard entries for each game

Use the header toggle button in the app to switch between player mode and admin mode.

Admin API endpoints live under `/api/admin/*` and can be protected with an optional backend key.

- Backend env: `ADMIN_API_KEY`
- Frontend env (to send the header): `VITE_ADMIN_KEY`

If no `ADMIN_API_KEY` is configured, admin routes stay open for local development.

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
- `ADMIN_API_KEY` (optional)

Set `CORS_ORIGIN` to your Vercel app URL, for example `https://your-frontend.vercel.app`.

`DATABASE_PATH` is configured for Render persistent disk storage at `/var/data/leaderboard.db`, so leaderboard data survives restarts.

`GAMES_ROOT` points to `../../Games` because the backend runs from the `Engine/Backend` workspace at runtime.

You can copy the defaults from `Engine/Backend/.env.example`.
