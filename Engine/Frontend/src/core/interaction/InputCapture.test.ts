import { describe, expect, it } from "vitest";
import { getCommandFromKeyboardEvent } from "./InputCapture";

function keyEvent(key: string, extra: Partial<KeyboardEvent> = {}): KeyboardEvent {
  return {
    key,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    target: null,
    ...extra,
  } as KeyboardEvent;
}

describe("getCommandFromKeyboardEvent", () => {
  it("maps arrow keys and honors explicit movement keybindings", () => {
    expect(getCommandFromKeyboardEvent(keyEvent("ArrowUp"))?.type).toBe("move");
    expect(getCommandFromKeyboardEvent(keyEvent("a"), {
      inputMode: "keyboard",
      autoFocus: true,
      keybindings: {
        moveLeft: ["a"],
      },
    })).toEqual({
      type: "move",
      direction: "left",
    });
  });

  it("maps plain character input and backspace", () => {
    expect(getCommandFromKeyboardEvent(keyEvent("R"))).toEqual({
      type: "type",
      value: "R",
    });
    expect(getCommandFromKeyboardEvent(keyEvent("Backspace"))).toEqual({
      type: "backspace",
    });
  });
});
