import { eventBus } from "./EventBus";
import type { TimerConfig, TimerTick, TimerWarning } from "./types";
import { TimerType } from "./types";

export class TimerEngine {
  private config: TimerConfig | null = null;
  private startedAt = 0;
  private pausedAt = 0;
  private elapsedBeforePause = 0;
  private animationFrameId: number | null = null;
  private frame = 0;
  private warningsFired = new Set<number>();
  private activeLevel = 1;

  start(config: TimerConfig, level = 1): void {
    this.reset();
    this.config = config;
    this.activeLevel = level;
    this.startedAt = performance.now();
    this.loop();
  }

  pause(): void {
    if (!this.isRunning()) {
      return;
    }

    this.pausedAt = performance.now();
    this.elapsedBeforePause += this.pausedAt - this.startedAt;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  resume(): void {
    if (!this.config || this.isRunning()) {
      return;
    }

    this.startedAt = performance.now();
    this.loop();
  }

  reset(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }
    this.config = null;
    this.startedAt = 0;
    this.pausedAt = 0;
    this.elapsedBeforePause = 0;
    this.animationFrameId = null;
    this.frame = 0;
    this.warningsFired.clear();
  }

  getElapsed(): number {
    if (!this.config) {
      return 0;
    }

    if (this.isRunning()) {
      return this.elapsedBeforePause + (performance.now() - this.startedAt);
    }

    return this.elapsedBeforePause;
  }

  getRemaining(): number {
    if (!this.config || this.config.type === TimerType.COUNTUP) {
      return 0;
    }

    return Math.max(0, this.config.duration * 1000 - this.getElapsed());
  }

  onTick(callback: (tick: TimerTick) => void): () => void {
    return eventBus.on("timer:tick", callback);
  }

  onWarning(callback: (warning: TimerWarning) => void): () => void {
    return eventBus.on("timer:warning", callback);
  }

  onExpire(callback: () => void): () => void {
    return eventBus.on("timer:expired", () => callback());
  }

  private isRunning(): boolean {
    return this.animationFrameId !== null;
  }

  private loop = (): void => {
    if (!this.config) {
      return;
    }

    this.frame += 1;
    const elapsed = this.getElapsed();
    const total = this.config.duration * 1000;
    const remaining =
      this.config.type === TimerType.COUNTDOWN ? Math.max(0, total - elapsed) : 0;
    const remainingSeconds = Math.ceil(remaining / 1000);
    const isWarning = this.config.warningAt.some((threshold) => remainingSeconds <= threshold);

    this.config.warningAt.forEach((threshold) => {
      if (remainingSeconds <= threshold && !this.warningsFired.has(threshold)) {
        this.warningsFired.add(threshold);
        eventBus.emit("timer:warning", { threshold, remaining });
      }
    });

    eventBus.emit("timer:tick", {
      elapsed,
      remaining,
      isWarning,
      progress:
        this.config.type === TimerType.COUNTDOWN
          ? 1 - remaining / total
          : elapsed / Math.max(total, elapsed || 1),
      frame: this.frame,
    });

    if (this.config.type === TimerType.COUNTDOWN && remaining <= 0) {
      this.animationFrameId = null;
      eventBus.emit("timer:expired", { level: this.activeLevel });
      return;
    }

    this.animationFrameId = requestAnimationFrame(this.loop);
  };
}

export const timerEngine = new TimerEngine();
