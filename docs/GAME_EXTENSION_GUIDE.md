# Game Extension Guide

To add a new game without changing engine code:

1. Create `Games/<game-name>/config.json`.
2. Ensure the JSON matches the engine schema.
3. Start the backend so the manifest can discover the new config.
4. Reload the frontend and the game will appear in the selector.

If the game fits an existing renderer type (`GRID`, `WORD`, `MCQ`, `DRAG_DROP`), no frontend engine code changes are required.
