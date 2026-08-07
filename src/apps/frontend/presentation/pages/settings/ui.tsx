// Piezas de UI compartidas por las secciones de Ajustes. Nada aquí conoce la
// API de Jellyfin: son controles tontos que reciben valor y callback.

import type { CSSProperties, ReactNode } from 'react';

import globalize from 'lib/globalize';

import { MC } from '../../theme/responsive';
import { T } from '../../theme/tokens';

export function MobileSettingsItem({
    label, hint, onClick
}: {
    label: string; hint?: string; onClick: () => void;
}) {
    return (
        <button
            onClick={onClick}
            style={{
                display: 'flex', alignItems: 'center', gap: 12, width: '100%',
                textAlign: 'left', padding: '16px 4px',
                background: 'none', border: 'none', cursor: 'pointer',
                borderBottom: `1px solid ${MC.outlineVariant}`,
                color: 'inherit', fontFamily: T.ui
            }}
        >
            <span style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15 }}>{label}</div>
                {hint && (
                    <div style={{ fontSize: 12, color: MC.onSurfaceVariant, marginTop: 2 }}>
                        {hint}
                    </div>
                )}
            </span>
            <span aria-hidden='true' style={{ color: MC.onSurfaceVariant, fontSize: 18 }}>›</span>
        </button>
    );
}

export function SectionTitle({ children, style }: { children: ReactNode; style?: CSSProperties }) {
    return (
        <div style={{
            fontSize: 11, letterSpacing: 3, textTransform: 'uppercase',
            color: T.dim, marginBottom: 18, ...style
        }}>
            {children}
        </div>
    );
}

export function InfoRow({ label, value }: { label: string; value: string }) {
    return (
        <div style={{
            display: 'grid', gridTemplateColumns: '160px minmax(0, 1fr)', padding: '14px 0',
            borderBottom: `1px solid ${T.hairline}`, fontSize: 14
        }}>
            <span style={{ color: T.dim }}>{label}</span>
            <span style={{ color: T.fg, wordBreak: 'break-all' }}>{value}</span>
        </div>
    );
}

export function SettingRow({
    label, hint, children
}: {
    label: string; hint?: string; children: ReactNode;
}) {
    return (
        <div style={{
            display: 'flex', alignItems: 'center', gap: 24,
            padding: '16px 0', borderBottom: `1px solid ${T.hairline}`
        }}>
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14 }}>{label}</div>
                {hint && <div style={{ fontSize: 12, color: T.dim, marginTop: 3 }}>{hint}</div>}
            </div>
            <div style={{ flexShrink: 0 }}>{children}</div>
        </div>
    );
}

export function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
    return (
        <button
            role='switch'
            aria-checked={on}
            onClick={() => onChange(!on)}
            style={{
                width: 42, height: 24, borderRadius: 999, position: 'relative',
                background: on ? '#fff' : 'rgba(255,255,255,0.16)',
                border: 'none', cursor: 'pointer', padding: 0,
                transition: 'background .2s'
            }}
        >
            <span style={{
                position: 'absolute', top: 3, left: on ? 21 : 3,
                width: 18, height: 18, borderRadius: '50%',
                background: on ? '#000' : '#fff',
                transition: 'left .2s'
            }} />
        </button>
    );
}

export function SelectBox({
    value, options, disabled, onChange
}: {
    value: string; options: [string, string][];
    /** Hay un guardado en vuelo: cambiarlo otra vez ahora se perdería. */
    disabled?: boolean;
    onChange: (v: string) => void;
}) {
    return (
        <select
            value={value}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value)}
            style={{
                background: 'rgba(255,255,255,0.06)', color: T.fg,
                border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8,
                padding: '9px 12px', fontFamily: T.ui, fontSize: 13,
                cursor: disabled ? 'wait' : 'pointer', minWidth: 220,
                opacity: disabled ? 0.6 : 1
            }}
        >
            {/* El popup nativo lo tiñe global.css (select/option): inline se
                quedaba fijo en oscuro incluso con el tema claro de móvil. */}
            {options.map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
            ))}
        </select>
    );
}

export const inputStyle: CSSProperties = {
    background: 'rgba(255,255,255,0.06)', color: T.fg,
    border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8,
    padding: '10px 12px', fontFamily: T.ui, fontSize: 13, outline: 'none'
};

export const btnSecondary: CSSProperties = {
    padding: '10px 20px',
    background: 'rgba(255,255,255,0.08)', color: T.fg,
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: 999, fontFamily: T.ui, fontSize: 13,
    cursor: 'pointer', fontWeight: 500
};

export const btnDanger: CSSProperties = {
    padding: '10px 20px',
    background: 'transparent', color: '#ff6b6b',
    border: '1px solid rgba(255,80,80,0.4)',
    borderRadius: 999, fontFamily: T.ui, fontSize: 13,
    cursor: 'pointer', fontWeight: 500
};

// Carga / error compartidos por las secciones que piden datos al servidor.
// Devuelve null cuando ya hay datos que pintar.
export function SectionStatus({ error, loaded }: { error: string | null; loaded: boolean }) {
    if (error) return <div style={{ color: '#ff6b6b', fontSize: 14 }}>{error}</div>;
    if (!loaded) return <div style={{ color: T.dim, fontSize: 13 }}>{globalize.translate('Loading')}</div>;
    return null;
}
