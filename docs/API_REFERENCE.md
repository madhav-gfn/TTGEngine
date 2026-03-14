# API Reference

## Health

- `GET /api/health`

## Game Manifest

- `GET /api/games`
- `GET /api/games/:gameId`

## Leaderboard

- `POST /api/score`
- `GET /api/leaderboard/:gameId?limit=20&offset=0&period=all&difficulty=all`

Ranking order is:

1. Highest score
2. Lowest time taken
3. Earliest submission
