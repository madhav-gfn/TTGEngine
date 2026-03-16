import { describe, expect, it } from "vitest";
import { CommandEngine } from "./CommandEngine";
import {
  boardCommandAdapter,
  dragDropCommandAdapter,
  evaluateDragDropMapping,
} from "./adapters";

describe("boardCommandAdapter", () => {
  it("collects tasks and completes once the goal is reached", () => {
    const engine = new CommandEngine(boardCommandAdapter);
    let session = engine.createSession({
      level: {
        levelNumber: 1,
        board: ["STG"],
      },
      basePoints: 10,
    });

    let outcome = engine.dispatch(session, { type: "move", direction: "right" }, {
      level: {
        levelNumber: 1,
        board: ["STG"],
      },
      basePoints: 10,
    });
    session = outcome.session;

    expect(outcome.action?.type).toBe("correct");
    expect(session.collectedTaskIds).toHaveLength(1);

    outcome = engine.dispatch(session, { type: "move", direction: "right" }, {
      level: {
        levelNumber: 1,
        board: ["STG"],
      },
      basePoints: 10,
    });

    expect(outcome.completion?.completed).toBe(true);
  });
});

describe("dragDropCommandAdapter", () => {
  it("prevents multiple assignments on single-accept targets", () => {
    const engine = new CommandEngine(dragDropCommandAdapter);
    let session = engine.createSession({
      level: {
        levelNumber: 1,
        items: [
          { id: "a", label: "A" },
          { id: "b", label: "B" },
        ],
        targets: [
          { id: "single", label: "Single", acceptsMultiple: false },
          { id: "multi", label: "Multi", acceptsMultiple: true },
        ],
        correctMapping: {
          a: "single",
          b: "multi",
        },
      },
    });

    session = engine.dispatch(session, { type: "pickup" }, {
      level: {
        levelNumber: 1,
        items: [
          { id: "a", label: "A" },
          { id: "b", label: "B" },
        ],
        targets: [
          { id: "single", label: "Single", acceptsMultiple: false },
          { id: "multi", label: "Multi", acceptsMultiple: true },
        ],
        correctMapping: {
          a: "single",
          b: "multi",
        },
      },
    }).session;

    session = {
      ...session,
      focusZone: "targets",
      targetIndex: 0,
    };

    session = engine.dispatch(session, { type: "drop" }, {
      level: {
        levelNumber: 1,
        items: [
          { id: "a", label: "A" },
          { id: "b", label: "B" },
        ],
        targets: [
          { id: "single", label: "Single", acceptsMultiple: false },
          { id: "multi", label: "Multi", acceptsMultiple: true },
        ],
        correctMapping: {
          a: "single",
          b: "multi",
        },
      },
    }).session;

    session = {
      ...session,
      focusZone: "items",
      focusIndex: 1,
    };

    session = engine.dispatch(session, { type: "pickup" }, {
      level: {
        levelNumber: 1,
        items: [
          { id: "a", label: "A" },
          { id: "b", label: "B" },
        ],
        targets: [
          { id: "single", label: "Single", acceptsMultiple: false },
          { id: "multi", label: "Multi", acceptsMultiple: true },
        ],
        correctMapping: {
          a: "single",
          b: "multi",
        },
      },
    }).session;

    const blockedDrop = engine.dispatch({
      ...session,
      focusZone: "targets",
      targetIndex: 0,
    }, { type: "drop" }, {
      level: {
        levelNumber: 1,
        items: [
          { id: "a", label: "A" },
          { id: "b", label: "B" },
        ],
        targets: [
          { id: "single", label: "Single", acceptsMultiple: false },
          { id: "multi", label: "Multi", acceptsMultiple: true },
        ],
        correctMapping: {
          a: "single",
          b: "multi",
        },
      },
    });

    expect(blockedDrop.announcement).toBe("Target already occupied");
    expect(evaluateDragDropMapping(blockedDrop.session, {
      levelNumber: 1,
      items: [
        { id: "a", label: "A" },
        { id: "b", label: "B" },
      ],
      targets: [
        { id: "single", label: "Single", acceptsMultiple: false },
        { id: "multi", label: "Multi", acceptsMultiple: true },
      ],
      correctMapping: {
        a: "single",
        b: "multi",
      },
    }).correctActions).toBe(1);
  });
});
