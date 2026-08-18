export let MODELS = {
    /* OpenAI */
    'gpt-5': { inputPerM: 1.25, outputPerM: 10 },
    'gpt-5-mini': { inputPerM: 0.25, outputPerM: 2 },
    'gpt-5-nano': { inputPerM: 0.05, outputPerM: 0.4 },
    'gpt-5-codex': { inputPerM: 1.25, outputPerM: 10 },
    'gpt-4o': { inputPerM: 2.5, outputPerM: 10 },
    'gpt-4o-mini': { inputPerM: 0.15, outputPerM: 0.6 },
    'gpt-4.1': { inputPerM: 2, outputPerM: 8 },
    'gpt-4.1-mini': { inputPerM: 0.4, outputPerM: 1.6 },
    'gpt-4.1-nano': { inputPerM: 0.1, outputPerM: 0.4 },
    'o3': { inputPerM: 2, outputPerM: 8 },
    'o3-mini': { inputPerM: 1.1, outputPerM: 4.4 },
    'o4-mini': { inputPerM: 1.1, outputPerM: 4.4 },
    'gpt-4.5-preview': { inputPerM: 75, outputPerM: 150 },
    'gpt-4-turbo': { inputPerM: 10, outputPerM: 30 },
    'gpt-4': { inputPerM: 30, outputPerM: 60 },
    /* Anthropic */
    'claude-opus-4-5': { inputPerM: 5, outputPerM: 25 },
    'claude-opus-4': { inputPerM: 15, outputPerM: 75 },
    'claude-sonnet-4-5': { inputPerM: 3, outputPerM: 15 },
    'claude-sonnet-4': { inputPerM: 3, outputPerM: 15 },
    'claude-haiku-4-5': { inputPerM: 1, outputPerM: 5 },
    'claude-haiku-4': { inputPerM: 1, outputPerM: 5 },
    'claude-3-7-sonnet-latest': { inputPerM: 3, outputPerM: 15 },
    'claude-3-5-sonnet-latest': { inputPerM: 3, outputPerM: 15 },
    'claude-3-5-haiku-latest': { inputPerM: 0.8, outputPerM: 4 },
    /* Google */
    'gemini-3.0-pro': { inputPerM: 2, outputPerM: 12 },
    'gemini-3.0-flash': { inputPerM: 0.3, outputPerM: 2.5 },
    'gemini-2.5-pro': { inputPerM: 1.25, outputPerM: 10 },
    'gemini-2.5-flash': { inputPerM: 0.3, outputPerM: 2.5 },
    'gemini-2.5-flash-lite': { inputPerM: 0.1, outputPerM: 0.4 },
    'gemini-2.0-flash': { inputPerM: 0.1, outputPerM: 0.4 },
    'gemini-2.0-flash-lite': { inputPerM: 0.075, outputPerM: 0.3 },
    /* OpenRouter slugs */
    'openai/gpt-5': { inputPerM: 1.25, outputPerM: 10 },
    'openai/gpt-5-mini': { inputPerM: 0.25, outputPerM: 2 },
    'openai/gpt-5-nano': { inputPerM: 0.05, outputPerM: 0.4 },
    'openai/gpt-4o': { inputPerM: 2.5, outputPerM: 10 },
    'openai/gpt-4o-mini': { inputPerM: 0.15, outputPerM: 0.6 },
    'openai/gpt-4.1': { inputPerM: 2, outputPerM: 8 },
    'openai/gpt-4.1-mini': { inputPerM: 0.4, outputPerM: 1.6 },
    'openai/o3': { inputPerM: 2, outputPerM: 8 },
    'openai/o3-mini': { inputPerM: 1.1, outputPerM: 4.4 },
    'openai/o4-mini': { inputPerM: 1.1, outputPerM: 4.4 },
    'anthropic/claude-opus-4': { inputPerM: 15, outputPerM: 75 },
    'anthropic/claude-sonnet-4': { inputPerM: 3, outputPerM: 15 },
    'anthropic/claude-haiku-4': { inputPerM: 1, outputPerM: 5 },
    'anthropic/claude-3.7-sonnet': { inputPerM: 3, outputPerM: 15 },
    'anthropic/claude-3.5-haiku': { inputPerM: 0.8, outputPerM: 4 },
    'google/gemini-2.5-pro': { inputPerM: 1.25, outputPerM: 10 },
    'google/gemini-2.5-flash': { inputPerM: 0.3, outputPerM: 2.5 },
    'google/gemini-2.5-flash-lite': { inputPerM: 0.1, outputPerM: 0.4 },
    'google/gemini-3.0-pro': { inputPerM: 2, outputPerM: 12 },
    'google/gemini-3.0-flash': { inputPerM: 0.3, outputPerM: 2.5 },
    'deepseek/deepseek-chat': { inputPerM: 0.27, outputPerM: 1.1 },
    'deepseek/deepseek-r1': { inputPerM: 0.55, outputPerM: 2.19 },
    'x-ai/grok-4': { inputPerM: 3, outputPerM: 15 },
    'x-ai/grok-3': { inputPerM: 3, outputPerM: 15 },
    'qwen/qwen-3-235b-a22b': { inputPerM: 0.14, outputPerM: 0.56 },
    'moonshotai/kimi-k2-0905-preview': { inputPerM: 0.6, outputPerM: 2.5 },
    /* DeepSeek (direct) */
    'deepseek-chat': { inputPerM: 0.27, outputPerM: 1.1 },
    'deepseek-reasoner': { inputPerM: 0.55, outputPerM: 2.19 },
    'deepseek-v3.1': { inputPerM: 0.28, outputPerM: 0.42 },
    /* xAI (direct) */
    'grok-4': { inputPerM: 3, outputPerM: 15 },
    'grok-4-fast': { inputPerM: 2, outputPerM: 6 },
    'grok-3': { inputPerM: 3, outputPerM: 15 },
    'grok-3-mini': { inputPerM: 0.3, outputPerM: 0.6 },
    /* Mistral (direct) */
    'mistral-large-latest': { inputPerM: 2, outputPerM: 6 },
    'mistral-small-latest': { inputPerM: 0.1, outputPerM: 0.3 },
    'codestral-latest': { inputPerM: 0.3, outputPerM: 0.9 },
    'ministral-3b': { inputPerM: 0.04, outputPerM: 0.04 },
    /* Moonshot (direct) */
    'kimi-k2-0905-preview': { inputPerM: 0.6, outputPerM: 2.5 },
    'moonshot-v1-32k': { inputPerM: 0.6, outputPerM: 1.2 },
    /* Together */
    'meta-llama/Llama-3.3-70B-Instruct-Turbo': { inputPerM: 0.88, outputPerM: 0.88 },
    'meta-llama/Llama-3.1-405B-Instruct-Turbo': { inputPerM: 3.5, outputPerM: 3.5 },
    'deepseek-ai/DeepSeek-V3': { inputPerM: 1.25, outputPerM: 1.25 },
    'deepseek-ai/DeepSeek-R1': { inputPerM: 1.25, outputPerM: 1.25 },
    'Qwen/Qwen2.5-72B-Instruct-Turbo': { inputPerM: 0.9, outputPerM: 0.9 },
    /* Fireworks */
    'accounts/fireworks/models/llama-v3p3-70b-instruct': { inputPerM: 0.9, outputPerM: 0.9 },
    'accounts/fireworks/models/qwen2p5-coder-32b-instruct': { inputPerM: 0.9, outputPerM: 0.9 },
    'accounts/fireworks/models/deepseek-r1': { inputPerM: 1.25, outputPerM: 1.25 }
};
export function estimateTokens(text) {
    if (!text)
        return 0;
    return Math.max(1, Math.ceil(text.length / 4));
}
export function estimateCost(model, usage) {
    const meta = MODELS[model];
    if (!meta)
        return 0;
    const inCost = (usage.inputTokens / 1_000_000) * meta.inputPerM;
    const outCost = (usage.outputTokens / 1_000_000) * meta.outputPerM;
    return inCost + outCost;
}
export const PROVIDERS = [
    {
        id: 'openrouter',
        name: 'OpenRouter',
        tagline: 'One key, every model',
        icon: '◉',
        color: '#f97316',
        needsKey: true,
        keyPlaceholder: 'sk-or-v1-…',
        baseUrlEditable: false,
        models: [
            'openai/gpt-5',
            'openai/gpt-5-mini',
            'openai/gpt-5-nano',
            'openai/gpt-5-codex',
            'openai/gpt-4o',
            'openai/gpt-4o-mini',
            'openai/gpt-4.1',
            'openai/gpt-4.1-mini',
            'openai/gpt-4.1-nano',
            'openai/o3',
            'openai/o3-mini',
            'openai/o4-mini',
            'openai/gpt-4.5-preview',
            'anthropic/claude-opus-4-5',
            'anthropic/claude-opus-4',
            'anthropic/claude-sonnet-4-5',
            'anthropic/claude-sonnet-4',
            'anthropic/claude-haiku-4-5',
            'anthropic/claude-haiku-4',
            'anthropic/claude-3.7-sonnet',
            'anthropic/claude-3.5-haiku',
            'google/gemini-3.0-pro',
            'google/gemini-3.0-flash',
            'google/gemini-2.5-pro',
            'google/gemini-2.5-flash',
            'google/gemini-2.5-flash-lite',
            'google/gemini-2.0-flash',
            'meta-llama/llama-3.3-70b-instruct',
            'meta-llama/llama-3.2-90b-vision-instruct',
            'meta-llama/llama-3.1-405b-instruct',
            'mistralai/mistral-large-2411',
            'mistralai/mistral-small-3.1-24b-instruct',
            'mistralai/mixtral-8x22b-instruct',
            'qwen/qwen-3-235b-a22b',
            'qwen/qwen-2.5-coder-32b-instruct',
            'deepseek/deepseek-chat',
            'deepseek/deepseek-r1',
            'deepseek/deepseek-r1-0528',
            'deepseek/deepseek-coder-v2',
            'x-ai/grok-4',
            'x-ai/grok-3',
            'x-ai/grok-2-latest',
            'cohere/command-a',
            'cohere/command-r7b',
            'moonshotai/kimi-k2-0905-preview',
            'nvidia/llama-3.1-nemotron-70b-instruct',
            'amazon/nova-pro-v1',
            'amazon/nova-lite-v1',
            'perplexity/sonar-pro',
            'openai/gpt-5-nano:free',
            'openai/gpt-4o-mini:free',
            'google/gemini-3.0-flash:free',
            'google/gemini-2.5-flash:free',
            'meta-llama/llama-3.3-70b-instruct:free',
            'qwen/qwen-2.5-coder-32b-instruct:free',
            'deepseek/deepseek-chat-v3-0324:free',
            'moonshotai/kimi-k2-instruct:free'
        ],
        freeModels: [
            'openai/gpt-5-nano:free',
            'openai/gpt-4o-mini:free',
            'google/gemini-3.0-flash:free',
            'google/gemini-2.5-flash:free',
            'meta-llama/llama-3.3-70b-instruct:free',
            'qwen/qwen-2.5-coder-32b-instruct:free',
            'deepseek/deepseek-chat-v3-0324:free',
            'moonshotai/kimi-k2-instruct:free'
        ]
    },
    {
        id: 'openai',
        name: 'OpenAI',
        tagline: 'GPT-5 & o-series',
        icon: '◈',
        color: '#10b981',
        needsKey: true,
        keyPlaceholder: 'sk-proj-…',
        baseUrlEditable: true,
        models: [
            'gpt-5',
            'gpt-5-mini',
            'gpt-5-nano',
            'gpt-5-codex',
            'gpt-4o',
            'gpt-4o-mini',
            'gpt-4.1',
            'gpt-4.1-mini',
            'gpt-4.1-nano',
            'o3',
            'o3-mini',
            'o4-mini',
            'gpt-4.5-preview',
            'gpt-4-turbo',
            'gpt-4'
        ]
    },
    {
        id: 'anthropic',
        name: 'Anthropic',
        tagline: 'Claude Opus · Sonnet · Haiku',
        icon: '✦',
        color: '#f43f5e',
        needsKey: true,
        keyPlaceholder: 'sk-ant-api03-…',
        baseUrlEditable: false,
        models: [
            'claude-opus-4-5',
            'claude-opus-4',
            'claude-sonnet-4-5',
            'claude-sonnet-4',
            'claude-haiku-4-5',
            'claude-haiku-4',
            'claude-3-7-sonnet-latest',
            'claude-3-5-sonnet-latest',
            'claude-3-5-haiku-latest'
        ]
    },
    {
        id: 'google',
        name: 'Google',
        tagline: 'Gemini 2.5 & 3.0',
        icon: '✳',
        color: '#3b82f6',
        needsKey: true,
        keyPlaceholder: 'AIza…',
        baseUrlEditable: false,
        models: [
            'gemini-3.0-pro',
            'gemini-3.0-flash',
            'gemini-2.5-pro',
            'gemini-2.5-flash',
            'gemini-2.5-flash-lite',
            'gemini-2.0-flash',
            'gemini-2.0-flash-lite'
        ]
    },
    {
        id: 'groq',
        name: 'Groq',
        tagline: 'Blazing fast & free tier',
        icon: '⚡',
        color: '#f43f5e',
        needsKey: true,
        keyPlaceholder: 'gsk_…',
        baseUrlEditable: false,
        models: [
            'llama-3.3-70b-versatile',
            'llama-3.1-8b-instant',
            'llama-3.3-70b-vision-preview',
            'llama-3.2-90b-vision-preview',
            'qwen-2.5-coder-32b',
            'qwen3-32b',
            'deepseek-r1-distill-llama-70b',
            'meta-llama/llama-4-maverick-17b-128e-instruct'
        ],
        freeModels: [
            'llama-3.3-70b-versatile',
            'llama-3.1-8b-instant',
            'llama-3.3-70b-vision-preview',
            'llama-3.2-90b-vision-preview',
            'qwen-2.5-coder-32b',
            'qwen3-32b',
            'deepseek-r1-distill-llama-70b',
            'meta-llama/llama-4-maverick-17b-128e-instruct'
        ]
    },
    {
        id: 'deepseek',
        name: 'DeepSeek',
        tagline: 'DeepSeek-V3 · R1',
        icon: '◈',
        color: '#3b82f6',
        needsKey: true,
        keyPlaceholder: 'sk-…',
        baseUrlEditable: false,
        models: [
            'deepseek-chat',
            'deepseek-reasoner',
            'deepseek-v3.1',
            'deepseek-r1-0528'
        ]
    },
    {
        id: 'xai',
        name: 'xAI',
        tagline: 'Grok 4 · 3',
        icon: '✕',
        color: '#f97316',
        needsKey: true,
        keyPlaceholder: 'xai-…',
        baseUrlEditable: false,
        models: [
            'grok-4',
            'grok-4-fast',
            'grok-3',
            'grok-3-mini',
            'grok-3-fast',
            'grok-2-latest'
        ]
    },
    {
        id: 'mistral',
        name: 'Mistral',
        tagline: 'Mistral · Codestral',
        icon: '✦',
        color: '#22d3ee',
        needsKey: true,
        keyPlaceholder: '…',
        baseUrlEditable: false,
        models: [
            'mistral-large-latest',
            'mistral-small-latest',
            'codestral-latest',
            'ministral-3b',
            'mistral-nemo',
            'pixtral-large-latest'
        ]
    },
    {
        id: 'together',
        name: 'Together AI',
        tagline: 'Open-weight frontier',
        icon: '❋',
        color: '#10b981',
        needsKey: true,
        keyPlaceholder: '…',
        baseUrlEditable: false,
        models: [
            'meta-llama/Llama-3.3-70B-Instruct-Turbo',
            'meta-llama/Llama-3.1-405B-Instruct-Turbo',
            'Qwen/Qwen2.5-72B-Instruct-Turbo',
            'Qwen/Qwen2.5-Coder-32B-Instruct',
            'deepseek-ai/DeepSeek-V3',
            'deepseek-ai/DeepSeek-R1',
            'mistralai/Mistral-Small-24B-Instruct-2501'
        ]
    },
    {
        id: 'fireworks',
        name: 'Fireworks',
        tagline: 'Fast open models',
        icon: '✸',
        color: '#8b5cf6',
        needsKey: true,
        keyPlaceholder: '…',
        baseUrlEditable: false,
        models: [
            'accounts/fireworks/models/llama-v3p3-70b-instruct',
            'accounts/fireworks/models/llama-v3p1-405b-instruct',
            'accounts/fireworks/models/qwen3-coder-480b-a35b',
            'accounts/fireworks/models/deepseek-r1',
            'accounts/fireworks/models/firefunction-v2',
            'accounts/fireworks/models/qwen2p5-coder-32b-instruct'
        ]
    },
    {
        id: 'cerebras',
        name: 'Cerebras',
        tagline: 'Fastest inference — free',
        icon: '◎',
        color: '#06b6d4',
        needsKey: true,
        keyPlaceholder: 'csk-…',
        baseUrlEditable: false,
        freeAll: true,
        models: [
            'llama-3.3-70b',
            'llama-3.1-8b-instant',
            'qwen-3-coder-480b-a35b',
            'meta-llama-3.3-70b-instruct-turbo'
        ]
    },
    {
        id: 'moonshot',
        name: 'Moonshot',
        tagline: 'Kimi K2',
        icon: '☾',
        color: '#eab308',
        needsKey: true,
        keyPlaceholder: 'sk-…',
        baseUrlEditable: false,
        models: [
            'kimi-k2-0905-preview',
            'moonshot-v1-32k',
            'moonshot-v1-8k',
            'moonshot-v1-128k'
        ]
    },
    {
        id: 'nvidia',
        name: 'NVIDIA',
        tagline: 'Build.nvidia.com — free',
        icon: '◆',
        color: '#22c55e',
        needsKey: true,
        keyPlaceholder: 'nvapi-…',
        baseUrlEditable: false,
        freeAll: true,
        models: [
            'meta/llama-3.3-70b-instruct',
            'meta/llama-3.1-405b-instruct',
            'deepseek-ai/deepseek-r1',
            'nvidia/nemotron-4-340b-instruct',
            'qwen/qwen-2.5-72b-instruct',
            'google/gemma-3-27b-it',
            'microsoft/phi-3.5-mini-instruct'
        ]
    },
    {
        id: 'huggingface',
        name: 'Hugging Face',
        tagline: 'Router — free tier',
        icon: '🤗',
        color: '#facc15',
        needsKey: true,
        keyPlaceholder: 'hf_…',
        baseUrlEditable: false,
        freeAll: true,
        models: [
            'kimi-k2-instruct',
            'glm-4.6',
            'qwen3-coder:480b',
            'deepseek-r1',
            'meta-llama/Llama-3.3-70B-Instruct',
            'Qwen/Qwen3-Coder-480B'
        ]
    },
    {
        id: 'ollama',
        name: 'Ollama',
        tagline: 'Local & free — loads live',
        icon: '⬢',
        color: '#8b5cf6',
        needsKey: false,
        freeAll: true,
        keyPlaceholder: '',
        baseUrlEditable: true,
        defaultBaseUrl: 'http://localhost:11434',
        models: [
            'llama3.3:70b',
            'llama3.2:3b',
            'llama3.2:1b',
            'llama3.2-vision:11b',
            'llama3.1:8b',
            'llama3.1:70b',
            'llama3:8b',
            'qwen3:32b',
            'qwen3:8b',
            'qwen2.5-coder:32b',
            'qwen2.5-coder:14b',
            'qwen2.5-coder:7b',
            'qwen2.5:7b',
            'deepseek-r1:70b',
            'deepseek-r1:14b',
            'deepseek-r1:8b',
            'deepseek-coder-v2:16b',
            'codestral:22b',
            'mistral:7b',
            'mixtral:8x7b',
            'phi4:14b',
            'phi4-mini:3.8b',
            'phi3:mini',
            'gemma3:27b',
            'gemma3:12b',
            'gemma3:4b',
            'codellama:34b',
            'codellama:7b'
        ]
    },
    {
        id: 'lmstudio',
        name: 'LM Studio',
        tagline: 'Local OpenAI-compatible',
        icon: '▣',
        color: '#22d3ee',
        needsKey: false,
        freeAll: true,
        keyPlaceholder: '',
        baseUrlEditable: true,
        defaultBaseUrl: 'http://localhost:1234',
        models: ['local-model']
    }
];
export function getProvider(id) {
    return activeProviders.find((p) => p.id === id);
}
let activeProviders = PROVIDERS;
export function getActiveProviders() {
    return activeProviders;
}
export function setActiveProviders(providers) {
    if (Array.isArray(providers) && providers.length)
        activeProviders = providers;
}
export function setRuntimePrices(prices) {
    MODELS = { ...MODELS, ...prices };
}
export function getDefaultBaseUrl(id) {
    const p = getProvider(id);
    if (p?.defaultBaseUrl)
        return p.defaultBaseUrl;
    const def = {
        openrouter: 'https://openrouter.ai/api/v1',
        openai: 'https://api.openai.com/v1',
        anthropic: 'https://api.anthropic.com',
        google: 'https://generativelanguage.googleapis.com/v1beta',
        groq: 'https://api.groq.com/openai/v1',
        deepseek: 'https://api.deepseek.com/v1',
        xai: 'https://api.x.ai/v1',
        mistral: 'https://api.mistral.ai/v1',
        together: 'https://api.together.xyz/v1',
        fireworks: 'https://api.fireworks.ai/inference/v1',
        cerebras: 'https://api.cerebras.ai/v1',
        moonshot: 'https://api.moonshot.ai/v1',
        nvidia: 'https://integrate.api.nvidia.com/v1',
        huggingface: 'https://router.huggingface.co/v1',
        ollama: 'http://localhost:11434',
        lmstudio: 'http://localhost:1234'
    };
    return def[id] ?? '';
}
