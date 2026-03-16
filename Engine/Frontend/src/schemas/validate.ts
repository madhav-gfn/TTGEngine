import { validateAndNormalizeGameConfig } from "@contracts/index";
import type { GameConfig, ValidationResult } from "@/core/types";

export function validateGameConfig(raw: unknown): ValidationResult<GameConfig> {
  return validateAndNormalizeGameConfig(raw);
}
