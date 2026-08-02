import { appendFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultDir = path.resolve(__dirname, '../../data');

/**
 * Minimal journey observability (drop-off / re-ask) as JSONL.
 * Best-effort; never throws to callers.
 *
 * @param {Record<string, unknown>} event
 */
export async function appendJourneyEvent(event) {
  try {
    const dir = process.env.SERVER_STORAGE_DIR
      ? path.resolve(process.env.SERVER_STORAGE_DIR)
      : defaultDir;
    await mkdir(dir, { recursive: true });
    const line = `${JSON.stringify({ ...event, at: event.at ?? new Date().toISOString() })}\n`;
    await appendFile(path.join(dir, 'journey-events.jsonl'), line, 'utf8');
  } catch {
    // best-effort only
  }
}
