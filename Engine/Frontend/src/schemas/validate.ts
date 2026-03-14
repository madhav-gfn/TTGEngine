import type { GameConfig, ValidationResult } from "@/core/types";
import { GameConfigSchema } from "./masterSchema";

export function validateGameConfig(raw: unknown): ValidationResult<GameConfig> {
  const result = GameConfigSchema.safeParse(raw);

  if (result.success) {
    return {
      success: true,
      data: result.data as GameConfig,
    };
  }

  return {
    success: false,
    errors: result.error.issues.map((issue) => ({
      path: issue.path.join("."),
      code: issue.code,
      message: issue.message,
      received: "received" in issue ? (issue as { received?: unknown }).received : undefined,
    })),
  };
}
