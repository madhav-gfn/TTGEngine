import { describe, expect, it } from "vitest";
import aptitudeBlitz from "../../../../Games/aptitude-blitz/config.json";
import mazeRunner from "../../../../Games/maze-runner-v2/config.json";
import sortSprint from "../../../../Games/sort-sprint-v2/config.json";
import sudoku from "../../../../Games/sudoku/config.json";
import wordBuilder from "../../../../Games/word-builder/config.json";
import { validateGameConfig } from "./validate";

describe("shared config validation and normalization", () => {
  it("accepts existing v1 game configs without migration", () => {
    [sudoku, wordBuilder, aptitudeBlitz].forEach((config) => {
      const result = validateGameConfig(config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.schemaVersion).toBe(1);
        expect(result.data.interactionMode).toBe("legacy");
      }
    });
  });

  it("accepts new v2 showcase configs and normalizes them into command mode", () => {
    [mazeRunner, sortSprint].forEach((config) => {
      const result = validateGameConfig(config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.schemaVersion).toBe(2);
        expect(result.data.interactionMode).toBe("command");
      }
    });
  });
});
