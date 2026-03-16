import type { CommandAdapter, CommandOutcome, InteractionCommand, InteractionSession } from "@/core/types";

export class CommandEngine<TSession extends InteractionSession, TContext> {
  constructor(private readonly adapter: CommandAdapter<TSession, TContext>) {}

  createSession(context: TContext): TSession {
    return this.adapter.createSession(context);
  }

  dispatch(
    session: TSession,
    command: InteractionCommand,
    context: TContext,
  ): CommandOutcome<TSession> {
    const outcome = this.adapter.handleCommand(session, command, context);

    return {
      ...outcome,
      session: {
        ...outcome.session,
        lastCommand: command.type,
      },
    };
  }
}
