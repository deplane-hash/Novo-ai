import { randomUUID } from 'node:crypto';
const pendings = new Map();
const sessionAllow = new Map();
export function requestApproval(chatId) {
    const id = randomUUID();
    const decision = new Promise((resolve, reject) => {
        pendings.set(id, {
            chatId,
            settled: false,
            resolve: (d) => {
                pendings.delete(id);
                resolve(d);
            },
            reject: (err) => {
                pendings.delete(id);
                reject(err);
            }
        });
    });
    return { id, decision };
}
export function respondToApproval(id, decision) {
    const p = pendings.get(id);
    if (!p || p.settled)
        return false;
    p.settled = true;
    p.resolve(decision);
    return true;
}
export function rejectAllForChat(chatId) {
    for (const [id, p] of pendings) {
        if (p.chatId === chatId) {
            p.settled = true;
            p.reject(new Error('Request aborted'));
        }
    }
}
export function isAllowed(sessionId, toolName) {
    return sessionAllow.get(sessionId)?.has(toolName) ?? false;
}
export function rememberAllowed(sessionId, toolName) {
    if (!sessionAllow.has(sessionId))
        sessionAllow.set(sessionId, new Set());
    sessionAllow.get(sessionId).add(toolName);
}
