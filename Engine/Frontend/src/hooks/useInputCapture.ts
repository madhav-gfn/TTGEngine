import { useEffect, useRef } from "react";
import type { InteractionCommand, InteractionConfig } from "@/core/types";
import { getCommandFromKeyboardEvent } from "@/core/interaction/InputCapture";

export function useInputCapture(
  enabled: boolean,
  interactionConfig: InteractionConfig,
  onCommand: (command: InteractionCommand) => void,
) {
  const containerRef = useRef<HTMLElement | null>(null);
  const onCommandRef = useRef(onCommand);

  useEffect(() => {
    onCommandRef.current = onCommand;
  }, [onCommand]);

  useEffect(() => {
    const node = containerRef.current;
    if (!node || !enabled) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      const command = getCommandFromKeyboardEvent(event, interactionConfig);
      if (!command) {
        return;
      }

      event.preventDefault();
      onCommandRef.current(command);
    };

    node.addEventListener("keydown", handleKeyDown);

    if (interactionConfig.autoFocus) {
      requestAnimationFrame(() => {
        node.focus();
      });
    }

    return () => {
      node.removeEventListener("keydown", handleKeyDown);
    };
  }, [enabled, interactionConfig]);

  return containerRef;
}
