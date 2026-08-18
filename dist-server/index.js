import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import fg from 'fast-glob';
import { loadConfig, saveConfig, setApiKey, maskKey, getApiKey } from './config.js';
import { PROVIDERS, getProvider, getActiveProviders, getDefaultBaseUrl, estimateTokens, estimateCost } from './providers/types.js';
import { initModelsDev } from './providers/modelsdev.js';
import { runAgent } from './agent.js';
import { respondToApproval, rejectAllForChat } from './approvals.js';
import { resolveSafe } from './tools/registry.js';
import { listSessions, getSession, saveSession, deleteSession, safeId, titleFrom } from './sessions.js';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || '127.0.0.1';
const app = express();
app.use(express.json({ limit: '5mb' }));
function publicConfig() {
    const config = loadConfig();
    return {
        providers: Object.fromEntries(getActiveProviders().map((p) => {
            const stored = config.providers[p.id];
            const key = stored?.apiKey ?? '';
            const baseUrl = stored?.baseUrl ?? getDefaultBaseUrl(p.id);
            return [
                p.id,
                {
                    id: p.id,
                    configured: Boolean(key),
                    keyMasked: maskKey(key),
                    baseUrl
                }
            ];
        })),
        activeProvider: config.activeProvider,
        activeModel: config.activeModel,
        theme: config.theme,
        maxTokens: config.maxTokens,
        temperature: config.temperature,
        workspace: config.workspace,
        planMode: config.planMode,
        autoApprove: config.autoApprove,
        onboarded: config.onboarded
    };
}
app.get('/api/health', (_req, res) => {
    res.json({ ok: true, name: 'nova', time: Date.now() });
});
app.get('/api/providers', (_req, res) => {
    res.json({ providers: getActiveProviders(), state: publicConfig() });
});
app.post('/api/config', (req, res) => {
    const body = req.body ?? {};
    let config = loadConfig();
    if (body.providerId && typeof body.apiKey === 'string') {
        const p = getProvider(body.providerId);
        if (!p)
            return res.status(400).json({ error: 'Unknown provider' });
        if (p.needsKey && body.apiKey.startsWith('••')) {
            return res.status(400).json({ error: 'Key already saved — enter a new key to replace it' });
        }
        setApiKey(body.providerId, body.apiKey, typeof body.baseUrl === 'string' ? body.baseUrl : undefined);
        config = loadConfig();
    }
    if (body.activeProvider && getProvider(body.activeProvider))
        config.activeProvider = body.activeProvider;
    if (body.activeModel)
        config.activeModel = body.activeModel;
    if (body.theme)
        config.theme = body.theme;
    if (typeof body.maxTokens === 'number')
        config.maxTokens = Math.min(8192, Math.max(256, body.maxTokens));
    if (typeof body.temperature === 'number')
        config.temperature = Math.min(2, Math.max(0, body.temperature));
    if (typeof body.workspace === 'string' && body.workspace.trim()) {
        try {
            const p = fs.realpathSync(body.workspace.trim());
            if (fs.statSync(p).isDirectory())
                config.workspace = p;
        }
        catch { /* keep old workspace */ }
    }
    if (typeof body.planMode === 'boolean')
        config.planMode = body.planMode;
    if (typeof body.autoApprove === 'boolean')
        config.autoApprove = body.autoApprove;
    if (typeof body.onboarded === 'boolean')
        config.onboarded = body.onboarded;
    saveConfig(config);
    res.json({ ok: true, state: publicConfig() });
});
app.post('/api/keys/validate', async (req, res) => {
    const { providerId } = req.body ?? {};
    const p = getProvider(providerId);
    if (!p)
        return res.status(400).json({ error: 'Unknown provider' });
    const config = loadConfig();
    const key = config.providers[p.id]?.apiKey ?? getApiKey(p.id);
    if (!p.needsKey)
        return res.json({ ok: true, note: 'Local provider — no key required' });
    try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 8000);
        const baseUrl = (config.providers[p.id]?.baseUrl || getDefaultBaseUrl(p.id)).replace(/\/$/, '');
        const fmt = p.format ?? 'openai';
        const res_ = await fetch(fmt === 'anthropic' ? `${baseUrl}/v1/messages` : `${baseUrl}/models`, {
            headers: fmt === 'anthropic'
                ? { 'x-api-key': key, 'anthropic-version': '2023-06-01' }
                : fmt === 'gemini'
                    ? { 'x-goog-api-key': key }
                    : { Authorization: `Bearer ${key}` },
            signal: ctrl.signal
        });
        clearTimeout(timer);
        if (res_.ok)
            return res.json({ ok: true });
        let detail = `${res_.status}`;
        try {
            const j = (await res_.json());
            detail = j?.error?.message ?? j?.error?.code ?? detail;
        }
        catch { /* noop */ }
        res.status(402).json({ ok: false, error: `Key check failed (${detail})` });
    }
    catch {
        res.status(402).json({ ok: false, error: 'Could not reach provider' });
    }
});
app.get('/api/sessions', (_req, res) => {
    res.json({ sessions: listSessions() });
});
app.get('/api/sessions/:id', (req, res) => {
    const s = getSession(req.params.id);
    if (!s)
        return res.status(404).json({ error: 'Not found' });
    res.json({ session: s });
});
app.post('/api/sessions', (req, res) => {
    const body = req.body ?? {};
    const session = {
        id: safeId(),
        title: titleFrom(body.title || 'New conversation'),
        providerId: body.providerId ?? 'openrouter',
        model: body.model ?? '',
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now()
    };
    saveSession(session);
    res.json({ session });
});
app.delete('/api/sessions/:id', (req, res) => {
    deleteSession(req.params.id);
    res.json({ ok: true });
});
app.get('/api/models', async (req, res) => {
    const providerId = String(req.query.provider ?? '');
    const p = getProvider(providerId);
    if (!p)
        return res.status(400).json({ error: 'Unknown provider' });
    if (providerId === 'ollama' || providerId === 'lmstudio') {
        const config = loadConfig();
        const baseUrl = config.providers[providerId]?.baseUrl || getDefaultBaseUrl(providerId);
        try {
            const r = await fetch(`${baseUrl.replace(/\/$/, '')}/v1/models`, { signal: AbortSignal.timeout(4000) });
            if (r.ok) {
                const j = (await r.json());
                const models = (j.data ?? []).map((m) => m.id ?? '').filter(Boolean).sort();
                if (models.length)
                    return res.json({ dynamic: true, models });
            }
        }
        catch {
            /* fall through to static list */
        }
        return res.json({ dynamic: false, models: p.models });
    }
    res.json({ dynamic: false, models: p.models });
});
app.post('/api/tools/respond', (req, res) => {
    const { id, decision } = req.body ?? {};
    if (typeof id !== 'string' || !['allow', 'deny', 'allow_always'].includes(decision)) {
        return res.status(400).json({ error: 'Invalid request' });
    }
    if (!respondToApproval(id, decision)) {
        return res.status(404).json({ error: 'Approval no longer pending' });
    }
    res.json({ ok: true });
});
app.get('/api/fs/list', (req, res) => {
    const config = loadConfig();
    const dir = String(req.query.path ?? '.');
    try {
        const root = resolveSafe({ workspace: config.workspace }, dir);
        const entries = fs.readdirSync(root, { withFileTypes: true });
        const nodes = entries
            .filter((e) => !e.name.startsWith('.'))
            .map((e) => ({
            name: e.name,
            path: e.isDirectory() ? `${dir === '.' ? '' : dir}/${e.name}` : `${dir === '.' ? '' : dir}/${e.name}`,
            type: e.isDirectory() ? 'directory' : 'file'
        }))
            .sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'directory' ? -1 : 1));
        res.json({ path: dir, root: config.workspace, nodes });
    }
    catch (err) {
        res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
    }
});
app.get('/api/fs/read', (req, res) => {
    const config = loadConfig();
    const file = String(req.query.path ?? '');
    try {
        const p = resolveSafe({ workspace: config.workspace }, file);
        const size = fs.statSync(p).size;
        if (size > 1_500_000)
            return res.status(413).json({ error: 'File too large to preview' });
        res.json({ path: file, content: fs.readFileSync(p, 'utf-8') });
    }
    catch (err) {
        res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
    }
});
app.get('/api/todos', async (_req, res) => {
    const config = loadConfig();
    try {
        const files = await fg('**/*.{ts,tsx,js,jsx,py,go,rs,java,kt,swift,c,cpp,h,hpp,cs,rb,php,sh,vue,svelte,css,html,md}', {
            cwd: config.workspace,
            ignore: [
                '**/node_modules/**', '**/dist/**', '**/build/**', '**/out/**',
                '**/.git/**', '**/.nova/**', '**/.next/**', '**/.cache/**',
                '**/__pycache__/**', '**/.venv/**', '**/venv/**', '**/target/**'
            ],
            onlyFiles: true,
            unique: true
        });
        const todos = [];
        const re = /(?:\/\/|#|<!--|\*|;|--)\s*(TODO|FIXME|HACK|XXX|BUG|NOTE)\s*[:：\-]?\s*(.*)$/i;
        for (const file of files.slice(0, 400)) {
            const abs = path.join(config.workspace, file);
            try {
                const stat = fs.statSync(abs);
                if (stat.size > 1_000_000)
                    continue;
                const lines = fs.readFileSync(abs, 'utf-8').split('\n');
                for (let i = 0; i < lines.length; i++) {
                    const m = lines[i].match(re);
                    if (m) {
                        todos.push({ file, line: i + 1, tag: m[1].toUpperCase(), text: (m[2] || '').trim().slice(0, 200) });
                    }
                }
            }
            catch {
                /* skip unreadable files */
            }
        }
        todos.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
        res.json({ todos: todos.slice(0, 500) });
    }
    catch (err) {
        res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
    }
});
app.post('/api/chat', async (req, res) => {
    const body = req.body ?? {};
    const providerId = body.providerId ?? loadConfig().activeProvider;
    const model = body.model ?? loadConfig().activeModel;
    const rawMessages = body.messages ?? [];
    const config = loadConfig();
    const provider = getProvider(providerId);
    if (!provider) {
        res.status(400).json({ error: `Unknown provider: ${providerId}` });
        return;
    }
    if (provider.needsKey && !getApiKey(providerId)) {
        res.status(400).json({ error: `No API key set for ${provider.name}. Add one in Settings.` });
        return;
    }
    const messages = rawMessages
        .filter((m) => typeof m.content === 'string')
        .map((m) => ({ role: m.role, content: m.content }));
    const stream = new AbortController();
    const chatId = safeId();
    req.on('close', () => {
        if (!res.headersSent || req.aborted) {
            stream.abort();
            rejectAllForChat(chatId);
        }
    });
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
    const send = (event, data) => {
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };
    send('meta', { providerId, model });
    const started = Date.now();
    let usage;
    let cost = 0;
    let errorSent = false;
    const steps = [];
    const stepsById = new Map();
    const ensureStep = (s) => {
        if (!stepsById.has(s.id)) {
            stepsById.set(s.id, s);
            steps.push(s);
        }
        return s;
    };
    try {
        const result = await runAgent({
            providerId,
            model,
            messages,
            workspace: config.workspace,
            chatId,
            sessionId: typeof body.sessionId === 'string' ? body.sessionId : '',
            planMode: config.planMode,
            autoApprove: config.autoApprove,
            signal: stream.signal
        }, {
            onDelta(text) {
                send('chunk', { text });
            },
            onUsage(u) {
                usage = u;
                if (!u.totalTokens)
                    u.totalTokens = u.inputTokens + u.outputTokens;
            },
            onToolCall({ id, name, summary, needApproval }) {
                ensureStep({ id, name, summary, status: needApproval ? 'awaiting' : 'running', needApproval });
                send('tool_call', { id, name, summary, needApproval });
            },
            onToolApproved(id) {
                const s = stepsById.get(id);
                if (s)
                    s.status = 'running';
                send('tool_approved', { id });
            },
            onToolResult(id, ok, output, error) {
                const s = stepsById.get(id);
                if (s) {
                    s.status = ok ? 'done' : error ? 'error' : 'denied';
                    s.output = output.slice(0, 4000);
                }
                send('tool_result', { id, ok, output: output.slice(0, 4000) });
            },
            onPreview(p) {
                send('preview', { path: p });
            },
            onError(msg) {
                errorSent = true;
                send('error', { message: msg });
            }
        });
        cost = usage ? estimateCost(model, usage) : 0;
        const sid = typeof body.sessionId === 'string' && body.sessionId ? body.sessionId : safeId();
        const existing = getSession(sid);
        const title = existing && existing.title !== 'New conversation'
            ? existing.title
            : titleFrom(rawMessages[0]?.content ?? 'New conversation');
        send('done', {
            usage: usage ?? {
                inputTokens: estimateTokens(rawMessages.map((m) => m.content).join('')),
                outputTokens: estimateTokens(result.fullText),
                totalTokens: 0,
                estimated: true
            },
            cost,
            durationMs: Date.now() - started,
            sessionId: sid,
            title
        });
        const fresh = {
            id: sid,
            title,
            providerId,
            model,
            messages: [],
            createdAt: Date.now(),
            updatedAt: Date.now()
        };
        const session = getSession(sid) ?? fresh;
        session.providerId = providerId;
        session.model = model;
        if (!session.title || session.title === 'New conversation' || session.messages.length === 0) {
            session.title = title;
        }
        session.messages.push({
            id: safeId(),
            role: 'user',
            content: rawMessages[rawMessages.length - 1]?.content ?? '',
            createdAt: Date.now()
        });
        if (result.fullText || steps.length) {
            session.messages.push({
                id: safeId(),
                role: 'assistant',
                content: result.fullText || (steps.length ? '' : ''),
                providerId,
                model,
                usage,
                cost,
                steps: steps.length ? steps : undefined,
                createdAt: Date.now()
            });
        }
        saveSession(session);
        send('saved', { sessionId: sid, title: session.title });
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (!errorSent && msg !== 'Stream aborted')
            send('error', { message: msg });
    }
    finally {
        res.end();
    }
});
const dist = path.resolve(__dirname, '..', 'dist');
const WEB_ASSET = /\.(html?|css|js|mjs|cjs|json|txt|map|png|jpe?g|gif|svg|webp|ico|avif|woff2?|ttf|otf|mp3|mp4|webm|ogg|wasm|pdf)$/i;
app.get('/api/preview/meta', (req, res) => {
    const root = loadConfig().workspace;
    const rel = String(req.query.path ?? '');
    const target = path.resolve(root, rel);
    if (target !== root && !target.startsWith(root + path.sep)) {
        res.status(400).json({ error: 'Outside workspace' });
        return;
    }
    if (!WEB_ASSET.test(target)) {
        res.status(403).json({ error: 'Not a web asset' });
        return;
    }
    try {
        const st = fs.statSync(target);
        res.json({ ok: true, meta: { mtime: st.mtimeMs, size: st.size } });
    }
    catch {
        res.json({ ok: true, meta: null });
    }
});
app.use('/preview', (req, res, next) => {
    const root = loadConfig().workspace;
    if (!WEB_ASSET.test(req.path)) {
        res.status(403).json({ error: 'Only web assets can be previewed' });
        return;
    }
    express.static(root, { index: false, dotfiles: 'deny' })(req, res, next);
});
if (fs.existsSync(dist)) {
    app.use(express.static(dist));
    app.get(/^\/(?!api).*/, (_req, res) => {
        res.sendFile(path.join(dist, 'index.html'));
    });
}
app.listen(PORT, HOST, () => {
    console.log(`\n  ⚡ Nova running →  http://${HOST}:${PORT}\n`);
});
initModelsDev(PROVIDERS).catch(() => { });
