import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
const SESSIONS_DIR = path.join(os.homedir(), '.nova', 'sessions');
function ensureDir() {
    if (!fs.existsSync(SESSIONS_DIR))
        fs.mkdirSync(SESSIONS_DIR, { recursive: true });
}
function fileFor(id) {
    return path.join(SESSIONS_DIR, `${id}.json`);
}
export function safeId() {
    return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}
export function listSessions() {
    ensureDir();
    const sessions = [];
    for (const f of fs.readdirSync(SESSIONS_DIR)) {
        if (!f.endsWith('.json'))
            continue;
        try {
            const s = JSON.parse(fs.readFileSync(path.join(SESSIONS_DIR, f), 'utf-8'));
            sessions.push(s);
        }
        catch {
            /* skip corrupt */
        }
    }
    return sessions.sort((a, b) => b.updatedAt - a.updatedAt);
}
export function getSession(id) {
    try {
        if (fs.existsSync(fileFor(id))) {
            return JSON.parse(fs.readFileSync(fileFor(id), 'utf-8'));
        }
    }
    catch {
        /* noop */
    }
    return null;
}
export function saveSession(session) {
    ensureDir();
    session.updatedAt = Date.now();
    const tmp = fileFor(session.id) + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(session, null, 2), 'utf-8');
    fs.renameSync(tmp, fileFor(session.id));
}
export function deleteSession(id) {
    try {
        fs.unlinkSync(fileFor(id));
    }
    catch {
        /* noop */
    }
}
export function titleFrom(text) {
    const clean = text.replace(/\s+/g, ' ').trim();
    if (clean.length <= 60)
        return clean || 'New conversation';
    return clean.slice(0, 57).trimEnd() + '…';
}
