import { useEffect, useRef } from "react";
import { DEFAULT_INTERACTION_CONFIG, type InteractionCommand, type InteractionConfig } from "@/core/types";
import { getCommandFromKeyboardEvent } from "@/core/interaction/InputCapture";

export function useInputCapture(
  enabled: boolean,
  interactionConfig: InteractionConfig | undefined,
  onCommand: (command: InteractionCommand) => void,
) {
  const containerRef = useRef<HTMLElement | null>(null);
  const onCommandRef = useRef(onCommand);
  const safeInteractionConfig = interactionConfig ?? DEFAULT_INTERACTION_CONFIG;

  useEffect(() => {
    onCommandRef.current = onCommand;
  }, [onCommand]);

  useEffect(() => {
    const node = containerRef.current;
    if (!node || !enabled) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      const command = getCommandFromKeyboardEvent(event, safeInteractionConfig);
      if (!command) {
        return;
      }

      event.preventDefault();
      onCommandRef.current(command);
    };

    node.addEventListener("keydown", handleKeyDown);

    if (safeInteractionConfig.autoFocus) {
      requestAnimationFrame(() => {
        node.focus();
      });
    }

    return () => {
      node.removeEventListener("keydown", handleKeyDown);
    };
  }, [enabled, safeInteractionConfig]);

  return containerRef;
}
