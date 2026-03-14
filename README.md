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
