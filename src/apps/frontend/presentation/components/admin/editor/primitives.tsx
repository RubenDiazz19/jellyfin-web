import React from 'react';
import { T } from '../../../theme/tokens';

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{
                fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', color: T.dim
            }}>{label}</label>
            {children}
        </div>
    );
}

export function TextInput({
    value, onChange, placeholder, autoFocus
}: {
    value: string; onChange: (v: string) => void; placeholder?: string; autoFocus?: boolean;
}) {
    return (
        <input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            autoFocus={autoFocus}
            style={{
                width: '100%', boxSizing: 'border-box',
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8,
                padding: '10px 12px', color: '#fff', fontFamily: T.ui, fontSize: 14,
                outline: 'none'
            }}
        />
    );
}

export function TextArea({
    value, onChange, rows = 4
}: {
    value: string; onChange: (v: string) => void; rows?: number;
}) {
    return (
        <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            rows={rows}
            style={{
                width: '100%', boxSizing: 'border-box',
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8,
                padding: '10px 12px', color: '#fff', fontFamily: T.ui, fontSize: 14,
                outline: 'none', resize: 'vertical'
            }}
        />
    );
}

export function PrimaryBtn({
    onClick, disabled, children
}: {
    onClick: () => void; disabled?: boolean; children: React.ReactNode;
}) {
    return (
        <button
            onClick={onClick} disabled={disabled}
            style={{
                padding: '10px 18px', background: '#fff', color: '#000',
                border: 'none', borderRadius: 999,
                fontFamily: T.ui, fontSize: 13, fontWeight: 600, letterSpacing: 0.3,
                cursor: disabled ? 'wait' : 'pointer', opacity: disabled ? 0.7 : 1
            }}
        >
            {children}
        </button>
    );
}

export function SecondaryBtn({
    onClick, disabled, children
}: {
    onClick: () => void; disabled?: boolean; children: React.ReactNode;
}) {
    return (
        <button
            onClick={onClick} disabled={disabled}
            style={{
                padding: '10px 16px', background: 'transparent', color: '#fff',
                border: '1px solid rgba(255,255,255,0.25)', borderRadius: 999,
                fontFamily: T.ui, fontSize: 13, fontWeight: 500,
                cursor: disabled ? 'wait' : 'pointer', opacity: disabled ? 0.7 : 1
            }}
        >
            {children}
        </button>
    );
}

export function FooterRow({ children }: { children: React.ReactNode }) {
    return (
        <div style={{
            display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 12
        }}>{children}</div>
    );
}

export function Muted({ children }: { children: React.ReactNode }) {
    return <div style={{ color: T.dim, fontSize: 13, lineHeight: 1.5 }}>{children}</div>;
}

export function ErrText({ children }: { children: React.ReactNode }) {
    return <div style={{ color: '#ff6b6b', fontSize: 13 }}>{children}</div>;
}

export function SectionHeader({
    label, onSearch, loading
}: {
    label: string; onSearch: () => void; loading: boolean;
}) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
            <div style={{
                fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', color: T.dim
            }}>{label}</div>
            <div style={{ marginLeft: 'auto' }}>
                <SecondaryBtn onClick={onSearch} disabled={loading}>
                    {loading ? 'Buscando…' : 'Buscar alternativas'}
                </SecondaryBtn>
            </div>
        </div>
    );
}

export type ImgType = 'Primary' | 'Backdrop' | 'Logo';
