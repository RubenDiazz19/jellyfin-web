import { useEffect, useRef, useState } from 'react';

import globalize from 'lib/globalize';

import { T } from '../../theme/tokens';
import { useToast } from '../toast/ToastProvider';

// Título que se edita escribiendo encima. Un clic lo convierte en campo, y al
// salir (o con Enter) se guarda solo — sin botón de confirmar, que para un
// campo único sobra.
//
// El campo se calca al `h1` en tipografía y tamaño para que la transición no
// dé un salto: lo único que cambia es el subrayado que indica que se edita.

type Props = {
    value: string;
    onSave: (name: string) => Promise<void>;
    fontSize: number;
};

export function EditableTitle({ value, onSave, fontSize }: Props) {
    const toast = useToast();
    const inputRef = useRef<HTMLInputElement>(null);
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(value);
    const [busy, setBusy] = useState(false);

    // El nombre puede llegar tarde (se resuelve tras cargar las listas) o
    // cambiar desde otro sitio; mientras no se esté editando, manda el de
    // fuera para no pisar lo que el usuario está escribiendo.
    useEffect(() => {
        if (!editing) setDraft(value);
    }, [value, editing]);

    useEffect(() => {
        if (editing) inputRef.current?.select();
    }, [editing]);

    const commit = async () => {
        const clean = draft.trim();
        setEditing(false);
        if (!clean || clean === value) {
            setDraft(value);
            return;
        }
        setBusy(true);
        try {
            await onSave(clean);
        } catch (e) {
            setDraft(value);
            toast((e as Error).message, 'warn');
        } finally {
            setBusy(false);
        }
    };

    const shared: React.CSSProperties = {
        fontFamily: T.ui, fontWeight: 300,
        fontSize, letterSpacing: -0.5, lineHeight: 1.15,
        color: '#fff', background: 'none', padding: 0, margin: 0
    };

    if (editing) {
        return (
            <input
                ref={inputRef}
                value={draft}
                disabled={busy}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={() => { void commit(); }}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') void commit();
                    if (e.key === 'Escape') {
                        setDraft(value);
                        setEditing(false);
                    }
                }}
                aria-label={globalize.translate('LabelName')}
                style={{
                    ...shared,
                    width: '100%', maxWidth: 720, boxSizing: 'border-box',
                    border: 'none', borderBottom: '2px solid rgba(255,255,255,0.5)',
                    outline: 'none'
                }}
            />
        );
    }

    return (
        <h1 style={{ ...shared, display: 'block' }}>
            {/* Un botón de verdad y no un `h1` con `role=textbox`: así el
                Enter, el foco y el lector de pantalla funcionan solos, y el
                encabezado sigue siendo un encabezado. */}
            <button
                type='button'
                title={globalize.translate('ButtonRename')}
                onClick={() => setEditing(true)}
                style={{
                    ...shared,
                    border: 'none', cursor: 'text', textAlign: 'left',
                    borderBottom: '2px solid transparent',
                    transition: 'border-color .15s'
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderBottomColor = 'rgba(255,255,255,0.25)')}
                onMouseLeave={(e) => (e.currentTarget.style.borderBottomColor = 'transparent')}
            >
                {value}
            </button>
        </h1>
    );
}
