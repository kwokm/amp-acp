import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export interface PersistedSession {
  threadId: string;
  mode: string;
  model: string;
  cwd: string;
}

const MAX_SESSIONS = 200;

function stateDir(): string {
  if (process.env.AMP_ACP_STATE_DIR) {
    return process.env.AMP_ACP_STATE_DIR;
  }
  if (process.platform === 'win32' && process.env.LOCALAPPDATA) {
    return path.join(process.env.LOCALAPPDATA, 'amp-acp');
  }
  if (process.env.XDG_STATE_HOME) {
    return path.join(process.env.XDG_STATE_HOME, 'amp-acp');
  }
  return path.join(os.homedir(), '.local', 'state', 'amp-acp');
}

function storePath(): string {
  return path.join(stateDir(), 'sessions.json');
}

type StoreShape = Record<string, PersistedSession>;

function readStore(): StoreShape {
  try {
    const parsed = JSON.parse(fs.readFileSync(storePath(), 'utf8'));
    return parsed && typeof parsed === 'object' ? (parsed as StoreShape) : {};
  } catch {
    return {};
  }
}

/**
 * Persist the ACP sessionId -> Amp thread mapping so `session/load` can
 * reattach to the thread after the amp-acp process restarts.
 */
export function rememberSession(sessionId: string, data: PersistedSession): void {
  try {
    const store = readStore();
    // Re-insert so the entry moves to the end (most recently used).
    delete store[sessionId];
    store[sessionId] = data;
    const keys = Object.keys(store);
    if (keys.length > MAX_SESSIONS) {
      for (const key of keys.slice(0, keys.length - MAX_SESSIONS)) {
        delete store[key];
      }
    }
    fs.mkdirSync(stateDir(), { recursive: true });
    fs.writeFileSync(storePath(), JSON.stringify(store, null, 2));
  } catch (e) {
    console.error('[acp] failed to persist session mapping', e);
  }
}

export function recallSession(sessionId: string): PersistedSession | null {
  return readStore()[sessionId] ?? null;
}
