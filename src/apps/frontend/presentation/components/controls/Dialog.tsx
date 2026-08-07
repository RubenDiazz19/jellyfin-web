// El armazón de las cajas modales: el fondo oscurecido, el panel centrado, su
// cabecera y las filas de lista que aparecen dentro.
//
// Los cinco diálogos del app (confirmar un borrado, añadir a una lista, Mi
// lista, etiquetas de un item, etiquetas de un lote) traían cada uno su propia
// copia de las mismas cuarenta líneas: mismo portal, mismo desenfoque, mismo
// `min(420px, 100%)`, misma × en la esquina. Cambiar el aspecto de «un
// diálogo» significaba encontrarlos todos, y por eso ya no eran iguales entre
// sí: unos cerraban con Escape y otros no.
//
// Aquí está esa parte una sola vez. Lo que cada caja tiene de propio —qué
// enseña dentro y qué hace al aceptar— sigue en su fichero.

import globalize from 'lib/globalize';

import { useEffect, type ReactNode } from 'react';
import ReactDOM from 'react-dom';
import { T } from '../../theme/tokens';

type DialogProps = {
    /** Cómo se anuncia el diálogo a un lector de pantalla. */
    label: string;
    /** `alertdialog` cuando lo que se pregunta no se puede deshacer. */
    role?: 'dialog' | 'alertdialog';
    /** Ancho máximo del panel, en píxeles. */
    width?: number;
    /** Alto máximo; el contenido pasa a desplazarse cuando no cabe. */
    maxHeight?: string;
    /**
     * Apila el contenido en columna, para que solo se desplace el cuerpo y la
     * cabecera y el pie se queden fijos.
     */
    column?: boolean;
    /** Por encima de otro diálogo (el de un lote sobre la barra de selección). */
    zIndex?: number;
    padding?: number;
    /**
     * Si pulsar el fondo cierra. Se pone a `false` mientras hay algo en vuelo:
     * cerrar la caja no cancelaría la petición, solo la escondería.
     */
    dismissable?: boolean;
    onClose: () => void;
    children: ReactNode;
};

export function Dialog({
    label, role = 'dialog', width = 420, maxHeight, column,
    zIndex = 10000, padding = 20, dismissable = true, onClose, children
}: DialogProps) {
    useEffect(() => {
        // En `window` y no en el contenedor de React a propósito: así un campo
        // de dentro puede quedarse el Escape (parando la propagación) para
        // limpiar lo que se estaba escribiendo sin cerrar la caja entera.
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    return ReactDOM.createPortal(
        <div
            // Solo cierra si el clic cae en el fondo. Comparar el objetivo con
            // el propio elemento evita tener que parar la propagación dentro
            // del panel, que es lo que obligaba a colgarle un manejador de
            // ratón al contenedor con `role="dialog"`.
            onClick={(e) => { if (dismissable && e.target === e.currentTarget) onClose(); }}
            style={{
                position: 'fixed', inset: 0, zIndex,
                background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24
            }}
        >
            <div
                role={role}
                aria-modal='true'
                aria-label={label}
                style={{
                    width: `min(${width}px, 100%)`, maxHeight,
                    overflowY: column ? undefined : 'auto',
                    display: column ? 'flex' : undefined,
                    flexDirection: column ? 'column' : undefined,
                    background: 'rgba(18,18,20,0.98)', borderRadius: 14,
                    border: '1px solid rgba(255,255,255,0.12)',
                    boxShadow: '0 18px 50px rgba(0,0,0,0.6)',
                    padding, fontFamily: T.ui, color: '#fff'
                }}
            >
                {children}
            </div>
        </div>,
        document.body
    );
}

/** Título de la caja y, a la derecha, la salida. */
export function DialogHeader({
    title, subtitle, onClose
}: {
    title: string;
    /** Sobre qué se está actuando: el título del item, cuántos van en el lote. */
    subtitle?: ReactNode;
    onClose: () => void;
}) {
    return (
        <div style={{ flexShrink: 0 }}>
            <div style={{
                display: 'flex', alignItems: 'center', marginBottom: subtitle ? 4 : 16
            }}>
                <div style={{ fontSize: 15, fontWeight: 500 }}>{title}</div>
                <button
                    onClick={onClose}
                    aria-label={globalize.translate('ButtonClose')}
                    style={{
                        marginLeft: 'auto', background: 'none', border: 'none',
                        color: T.dim, cursor: 'pointer', fontSize: 18, lineHeight: 1
                    }}
                >×</button>
            </div>
            {subtitle != null && (
                <div style={{
                    fontSize: 12, color: T.dim, marginBottom: 16,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                }}>
                    {subtitle}
                </div>
            )}
        </div>
    );
}

/** Lo que se queda abajo, separado por una línea: crear, guardar, aplicar. */
export function DialogFooter({ children }: { children: ReactNode }) {
    return (
        <div style={{
            paddingTop: 12, flexShrink: 0,
            borderTop: '1px solid rgba(255,255,255,0.08)'
        }}>
            {children}
        </div>
    );
}

/**
 * El campo y su botón, que es como se crea o se añade en casi todas estas
 * cajas. El campo se lleva el hueco que sobra y el botón conserva el suyo:
 * es texto corto y encogerlo lo partiría en dos líneas.
 */
export function DialogInputRow({ field, action }: { field: ReactNode; action: ReactNode }) {
    return (
        <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1, minWidth: 0 }}>{field}</div>
            {action}
        </div>
    );
}

type RowProps = {
    /** Portada de la lista; sin ella queda el hueco gris, no un salto. */
    image?: string;
    name: string;
    /** Cuántos títulos tiene. */
    count?: number;
    /**
     * Con valor, la fila es una casilla y se pinta marcada o no. Sin él es un
     * botón: pulsarla hace algo y se acabó.
     */
    checked?: boolean;
    /** Hay una petición en vuelo — en esta fila o en otra. */
    busy?: boolean;
    /** En vuelo pero en OTRA fila: esta se apaga para señalar cuál se movió. */
    dimmed?: boolean;
    onClick: () => void;
};

/** Una lista dentro de un diálogo: su portada, su nombre y cuánto tiene. */
export function DialogRow({ image, name, count, checked, busy, dimmed, onClick }: RowProps) {
    return (
        <button
            role={checked === undefined ? undefined : 'checkbox'}
            aria-checked={checked}
            disabled={busy}
            onClick={onClick}
            style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '9px 10px', borderRadius: 8,
                background: 'none', border: 'none', color: '#fff',
                cursor: busy ? 'wait' : 'pointer', textAlign: 'left',
                fontFamily: T.ui, fontSize: 14, transition: 'background .15s',
                opacity: dimmed ? 0.5 : 1
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
            {checked !== undefined && (
                <span style={{
                    flexShrink: 0, width: 20, height: 20, borderRadius: 4,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: checked ? '#fff' : 'transparent',
                    border: checked ? 'none' : '2px solid rgba(255,255,255,0.35)',
                    color: '#000', fontSize: 13, lineHeight: 1
                }}>
                    {checked ? '✓' : ''}
                </span>
            )}
            <div style={{
                width: 40, height: 40, borderRadius: 6, flexShrink: 0,
                background: image ? `url(${image}) center/cover` : 'rgba(255,255,255,0.08)'
            }} />
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {name}
                </div>
                {count != null && (
                    <div style={{ fontSize: 12, color: T.dim }}>
                        {globalize.translate('ItemCount', count)}
                    </div>
                )}
            </div>
        </button>
    );
}
