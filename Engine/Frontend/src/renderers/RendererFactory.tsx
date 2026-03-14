import type { GameRendererProps } from "@/core/types";
import { gameRegistry } from "@/core/GameRegistry";

export function RendererFactory(props: GameRendererProps) {
  const Renderer = gameRegistry.getRendererForType(props.config.gameType);
  return <Renderer {...props} />;
}
