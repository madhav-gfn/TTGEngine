import cors from "cors";
import express from "express";
import { adminRouter } from "./routes/admin.js";
import { runtimeConfig } from "./lib/runtimeConfig.js";
import { analyticsRouter } from "./routes/analytics.js";
import { gamesRouter } from "./routes/games.js";
import { leaderboardRouter } from "./routes/leaderboard.js";
import { scoreRouter } from "./routes/score.js";

const app = express();
const port = runtimeConfig.port;

app.set("trust proxy", 1);

const corsOptions: cors.CorsOptions = {
  origin(origin, callback) {
    if (!origin || runtimeConfig.allowedOrigins.length === 0) {
      callback(null, true);
      return;
    }

    callback(null, runtimeConfig.allowedOrigins.includes(origin));
  },
};

app.use(cors(corsOptions));
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ success: true, data: { status: "ok" } });
});

app.use("/api/games", gamesRouter);
app.use("/api/leaderboard", leaderboardRouter);
app.use("/api/score", scoreRouter);
app.use("/api/analytics", analyticsRouter);
app.use("/api/admin", adminRouter);

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
  console.log(`TaPTaP backend listening on port ${port}`);
  console.log(`Games root: ${runtimeConfig.gamesRoot}`);
  console.log(`Database path: ${runtimeConfig.databasePath}`);
});
