import cors from "cors";
import express from "express";
import { gamesRouter } from "./routes/games.js";
import { leaderboardRouter } from "./routes/leaderboard.js";
import { scoreRouter } from "./routes/score.js";

const app = express();
const port = Number(process.env.PORT ?? 8787);

app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ success: true, data: { status: "ok" } });
});

app.use("/api/games", gamesRouter);
app.use("/api/leaderboard", leaderboardRouter);
app.use("/api/score", scoreRouter);

app.use((error: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(error);
  res.status(500).json({
    success: false,
    error: {
      code: "INTERNAL_ERROR",
      message: error.message,
    },
  });
});

app.listen(port, () => {
  console.log(`TaPTaP backend listening on http://localhost:${port}`);
});
