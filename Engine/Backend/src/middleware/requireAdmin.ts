import type { Request, Response, NextFunction } from "express";
import { runtimeConfig } from "../lib/runtimeConfig.js";

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!runtimeConfig.adminKey) {
    next();
    return;
  }

  const providedKey = req.header("x-admin-key")?.trim();
  if (providedKey && providedKey === runtimeConfig.adminKey) {
    next();
    return;
  }

  res.status(401).json({
    success: false,
    error: {
      code: "UNAUTHORIZED",
      message: "Valid admin credentials are required.",
    },
  });
}
