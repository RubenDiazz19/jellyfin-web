import globalize from 'lib/globalize';

import React from 'react';
import { T } from '../../../theme/tokens';
import { ConfirmDeleteButton } from './primitives';

/**
 * Una miniatura de fondo, con lo que se puede hacer con ella.
 *
 * Se reordena de dos maneras a propósito. Arrastrar es lo que se espera de una
 * fila de imágenes, pero no existe para quien va por teclado y es incómodo con
 * muchas: por eso hay además dos flechas, que aparecen al pasar por encima o al
 * llegar el foco. Entre ellas, la posición — que es lo que de verdad se está
 * editando, porque el primero es el que se ve al abrir la ficha.
 */
export function BackdropTile({
    src, position, total, active, dragging, dropTarget, busy,
    onActivate, onMove, onDragStart, onDragEnter, onDragEnd, onDrop, onDelete
}: {
    src: string;
    position: number;
    total: number;
    active: boolean;
    dragging: boolean;
    dropTarget: boolean;
    busy: boolean;
    onActivate: (on: boolean) => void;
    onMove: (to: number) => void;
    onDragStart: () => void;
    onDragEnter: () => void;
    onDragEnd: () => void;
    onDrop: () => void;
    onDelete: () => Promise<void>;
}) {
    return (
        <div
            draggable={!busy}
            onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; onDragStart(); }}
            onDragEnter={onDragEnter}
            // Sin este preventDefault el navegador no considera el elemento un
            // destino válido y nunca llega el drop.
            onDragOver={(e) => e.preventDefault()}
            onDragEnd={onDragEnd}
            onDrop={(e) => { e.preventDefault(); onDrop(); }}
            onMouseEnter={() => onActivate(true)}
            onMouseLeave={() => onActivate(false)}
            onFocusCapture={() => onActivate(true)}
            onBlurCapture={(e) => {
                // Solo se apaga si el foco sale del tile entero, no al saltar
                // de una de sus flechas a la otra.
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) onActivate(false);
            }}
            style={{
                position: 'relative', borderRadius: 6,
                cursor: busy ? 'wait' : 'grab',
                opacity: dragging ? 0.35 : 1,
                outline: dropTarget ? '2px solid #fff' : '2px solid transparent',
                outlineOffset: 2,
                transition: 'opacity .15s, outline-color .15s'
            }}
        >
            <div style={{
                width: 220, aspectRatio: '16/9', borderRadius: 6,
                backgroundImage: `url(${src})`,
                backgroundSize: 'cover', backgroundPosition: 'center',
                border: '1px solid rgba(255,255,255,0.08)'
            }} />

            <div style={{
                position: 'absolute', left: 0, right: 0, bottom: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                padding: '8px 0', borderRadius: '0 0 6px 6px',
                background: 'linear-gradient(transparent, rgba(0,0,0,0.75))',
                opacity: active ? 1 : 0,
                // Invisible no debe seguir siendo clicable, ni por ratón ni
                // por teclado: de ahí el visibility además del opacity.
                visibility: active ? 'visible' : 'hidden',
                transition: 'opacity .15s'
            }}>
                <MoveArrow
                    label={globalize.translate('MoveLeft')}
                    atEnd={position === 0}
                    busy={busy}
                    onClick={() => onMove(position - 1)}
                >‹</MoveArrow>
                <span style={{ fontFamily: T.ui, fontSize: 11, color: '#fff', letterSpacing: 1 }}>
                    {position + 1}/{total}
                </span>
                <MoveArrow
                    label={globalize.translate('MoveRight')}
                    atEnd={position === total - 1}
                    busy={busy}
                    onClick={() => onMove(position + 1)}
                >›</MoveArrow>
            </div>

            <ConfirmDeleteButton
                onConfirm={onDelete}
                idleLabel={globalize.translate('Delete')}
                confirmLabel={globalize.translate('ConfirmDeleteImage')}
            />
        </div>
    );
}

function MoveArrow({ label, atEnd, busy, onClick, children }: {
    label: string;
    /** Ya está en ese extremo: no hay adónde seguir moviéndolo. */
    atEnd: boolean;
    busy: boolean;
    onClick: () => void;
    children: React.ReactNode;
}) {
    return (
        <button
            onClick={onClick}
            disabled={atEnd || busy}
            aria-label={label}
            title={label}
            style={{
                width: 24, height: 24, borderRadius: '50%', padding: 0,
                background: 'rgba(255,255,255,0.12)', color: '#fff',
                border: '1px solid rgba(255,255,255,0.2)',
                fontSize: 13, lineHeight: 1, cursor: 'pointer',
                // Apagada cuando ya está en el extremo: la posición se sigue
                // leyendo, pero se ve que por ahí no se puede seguir.
                opacity: atEnd ? 0.3 : 1
            }}
        >{children}</button>
    );
}
