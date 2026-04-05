import {
  type BoardEnemy,
  getBoardCheckpointPositions,
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
  activatedCheckpointIds: string[];
  completed: boolean;
  enemies: Array<BoardEnemy & { directionStep: -1 | 1 }>;
  moveCount: number;
  collisions: number;
  respawnRow: number;
  respawnCol: number;
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

function isEnemyWalkable(level: BoardLevelConfig, row: number, col: number): boolean {
  return isWalkable(level, row, col) && level.board[row]?.[col] !== "G" && level.board[row]?.[col] !== "S";
}

function getEnemyAxisPosition(enemy: BoardEnemy): number {
  return enemy.movement === "horizontal" ? enemy.col : enemy.row;
}

function setEnemyAxisPosition(enemy: BoardEnemy, value: number): BoardEnemy {
  return enemy.movement === "horizontal"
    ? { ...enemy, col: value }
    : { ...enemy, row: value };
}

function moveEnemy(
  enemy: BoardEnemy & { directionStep: -1 | 1 },
  level: BoardLevelConfig,
): BoardEnemy & { directionStep: -1 | 1 } {
  const currentAxis = getEnemyAxisPosition(enemy);
  let nextDirection = enemy.directionStep;
  let nextAxis = currentAxis + nextDirection;

  if (nextAxis < enemy.min || nextAxis > enemy.max) {
    nextDirection = nextDirection === 1 ? -1 : 1;
    nextAxis = currentAxis + nextDirection;
  }

  const candidate = setEnemyAxisPosition(enemy, nextAxis);
  if (!isEnemyWalkable(level, candidate.row, candidate.col)) {
    const reversedDirection = nextDirection === 1 ? -1 : 1;
    const reversedAxis = currentAxis + reversedDirection;
    const reversedCandidate = setEnemyAxisPosition(enemy, reversedAxis);
    if (
      reversedAxis < enemy.min ||
      reversedAxis > enemy.max ||
      !isEnemyWalkable(level, reversedCandidate.row, reversedCandidate.col)
    ) {
      return {
        ...enemy,
        directionStep: reversedDirection,
      };
    }

    return {
      ...reversedCandidate,
      directionStep: reversedDirection,
    };
  }

  return {
    ...candidate,
    directionStep: nextDirection,
  };
}

export const boardCommandAdapter: CommandAdapter<BoardSession, BoardAdapterContext> = {
  createSession: ({ level }) => {
    const start = getBoardStart(level);
    return {
      row: start.row,
      col: start.col,
      collectedTaskIds: [],
      activatedCheckpointIds: [],
      completed: false,
      enemies: (level.enemies ?? []).map((enemy) => ({
        ...enemy,
        directionStep: (enemy.direction === "reverse" ? -1 : 1) as -1 | 1,
      })),
      moveCount: 0,
      collisions: 0,
      respawnRow: start.row,
      respawnCol: start.col,
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
    const checkpoints = getBoardCheckpointPositions(context.level);
    const requiredCheckpointIds = checkpoints
      .filter((checkpoint) => checkpoint.required !== false)
      .map((checkpoint) => checkpoint.id);
    const collidedBeforeEnemyMove = session.enemies.some((enemy) => enemy.row === nextRow && enemy.col === nextCol);
    const nextTask = tasks.find((task) => task.row === nextRow && task.col === nextCol);
    const nextCheckpoint = checkpoints.find((checkpoint) => checkpoint.row === nextRow && checkpoint.col === nextCol);
    const goal = getBoardGoal(context.level);
    const collectedTaskIds = nextTask && !session.collectedTaskIds.includes(nextTask.id)
      ? [...session.collectedTaskIds, nextTask.id]
      : session.collectedTaskIds;
    const activatedCheckpointIds = nextCheckpoint && !session.activatedCheckpointIds.includes(nextCheckpoint.id)
      ? [...session.activatedCheckpointIds, nextCheckpoint.id]
      : session.activatedCheckpointIds;
    const moveCount = session.moveCount + 1;
    const enemies = session.enemies.map((enemy) => (
      moveCount % (enemy.speed ?? 1) === 0 ? moveEnemy(enemy, context.level) : enemy
    ));
    const collidedAfterEnemyMove = enemies.some((enemy) => enemy.row === nextRow && enemy.col === nextCol);
    const collided = collidedBeforeEnemyMove || collidedAfterEnemyMove;
    const respawnRow = nextCheckpoint && !session.activatedCheckpointIds.includes(nextCheckpoint.id)
      ? nextRow
      : session.respawnRow;
    const respawnCol = nextCheckpoint && !session.activatedCheckpointIds.includes(nextCheckpoint.id)
      ? nextCol
      : session.respawnCol;
    const completed =
      !collided &&
      nextRow === goal.row &&
      nextCol === goal.col &&
      collectedTaskIds.length === tasks.length &&
      requiredCheckpointIds.every((checkpointId) => activatedCheckpointIds.includes(checkpointId));

    const reachedNewTask = Boolean(nextTask && !session.collectedTaskIds.includes(nextTask.id));
    const reachedNewCheckpoint = Boolean(nextCheckpoint && !session.activatedCheckpointIds.includes(nextCheckpoint.id));

    return {
      session: {
        ...session,
        row: collided ? session.respawnRow : nextRow,
        col: collided ? session.respawnCol : nextCol,
        collectedTaskIds,
        activatedCheckpointIds,
        completed,
        enemies,
        moveCount,
        collisions: collided ? session.collisions + 1 : session.collisions,
        respawnRow,
        respawnCol,
      },
      handled: true,
      announcement: collided
        ? "Enemy caught you. Returning to the latest checkpoint."
        : reachedNewCheckpoint
          ? `Checkpoint reached: ${nextCheckpoint?.label ?? "Checkpoint"}`
          : reachedNewTask
          ? `Collected ${nextTask?.label ?? "task"}`
          : undefined,
      action: collided
        ? {
          type: "wrong",
          points: 0,
          metadata: { reason: "enemy_collision" },
        }
        : reachedNewCheckpoint
          ? {
            type: "correct",
            points: context.basePoints,
            metadata: { checkpointId: nextCheckpoint?.id },
          }
          : reachedNewTask
          ? {
            type: "correct",
            points: context.basePoints,
            metadata: { taskId: nextTask?.id ?? "task" },
          }
          : undefined,
      completion: completed
        ? {
          completed: true,
          metadata: {
            collectedTaskIds,
            activatedCheckpointIds,
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
