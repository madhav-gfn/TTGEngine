import {
  getBoardGoal,
  getBoardStart,
  getBoardTaskPositions,
  type BoardLevelConfig,
  type CommandAdapter,
  type DragDropLevelConfig,
  type InteractionSession,
} from "@/core/types";

export interface BoardSession extends InteractionSession {
  row: number;
  col: number;
  collectedTaskIds: string[];
  completed: boolean;
}

export interface BoardAdapterContext {
  level: BoardLevelConfig;
  basePoints: number;
}

function isWalkable(level: BoardLevelConfig, row: number, col: number): boolean {
  if (row < 0 || col < 0 || row >= level.board.length || col >= level.board[0].length) {
    return false;
  }

  return level.board[row][col] !== "#";
}

export const boardCommandAdapter: CommandAdapter<BoardSession, BoardAdapterContext> = {
  createSession: ({ level }) => {
    const start = getBoardStart(level);
    return {
      row: start.row,
      col: start.col,
      collectedTaskIds: [],
      completed: false,
      focusZone: "board",
      focusIndex: 0,
      heldItemId: null,
    };
  },
  handleCommand: (session, command, context) => {
    if (command.type !== "move") {
      return { session, handled: false };
    }

    const delta = {
      up: { row: -1, col: 0 },
      down: { row: 1, col: 0 },
      left: { row: 0, col: -1 },
      right: { row: 0, col: 1 },
    }[command.direction];

    const nextRow = session.row + delta.row;
    const nextCol = session.col + delta.col;

    if (!isWalkable(context.level, nextRow, nextCol)) {
      return {
        session,
        handled: true,
        announcement: "Blocked path",
      };
    }

    const tasks = getBoardTaskPositions(context.level);
    const nextTask = tasks.find((task) => task.row === nextRow && task.col === nextCol);
    const goal = getBoardGoal(context.level);
    const collectedTaskIds = nextTask && !session.collectedTaskIds.includes(nextTask.id)
      ? [...session.collectedTaskIds, nextTask.id]
      : session.collectedTaskIds;
    const completed = nextRow === goal.row && nextCol === goal.col && collectedTaskIds.length === tasks.length;

    return {
      session: {
        ...session,
        row: nextRow,
        col: nextCol,
        collectedTaskIds,
        completed,
      },
      handled: true,
      announcement: nextTask && !session.collectedTaskIds.includes(nextTask.id) ? `Collected ${nextTask.label}` : undefined,
      action: nextTask && !session.collectedTaskIds.includes(nextTask.id)
        ? {
          type: "correct",
          points: context.basePoints,
          metadata: { taskId: nextTask.id },
        }
        : undefined,
      completion: completed
        ? {
          completed: true,
          metadata: {
            collectedTaskIds,
          },
        }
        : undefined,
    };
  },
};

export interface DragDropSession extends InteractionSession {
  focusZone: "items" | "targets";
  focusIndex: number;
  targetIndex: number;
  heldItemId: string | null;
  mapping: Record<string, string>;
}

export interface DragDropAdapterContext {
  level: DragDropLevelConfig;
}

function canDropItem(session: DragDropSession, level: DragDropLevelConfig, itemId: string, targetId: string): boolean {
  const target = level.targets.find((entry) => entry.id === targetId);
  if (!target) {
    return false;
  }

  if (target.acceptsMultiple) {
    return true;
  }

  return !Object.entries(session.mapping).some(([mappedItemId, mappedTargetId]) =>
    mappedItemId !== itemId && mappedTargetId === targetId
  );
}

export const dragDropCommandAdapter: CommandAdapter<DragDropSession, DragDropAdapterContext> = {
  createSession: () => ({
    focusZone: "items",
    focusIndex: 0,
    targetIndex: 0,
    heldItemId: null,
    mapping: {},
  }),
  handleCommand: (session, command, context) => {
    if (command.type === "move") {
      if (command.direction === "left" || command.direction === "right") {
        return {
          session: {
            ...session,
            focusZone: session.focusZone === "items" ? "targets" : "items",
          },
          handled: true,
        };
      }

      if (session.focusZone === "items") {
        const delta = command.direction === "up" ? -1 : 1;
        return {
          session: {
            ...session,
            focusIndex: Math.max(0, Math.min(context.level.items.length - 1, session.focusIndex + delta)),
          },
          handled: true,
        };
      }

      const delta = command.direction === "up" ? -1 : 1;
      return {
        session: {
          ...session,
          targetIndex: Math.max(0, Math.min(context.level.targets.length - 1, session.targetIndex + delta)),
        },
        handled: true,
      };
    }

    if (command.type === "focus") {
      if (session.focusZone === "items") {
        const step = command.direction === "previous" ? -1 : 1;
        return {
          session: {
            ...session,
            focusIndex: Math.max(0, Math.min(context.level.items.length - 1, session.focusIndex + step)),
          },
          handled: true,
        };
      }

      const step = command.direction === "previous" ? -1 : 1;
      return {
        session: {
          ...session,
          targetIndex: Math.max(0, Math.min(context.level.targets.length - 1, session.targetIndex + step)),
        },
        handled: true,
      };
    }

    if ((command.type === "pickup" || command.type === "select") && session.focusZone === "items") {
      return {
        session: {
          ...session,
          heldItemId: context.level.items[session.focusIndex]?.id ?? null,
        },
        handled: true,
      };
    }

    if ((command.type === "drop" || command.type === "select") && session.focusZone === "targets" && session.heldItemId) {
      const targetId = context.level.targets[session.targetIndex]?.id;
      if (!targetId || !canDropItem(session, context.level, session.heldItemId, targetId)) {
        return {
          session,
          handled: true,
          announcement: "Target already occupied",
        };
      }

      return {
        session: {
          ...session,
          heldItemId: null,
          mapping: {
            ...session.mapping,
            [session.heldItemId]: targetId,
          },
        },
        handled: true,
      };
    }

    return { session, handled: false };
  },
};

export function evaluateDragDropMapping(
  session: DragDropSession,
  level: DragDropLevelConfig,
): {
  correctActions: number;
  wrongActions: number;
  totalActions: number;
} {
  let correctActions = 0;
  let wrongActions = 0;

  level.items.forEach((item) => {
    if (session.mapping[item.id] === level.correctMapping[item.id]) {
      correctActions += 1;
    } else {
      wrongActions += 1;
    }
  });

  return {
    correctActions,
    wrongActions,
    totalActions: level.items.length,
  };
}
