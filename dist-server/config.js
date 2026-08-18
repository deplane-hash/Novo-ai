import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
const NOVA_DIR = path.join(os.homedir(), '.nova');
const CONFIG_FILE = path.join(NOVA_DIR, 'config.json');
const DEFAULTS = {
    providers: {},
    activeProvider: 'openrouter',
    activeModel: '',
    theme: 'dark',
    maxTokens: 2048,
    temperature: 0.7,
    workspace: os.homedir(),
    planMode: false,
    autoApprove: false,
    onboarded: false
};
function ensureDir() {
    if (!fs.existsSync(NOVA_DIR))
        fs.mkdirSync(NOVA_DIR, { recursive: true });
}
export function loadConfig() {
    try {
        ensureDir();
        if (fs.existsSync(CONFIG_FILE)) {
            const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
            const parsed = JSON.parse(raw);
            return { ...DEFAULTS, ...parsed, providers: { ...parsed.providers } };
        }
    }
    catch (err) {
        console.error('[config] failed to load, using defaults:', err);
    }
    return structuredClone(DEFAULTS);
}
export function saveConfig(config) {
    ensureDir();
    const tmp = CONFIG_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(config, null, 2), 'utf-8');
    fs.renameSync(tmp, CONFIG_FILE);
}
export function getApiKey(providerId) {
    const config = loadConfig();
    return config.providers[providerId]?.apiKey?.trim() ?? '';
}
export function setApiKey(providerId, key, baseUrl) {
    const config = loadConfig();
    if (!config.providers[providerId])
        config.providers[providerId] = { apiKey: '' };
    config.providers[providerId].apiKey = key.trim();
    if (baseUrl !== undefined) {
        config.providers[providerId].baseUrl = baseUrl.trim();
        if (!config.providers[providerId].baseUrl)
            delete config.providers[providerId].baseUrl;
    }
    saveConfig(config);
}
export function maskKey(key) {
    if (!key)
        return '';
    if (key.length <= 8)
        return '*'.repeat(key.length);
    return `${key.slice(0, 4)}…${'•'.repeat(6)}${key.slice(-4)}`;
}
