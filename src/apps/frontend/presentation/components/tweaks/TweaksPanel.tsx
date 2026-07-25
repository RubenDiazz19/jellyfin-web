// Panel flotante de "tweaks" para exponer parámetros configurables del hero.
// En este proyecto solo se abre cuando el host envía __activate_edit_mode
// (compatibilidad con el runtime de artifacts de Anthropic); en el
// despliegue real queda oculto pero los hooks siguen funcionando.

import React, { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

const STYLE = `
  .twk-panel{position:fixed;right:16px;bottom:16px;z-index:2147483646;width:280px;
    max-height:calc(100vh - 32px);display:flex;flex-direction:column;
    background:rgba(250,249,247,.78);color:#29261b;
    -webkit-backdrop-filter:blur(24px) saturate(160%);backdrop-filter:blur(24px) saturate(160%);
    border:.5px solid rgba(255,255,255,.6);border-radius:14px;
    box-shadow:0 1px 0 rgba(255,255,255,.5) inset,0 12px 40px rgba(0,0,0,.18);
    font:11.5px/1.4 ui-sans-serif,system-ui,-apple-system,sans-serif;overflow:hidden}
  .twk-hd{display:flex;align-items:center;justify-content:space-between;
    padding:10px 8px 10px 14px;cursor:move;user-select:none}
  .twk-hd b{font-size:12px;font-weight:600;letter-spacing:.01em}
  .twk-x{appearance:none;border:0;background:transparent;color:rgba(41,38,27,.55);
    width:22px;height:22px;border-radius:6px;cursor:default;font-size:13px;line-height:1}
  .twk-x:hover{background:rgba(0,0,0,.06);color:#29261b}
  .twk-body{padding:2px 14px 14px;display:flex;flex-direction:column;gap:10px;
    overflow-y:auto;overflow-x:hidden;min-height:0}
  .twk-row{display:flex;flex-direction:column;gap:5px}
  .twk-row-h{flex-direction:row;align-items:center;justify-content:space-between;gap:10px}
  .twk-lbl{display:flex;justify-content:space-between;align-items:baseline;
    color:rgba(41,38,27,.72)}
  .twk-lbl>span:first-child{font-weight:500}
  .twk-sect{font-size:10px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;
    color:rgba(41,38,27,.45);padding:10px 0 0}
  .twk-sect:first-child{padding-top:0}
  .twk-seg{position:relative;display:flex;padding:2px;border-radius:8px;
    background:rgba(0,0,0,.06);user-select:none}
  .twk-seg-thumb{position:absolute;top:2px;bottom:2px;border-radius:6px;
    background:rgba(255,255,255,.9);box-shadow:0 1px 2px rgba(0,0,0,.12);
    transition:left .15s cubic-bezier(.3,.7,.4,1),width .15s}
  .twk-seg.dragging .twk-seg-thumb{transition:none}
  .twk-seg button{appearance:none;position:relative;z-index:1;flex:1;border:0;
    background:transparent;color:inherit;font:inherit;font-weight:500;min-height:22px;
    border-radius:6px;cursor:default;padding:4px 6px;line-height:1.2;
    overflow-wrap:anywhere}
`;

type Setter<T> = {
    (edits: Partial<T>): void;
    <K extends keyof T>(key: K, value: T[K]): void;
};

// Único punto de verdad para los valores de los tweaks. Cuando cambian, se
// notifica al host (edit-mode) por postMessage y a suscriptores locales
// mediante un CustomEvent, para que otros paneles reaccionen sin recargar.
export function useTweaks<T extends Record<string, unknown>>(defaults: T): [T, Setter<T>] {
    const [values, setValues] = useState<T>(defaults);
    // Sobrecarga: acepta un objeto de ediciones o un par clave/valor. La
    // firma pública la fija `Setter<T>`; aquí dentro el parámetro es la
    // unión de las dos formas.
    const setTweak = useCallback((keyOrEdits: Partial<T> | keyof T, val?: T[keyof T]) => {
        // Las claves son string/number/symbol, así que `typeof === 'object'`
        // ya distingue las dos formas de llamada.
        const edits: Partial<T> = typeof keyOrEdits === 'object' ?
            keyOrEdits :
            { [keyOrEdits]: val } as Partial<T>;
        setValues((prev) => ({ ...prev, ...edits }));
        try {
            // eslint-disable-next-line sonarjs/post-message -- host de edición con origen desconocido a propósito
            window.parent.postMessage({ type: '__edit_mode_set_keys', edits }, '*');
        } catch {
            // ignore: no parent frame in production
        }
        window.dispatchEvent(new CustomEvent('tweakchange', { detail: edits }));
    }, []) as Setter<T>;
    return [values, setTweak];
}

type PanelProps = { title?: string; children?: ReactNode };

export function TweaksPanel({ title = 'Tweaks', children }: PanelProps) {
    const [open, setOpen] = useState(false);
    const dragRef = useRef<HTMLDivElement>(null);
    const offsetRef = useRef({ x: 16, y: 16 });
    const PAD = 16;

    const clampToViewport = useCallback(() => {
        const panel = dragRef.current;
        if (!panel) return;
        const w = panel.offsetWidth;
        const h = panel.offsetHeight;
        const maxRight = Math.max(PAD, window.innerWidth - w - PAD);
        const maxBottom = Math.max(PAD, window.innerHeight - h - PAD);
        offsetRef.current = {
            x: Math.min(maxRight, Math.max(PAD, offsetRef.current.x)),
            y: Math.min(maxBottom, Math.max(PAD, offsetRef.current.y))
        };
        panel.style.right = offsetRef.current.x + 'px';
        panel.style.bottom = offsetRef.current.y + 'px';
    }, []);

    useEffect(() => {
        if (!open) return;
        clampToViewport();
        if (typeof ResizeObserver === 'undefined') {
            window.addEventListener('resize', clampToViewport);
            return () => window.removeEventListener('resize', clampToViewport);
        }
        const ro = new ResizeObserver(clampToViewport);
        ro.observe(document.documentElement);
        return () => ro.disconnect();
    }, [open, clampToViewport]);

    useEffect(() => {
        const onMsg = (e: MessageEvent) => {
            const data: unknown = e?.data;
            const t = data !== null && typeof data === 'object' && 'type' in data ?
                (data as { type?: unknown }).type :
                undefined;
            if (t === '__activate_edit_mode') setOpen(true);
            else if (t === '__deactivate_edit_mode') setOpen(false);
        };
        window.addEventListener('message', onMsg);
        try {
            // eslint-disable-next-line sonarjs/post-message -- host de edición con origen desconocido a propósito
            window.parent.postMessage({ type: '__edit_mode_available' }, '*');
        } catch {
            // no parent, ignore
        }
        return () => window.removeEventListener('message', onMsg);
    }, []);

    const dismiss = () => {
        setOpen(false);
        try {
            // eslint-disable-next-line sonarjs/post-message -- host de edición con origen desconocido a propósito
            window.parent.postMessage({ type: '__edit_mode_dismissed' }, '*');
        } catch {
            // ignore
        }
    };

    const onDragStart = (e: React.MouseEvent) => {
        const panel = dragRef.current;
        if (!panel) return;
        const r = panel.getBoundingClientRect();
        const sx = e.clientX;
        const sy = e.clientY;
        const startRight = window.innerWidth - r.right;
        const startBottom = window.innerHeight - r.bottom;
        const move = (ev: MouseEvent) => {
            offsetRef.current = {
                x: startRight - (ev.clientX - sx),
                y: startBottom - (ev.clientY - sy)
            };
            clampToViewport();
        };
        const up = () => {
            window.removeEventListener('mousemove', move);
            window.removeEventListener('mouseup', up);
        };
        window.addEventListener('mousemove', move);
        window.addEventListener('mouseup', up);
    };

    if (!open) return null;
    return (
        <>
            <style>{STYLE}</style>
            <div
                ref={dragRef}
                className='twk-panel'
                style={{ right: offsetRef.current.x, bottom: offsetRef.current.y }}
            >
                <div className='twk-hd' onMouseDown={onDragStart}>
                    <b>{title}</b>
                    <button
                        className='twk-x'
                        aria-label='Close tweaks'
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={dismiss}
                    >
                        ✕
                    </button>
                </div>
                <div className='twk-body'>{children}</div>
            </div>
        </>
    );
}

export function TweakSection({ label, children }: { label: string; children?: ReactNode }) {
    return (
        <>
            <div className='twk-sect'>{label}</div>
            {children}
        </>
    );
}

export function TweakRow({
    label,
    value,
    children,
    inline = false
}: {
    label: string;
    value?: string | number;
    children?: ReactNode;
    inline?: boolean;
}) {
    return (
        <div className={inline ? 'twk-row twk-row-h' : 'twk-row'}>
            <div className='twk-lbl'>
                <span>{label}</span>
                {value != null && <span className='twk-val'>{value}</span>}
            </div>
            {children}
        </div>
    );
}

type RadioProps<T> = {
    label: string;
    value: T;
    options: readonly T[];
    onChange: (v: T) => void;
};

export function TweakRadio<T extends string>({ label, value, options, onChange }: RadioProps<T>) {
    const trackRef = useRef<HTMLDivElement>(null);
    const [dragging, setDragging] = useState(false);
    const valueRef = useRef(value);
    valueRef.current = value;

    const idx = Math.max(0, options.indexOf(value));
    const n = options.length;

    const segAt = (clientX: number): T => {
        const rect = trackRef.current!.getBoundingClientRect();
        const inner = rect.width - 4;
        const i = Math.floor(((clientX - rect.left - 2) / inner) * n);
        return options[Math.max(0, Math.min(n - 1, i))];
    };

    const onPointerDown = (e: React.PointerEvent) => {
        setDragging(true);
        const v0 = segAt(e.clientX);
        if (v0 !== valueRef.current) onChange(v0);
        const move = (ev: PointerEvent) => {
            if (!trackRef.current) return;
            const v = segAt(ev.clientX);
            if (v !== valueRef.current) onChange(v);
        };
        const up = () => {
            setDragging(false);
            window.removeEventListener('pointermove', move);
            window.removeEventListener('pointerup', up);
        };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
    };

    return (
        <TweakRow label={label}>
            <div
                ref={trackRef}
                role='radiogroup'
                onPointerDown={onPointerDown}
                className={dragging ? 'twk-seg dragging' : 'twk-seg'}
            >
                <div
                    className='twk-seg-thumb'
                    style={{
                        left: `calc(2px + ${idx} * (100% - 4px) / ${n})`,
                        width: `calc((100% - 4px) / ${n})`
                    }}
                />
                {options.map((opt) => (
                    <button key={opt} type='button' role='radio' aria-checked={opt === value}>
                        {opt}
                    </button>
                ))}
            </div>
        </TweakRow>
    );
}
