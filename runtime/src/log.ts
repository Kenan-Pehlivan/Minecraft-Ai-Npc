import { pino } from 'pino';

export const log = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  transport: process.env.LOG_PRETTY === '1' ? { target: 'pino-pretty' } : undefined,
});

export type Logger = typeof log;
