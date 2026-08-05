// La fila de acciones del hero de una ficha: el botón grande de reproducir,
// «añadir a lista» y el menú de opciones.
//
// Serie y película dicen cosas distintas en el botón —una habla de episodios y
// la otra de minutos— pero el botón en sí es el mismo: una píldora que se
// invierte a blanco cuando el título está visto y que, a medias, se rellena
// hasta donde va la reproducción.

import { useState, type ReactNode } from 'react';
import { Ic } from '../../theme/icons';
import { T } from '../../theme/tokens';
import { useResponsive } from '../../theme/responsive';

type ButtonProps = {
    onClick: () => void;
    /**
     * El puntero (o el foco) ha llegado al botón. Sirve para adelantar
     * trabajo que se va a necesitar en cuanto lo pulsen: quien lo usa es el
     * pre-calentamiento del reproductor.
     */
    onHover?: () => void;
    /** Título terminado: el botón se invierte y el icono pasa a ser un tick. */
    complete: boolean;
    /** Progreso 0..1 que rellena el fondo; 0 = sin relleno. */
    progress?: number;
    /** Qué dice el botón. Recibe si el ratón está encima. */
    label: (hover: boolean) => ReactNode;
};

export function HeroPlayButton({ onClick, onHover, complete, progress = 0, label }: ButtonProps) {
    const [hover, setHover] = useState(false);
    const inProgress = progress > 0 && progress < 1;
    return (
        <button
            onClick={onClick}
            // Mismo motivo que PlayBtn: sin bloquear el focus nativo, Chrome
            // scrollea unos px al pulsar (el botón vive en el hero 100vh con
            // flex-end) y el mouseup cae fuera → el click no dispara a la
            // primera. preventDefault en mousedown mantiene el click intacto
            // y la accesibilidad con Tab.
            onMouseDown={(e) => e.preventDefault()}
            onMouseEnter={() => { setHover(true); onHover?.(); }}
            onMouseLeave={() => setHover(false)}
            // También al llegar con el teclado: quien navega con Tab merece el
            // mismo adelanto que quien llega con el ratón.
            onFocus={() => onHover?.()}
            style={{
                position: 'relative', overflow: 'hidden',
                display: 'flex', alignItems: 'center', gap: 10, padding: '14px 28px',
                background: complete ? '#fff' : 'transparent',
                color: complete ? '#000' : '#fff',
                border: complete ? 'none' : '1px solid rgba(255,255,255,0.4)',
                borderRadius: 999, whiteSpace: 'nowrap',
                fontFamily: T.ui, fontSize: 12, fontWeight: 600, letterSpacing: 0.3,
                cursor: 'pointer', transition: 'background .2s ease, border-color .2s ease'
            }}
        >
            {inProgress && (
                <span style={{
                    position: 'absolute', top: 0, bottom: 0, left: 0,
                    width: `${progress * 100}%`,
                    background: 'rgba(255,255,255,0.22)', pointerEvents: 'none'
                }} />
            )}
            <span style={{
                position: 'relative', zIndex: 1,
                display: 'flex', alignItems: 'center', gap: 10, whiteSpace: 'nowrap'
            }}>
                {complete ?
                    <Ic.Check size={14} stroke='#000' /> :
                    <Ic.Play size={14} fill='#fff' />}
                {label(hover)}
            </span>
        </button>
    );
}

type RowProps = {
    /** El botón grande; normalmente un `HeroPlayButton`. */
    children: ReactNode;
    /**
     * «Añadir a lista». Solo se pinta en desktop: en touch vive en el bottom
     * sheet del menú de opciones, que ahí es donde hay sitio.
     */
    myList?: ReactNode;
    more: ReactNode;
    /** La ficha de película centra la fila; la de serie la deja a la izquierda. */
    center?: boolean;
};

export function HeroActionsRow({ children, myList, more, center }: RowProps) {
    const r = useResponsive();
    return (
        <div style={{
            marginTop: r.touch ? 22 : 36,
            display: 'flex', alignItems: 'center',
            gap: r.touch ? 12 : 18, flexWrap: 'wrap',
            justifyContent: center ? 'center' : undefined
        }}>
            {children}
            {!r.touch && myList && (
                <>
                    {myList}
                    <div style={{
                        width: 1, height: 26,
                        background: 'rgba(255,255,255,0.18)', margin: '0 4px'
                    }} />
                </>
            )}
            {more}
        </div>
    );
}
