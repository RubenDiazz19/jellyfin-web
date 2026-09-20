import { type ReactNode } from 'react';
import { T } from '../../theme/tokens';

type Tab = {
    id: string;
    label: string | ReactNode;
};

type Props<T extends string> = {
    tabs: { id: T; label: string | ReactNode }[];
    active: T;
    onChange: (id: T) => void;
};

// Barra de pestañas extraída de MetadataEditor y SubtitlePickerModal.
export function TabBar<T extends string>({ tabs, active, onChange }: Props<T>) {
    return (
        <div style={{
            display: 'flex', gap: 4, padding: '6px 14px',
            borderBottom: '1px solid rgba(255,255,255,0.06)', fontSize: 13,
            overflowX: 'auto', WebkitOverflowScrolling: 'touch'
        }}>
            {tabs.map(tab => (
                <TabButton
                    key={tab.id}
                    label={tab.label}
                    active={active === tab.id}
                    onClick={() => onChange(tab.id)}
                />
            ))}
        </div>
    );
}

function TabButton({ label, active, onClick }: {
    label: ReactNode; active: boolean; onClick: () => void;
}) {
    return (
        <button
            onClick={onClick}
            type="button"
            style={{
                padding: '10px 14px', background: 'none', border: 'none',
                color: active ? '#fff' : T.dim, cursor: 'pointer',
                fontFamily: T.ui, fontSize: 13, fontWeight: active ? 600 : 400,
                position: 'relative', whiteSpace: 'nowrap'
            }}
        >
            {label}
            {active && <div style={{
                position: 'absolute', bottom: 0, left: 10, right: 10, height: 2,
                background: '#fff', borderRadius: 1
            }} />}
        </button>
    );
}
