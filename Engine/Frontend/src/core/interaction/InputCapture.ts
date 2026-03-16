import type { BindingAction, InteractionCommand, InteractionConfig } from "@/core/types";

const DEFAULT_KEYBINDINGS: Record<BindingAction, string[]> = {
  moveUp: ["ArrowUp"],
  moveDown: ["ArrowDown"],
  moveLeft: ["ArrowLeft"],
  moveRight: ["ArrowRight"],
  focusNext: ["Tab"],
  focusPrevious: ["Shift+Tab"],
  select: ["Enter", " "],
  submit: ["Enter"],
  pickup: [],
  drop: [],
  hint: [],
  pause: ["Escape"],
  backspace: ["Backspace"],
};

function matchesBinding(binding: string, event: KeyboardEvent): boolean {
  if (binding === "Shift+Tab") {
    return event.key === "Tab" && event.shiftKey;
  }

  return event.key === binding;
}

function findAction(event: KeyboardEvent, interactionConfig?: InteractionConfig): BindingAction | null {
  const mergedBindings = {
    ...DEFAULT_KEYBINDINGS,
    ...(interactionConfig?.keybindings ?? {}),
  };

  const match = (Object.entries(mergedBindings) as Array<[BindingAction, string[]]>).find(([, bindings]) =>
    bindings.some((binding) => matchesBinding(binding, event)),
  );

  return match?.[0] ?? null;
}

export function shouldIgnoreKeyboardTarget(target: EventTarget | null): boolean {
  if (typeof HTMLElement === "undefined") {
    return false;
  }

  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return Boolean(target.closest("input, textarea, select, [contenteditable='true']"));
}

export function getCommandFromKeyboardEvent(
  event: KeyboardEvent,
  interactionConfig?: InteractionConfig,
): InteractionCommand | null {
  if (shouldIgnoreKeyboardTarget(event.target)) {
    return null;
  }

  const action = findAction(event, interactionConfig);
  if (action === "moveUp") {
    return { type: "move", direction: "up" };
  }
  if (action === "moveDown") {
    return { type: "move", direction: "down" };
  }
  if (action === "moveLeft") {
    return { type: "move", direction: "left" };
  }
  if (action === "moveRight") {
    return { type: "move", direction: "right" };
  }
  if (action === "focusNext") {
    return { type: "focus", direction: event.shiftKey ? "previous" : "next" };
  }
  if (action === "focusPrevious") {
    return { type: "focus", direction: "previous" };
  }
  if (action === "select") {
    return { type: "select" };
  }
  if (action === "submit") {
    return { type: "submit" };
  }
  if (action === "pickup") {
    return { type: "pickup" };
  }
  if (action === "drop") {
    return { type: "drop" };
  }
  if (action === "hint") {
    return { type: "hint" };
  }
  if (action === "pause") {
    return { type: "pause" };
  }
  if (action === "backspace") {
    return { type: "backspace" };
  }

  if (!event.ctrlKey && !event.metaKey && !event.altKey && event.key.length === 1) {
    return { type: "type", value: event.key };
  }

  return null;
}
