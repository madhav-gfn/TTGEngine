import {
  type BoardEnemy,
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
  enemies: Array<BoardEnemy & { directionStep: -1 | 1 }>;
  moveCount: number;
  collisions: number;
  facing: "left" | "right";
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

function isPlatformer(level: BoardLevelConfig): boolean {
  return level.movementStyle === "platformer";
}

function canOccupy(level: BoardLevelConfig, row: number, col: number): boolean {
  return isWalkable(level, row, col);
}

function applyGravity(level: BoardLevelConfig, row: number, col: number): { row: number; col: number } {
  let nextRow = row;
  while (nextRow + 1 < level.board.length && canOccupy(level, nextRow + 1, col)) {
    nextRow += 1;
  }
  return { row: nextRow, col };
}

function movePlatformerHorizontal(
  session: BoardSession,
  level: BoardLevelConfig,
  direction: "left" | "right",
): { row: number; col: number } | null {
  const deltaCol = direction === "left" ? -1 : 1;
  const nextCol = session.col + deltaCol;
  if (!canOccupy(level, session.row, nextCol)) {
    return null;
  }

  return applyGravity(level, session.row, nextCol);
}

function dropPlatformer(session: BoardSession, level: BoardLevelConfig): { row: number; col: number } | null {
  const nextRow = session.row + 1;
  if (!canOccupy(level, nextRow, session.col)) {
    return null;
  }

  return applyGravity(level, nextRow, session.col);
}

function jumpPlatformer(session: BoardSession, level: BoardLevelConfig): { row: number; col: number } | null {
  let row = session.row;
  let col = session.col;
  let moved = false;
  const jumpHeight = level.jumpHeight ?? 2;
  const jumpDistance = level.jumpDistance ?? 2;
  const directionStep = session.facing === "left" ? -1 : 1;

  for (let step = 0; step < jumpHeight; step += 1) {
    if (!canOccupy(level, row - 1, col)) {
      break;
    }
    row -= 1;
    moved = true;
  }

  for (let step = 0; step < jumpDistance; step += 1) {
    if (!canOccupy(level, row, col + directionStep)) {
      break;
    }
    col += directionStep;
    moved = true;
  }

  if (!moved) {
    return null;
  }

  return applyGravity(level, row, col);
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
    const startPosition = isPlatformer(level) ? applyGravity(level, start.row, start.col) : start;
    return {
      row: startPosition.row,
      col: startPosition.col,
      collectedTaskIds: [],
      completed: false,
      enemies: (level.enemies ?? []).map((enemy) => ({
        ...enemy,
        directionStep: (enemy.direction === "reverse" ? -1 : 1) as -1 | 1,
      })),
      moveCount: 0,
      collisions: 0,
      focusZone: "board",
      focusIndex: 0,
      heldItemId: null,
      facing: "right",
    };
  },
  handleCommand: (session, command, context) => {
    if (command.type !== "move") {
      return { session, handled: false };
    }

    const platformer = isPlatformer(context.level);
    let movement:
      | { row: number; col: number; announcement?: string; facing?: "left" | "right" }
      | null
      = null;

    if (platformer) {
      if (command.direction === "up") {
        const jumped = jumpPlatformer(session, context.level);
        movement = jumped ? { ...jumped, announcement: "Jumped forward" } : null;
      }
      if (command.direction === "down") {
        const dropped = dropPlatformer(session, context.level);
        movement = dropped ? { ...dropped, announcement: "Dropped down" } : null;
      }
      if (command.direction === "left" || command.direction === "right") {
        const shifted = movePlatformerHorizontal(session, context.level, command.direction);
        movement = shifted ? { ...shifted, facing: command.direction } : null;
      }
    } else {
      const delta = {
        up: { row: -1, col: 0 },
        down: { row: 1, col: 0 },
        left: { row: 0, col: -1 },
        right: { row: 0, col: 1 },
      }[command.direction];

      const nextRow = session.row + delta.row;
      const nextCol = session.col + delta.col;
      if (isWalkable(context.level, nextRow, nextCol)) {
        movement = {
          row: nextRow,
          col: nextCol,
          facing: command.direction === "left" || command.direction === "right" ? command.direction : session.facing,
        };
      }
    }

    if (!movement) {
      return {
        session,
        handled: true,
        announcement: platformer && command.direction === "up" ? "Jump blocked" : "Blocked path",
      };
    }

    const tasks = getBoardTaskPositions(context.level);
    const collidedBeforeEnemyMove = session.enemies.some((enemy) => enemy.row === movement.row && enemy.col === movement.col);
    const nextTask = tasks.find((task) => task.row === movement.row && task.col === movement.col);
    const goal = getBoardGoal(context.level);
    const shouldAutoCollect = nextTask && !nextTask.challenge;
    const collectedTaskIds = nextTask && !session.collectedTaskIds.includes(nextTask.id) && shouldAutoCollect
      ? [...session.collectedTaskIds, nextTask.id]
      : session.collectedTaskIds;
    const moveCount = session.moveCount + 1;
    const enemies = session.enemies.map((enemy) => (
      moveCount % (enemy.speed ?? 1) === 0 ? moveEnemy(enemy, context.level) : enemy
    ));
    const collidedAfterEnemyMove = enemies.some((enemy) => enemy.row === movement.row && enemy.col === movement.col);
    const collided = collidedBeforeEnemyMove || collidedAfterEnemyMove;
    const start = getBoardStart(context.level);
    const respawn = platformer ? applyGravity(context.level, start.row, start.col) : start;
    const completed =
      !collided &&
      movement.row === goal.row &&
      movement.col === goal.col &&
      collectedTaskIds.length === tasks.length;

    return {
      session: {
        ...session,
        row: collided ? respawn.row : movement.row,
        col: collided ? respawn.col : movement.col,
        collectedTaskIds,
        completed,
        enemies,
        moveCount,
        collisions: collided ? session.collisions + 1 : session.collisions,
        facing: movement.facing ?? session.facing,
      },
      handled: true,
      announcement: collided
        ? "Enemy caught you. Returning to start."
        : nextTask?.challenge && !session.collectedTaskIds.includes(nextTask.id)
          ? `Challenge unlocked: ${nextTask.label}`
          : nextTask && !session.collectedTaskIds.includes(nextTask.id)
          ? `Collected ${nextTask.label}`
          : movement.announcement,
      action: collided
        ? {
          type: "wrong",
          points: 0,
          metadata: { reason: "enemy_collision" },
        }
        : nextTask && !session.collectedTaskIds.includes(nextTask.id) && shouldAutoCollect
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
