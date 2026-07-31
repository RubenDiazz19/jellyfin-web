// Clientes de los proveedores de LLM.
//
// Los tres de capa gratuita hablan protocolos distintos, pero para lo que hace
// falta aquí —mandar dos textos y recibir uno— la diferencia cabe en una
// función por proveedor. Groq y OpenRouter comparten el formato de OpenAI.
//
// El nombre del modelo NO se codifica a fuego: los proveedores los renombran y
// los retiran cada pocos meses. Va por env (`AUTOTAG_MODEL`) con un valor por
// defecto razonable, y si el proveedor contesta 404 el error lo dice.

export type ProviderName = 'groq' | 'gemini' | 'ollama' | 'openai';

export type ProviderConfig = {
    provider: ProviderName;
    apiKey: string;
    model: string;
    /** Solo para `openai`/`ollama`: a dónde apuntar. */
    baseUrl?: string;
};

export type Provider = {
    label: string;
    complete(system: string, user: string): Promise<string>;
};

export const DEFAULT_MODELS: Record<ProviderName, string> = {
    groq: 'llama-3.3-70b-versatile',
    gemini: 'gemini-2.5-flash',
    ollama: 'llama3.1:8b',
    openai: 'gpt-4o-mini'
};

/** Proveedores que no necesitan clave: el modelo corre en la propia máquina. */
const LOCAL_PROVIDERS: readonly ProviderName[] = ['ollama'];

export function needsApiKey(provider: ProviderName): boolean {
    return !LOCAL_PROVIDERS.includes(provider);
}

class HttpError extends Error {
    constructor(readonly status: number, message: string) {
        super(message);
    }
}

/**
 * Reintenta con espera creciente. Las capas gratuitas limitan por minuto y por
 * día: un 429 casi siempre es «espera un poco», no «no puedes». Se respeta
 * `Retry-After` cuando viene, que es la única cifra fiable.
 */
async function withRetry<T>(fn: () => Promise<T>, attempts = 5): Promise<T> {
    let wait = 2000;
    for (let i = 1; ; i++) {
        try {
            return await fn();
        } catch (err) {
            const status = err instanceof HttpError ? err.status : 0;
            const retriable = status === 429 || status >= 500 || status === 0;
            if (!retriable || i >= attempts) throw err;
            const hinted = err instanceof HttpError ? retryAfterMs(err.message) : undefined;
            const delay = hinted ?? wait;
            console.warn(`  ↻ reintento ${i}/${attempts - 1} en ${Math.round(delay / 1000)}s (${status || 'red'})`);
            await sleep(delay);
            wait = Math.min(wait * 2, 60_000);
        }
    }
}

/** Muchos 429 traen los segundos a esperar en el cuerpo; se aprovecha si está. */
function retryAfterMs(message: string): number | undefined {
    const m = /try again in ([\d.]+)s/i.exec(message);
    return m ? Math.ceil(Number(m[1]) * 1000) + 500 : undefined;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function postJson(url: string, body: unknown, headers: Record<string, string>): Promise<unknown> {
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify(body)
    });
    if (!res.ok) {
        throw new HttpError(res.status, `${res.status} ${res.statusText} — ${(await res.text()).slice(0, 400)}`);
    }
    return res.json();
}

/** Groq, OpenRouter, OpenAI y compañía: mismo cuerpo, distinta URL. */
function openAiCompatible(cfg: ProviderConfig, baseUrl: string, label: string): Provider {
    return {
        label,
        complete: (system, user) => withRetry(async () => {
            const data = await postJson(
                `${baseUrl}/chat/completions`,
                {
                    model: cfg.model,
                    temperature: 0.2,
                    response_format: { type: 'json_object' },
                    messages: [
                        { role: 'system', content: system },
                        { role: 'user', content: user }
                    ]
                },
                { Authorization: `Bearer ${cfg.apiKey}` }
            ) as { choices?: { message?: { content?: string } }[] };
            const text = data.choices?.[0]?.message?.content;
            if (!text) throw new Error('Respuesta sin contenido');
            return text;
        })
    };
}

function gemini(cfg: ProviderConfig): Provider {
    return {
        label: `Google AI Studio (${cfg.model})`,
        complete: (system, user) => withRetry(async () => {
            const data = await postJson(
                `https://generativelanguage.googleapis.com/v1beta/models/${cfg.model}:generateContent`,
                {
                    systemInstruction: { parts: [{ text: system }] },
                    contents: [{ role: 'user', parts: [{ text: user }] }],
                    generationConfig: { temperature: 0.2, responseMimeType: 'application/json' }
                },
                { 'x-goog-api-key': cfg.apiKey }
            ) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
            const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('');
            if (!text) throw new Error('Respuesta sin contenido');
            return text;
        })
    };
}

function ollama(cfg: ProviderConfig): Provider {
    const baseUrl = cfg.baseUrl ?? 'http://localhost:11434';
    return {
        label: `Ollama local (${cfg.model})`,
        complete: (system, user) => withRetry(async () => {
            const data = await postJson(
                `${baseUrl}/api/chat`,
                {
                    model: cfg.model,
                    stream: false,
                    format: 'json',
                    options: { temperature: 0.2 },
                    messages: [
                        { role: 'system', content: system },
                        { role: 'user', content: user }
                    ]
                },
                {}
            ) as { message?: { content?: string } };
            const text = data.message?.content;
            if (!text) throw new Error('Respuesta sin contenido');
            return text;
        })
    };
}

export function createProvider(cfg: ProviderConfig): Provider {
    switch (cfg.provider) {
        case 'groq':
            return openAiCompatible(cfg, 'https://api.groq.com/openai/v1', `Groq (${cfg.model})`);
        case 'openai':
            return openAiCompatible(
                cfg,
                cfg.baseUrl ?? 'https://api.openai.com/v1',
                `OpenAI-compatible (${cfg.model})`
            );
        case 'gemini':
            return gemini(cfg);
        case 'ollama':
            return ollama(cfg);
    }
}
