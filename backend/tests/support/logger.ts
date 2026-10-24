import { Writable } from 'node:stream';
import { pino, type Logger } from 'pino';

/** A real pino logger that keeps each JSON line for assertions. */
export function captureLogger(): { logger: Logger; lines: () => string[] } {
  const chunks: string[] = [];
  const stream = new Writable({
    write(chunk: Buffer | string, _encoding, callback) {
      chunks.push(chunk.toString());
      callback();
    },
  });
  const logger = pino({ level: 'info' }, stream);
  return {
    logger,
    lines: () => chunks,
  };
}
