import globalize from 'lib/globalize';

import { useEffect, useImperativeHandle, useRef, useState, type RefObject } from 'react';
import { T } from '../../theme/tokens';
import { Ic } from '../../theme/icons';
import { useToast } from '../toast/ToastProvider';
import { LISTS, type ListKind } from '../../../domain/stores';
import { PopupPanel } from './PopupPanel';
import { MenuEntry } from './MenuEntry';
import { AddToDialog } from './AddToDialog';
import { ConfirmDialog } from './ConfirmDialog';

// Los tres puntos de una lista: en la esquina de su tarjeta del índice y en el
// hero de la propia lista. De momento solo llevan el fondo: subir una imagen,
// ponerla por URL o volver a la portada automática (la del último título
// añadido).
//
// El menú va en un portal con posición fija porque la tarjeta recorta lo que
// se sale (`overflow: hidden`), que es lo que le da las esquinas redondeadas.

/** Para abrirlo desde fuera: el clic derecho sobre el hero de la lista. */
export type ListMenuHandle = { openAt: (x: number, y: number) => void };

type Props = {
    kind: ListKind;
    listId: string;
    onChanged: () => void;
    onDeleted?: () => void;
    /** Diámetro del botón: en el hero se pinta más grande que en la tarjeta. */
    size?: number;
    /** Sin botón visible: solo lo abre quien tenga el `handle`. */
    hideTrigger?: boolean;
    handle?: RefObject<ListMenuHandle | null>;
};

const MENU_W = 230;
const MENU_H = 190;
const GAP = 8;

export function ListCardMenu({
    kind, listId, onChanged, onDeleted, size = 26, hideTrigger, handle
}: Props) {
    const toast = useToast();
    const btnRef = useRef<HTMLButtonElement>(null);
    const fileRef = useRef<HTMLInputElement>(null);
    const [open, setOpen] = useState(false);
    const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
    const [busy, setBusy] = useState(false);
    const [askingUrl, setAskingUrl] = useState(false);
    const [url, setUrl] = useState('');
    const [addTo, setAddTo] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const custom = LISTS.hasCustomCover(kind, listId);

    // Cerrar al hacer scroll o resize: el menú va en posición fija y
    // se quedaría flotando lejos de su tarjeta.
    useEffect(() => {
        if (!open) return;
        const close = () => setOpen(false);
        window.addEventListener('scroll', close, true);
        window.addEventListener('resize', close);
        return () => {
            window.removeEventListener('scroll', close, true);
            window.removeEventListener('resize', close);
        };
    }, [open]);

    /** Abre el menú donde se ha pulsado, para el clic derecho sobre el hero. */
    const openAt = (x: number, y: number) => {
        const dropUp = y + MENU_H + GAP > window.innerHeight;
        setPos({
            top: dropUp ? Math.max(GAP, y - MENU_H - GAP) : y + GAP,
            // Se voltea al otro lado del cursor si no cabe a la derecha.
            left: Math.min(x, window.innerWidth - MENU_W - 12)
        });
        setAskingUrl(false);
        setUrl('');
        setOpen(true);
    };

    useImperativeHandle(handle, () => ({ openAt }));

    const toggleMenu = () => {
        if (open) {
            setOpen(false);
            return;
        }
        const rect = btnRef.current?.getBoundingClientRect();
        if (rect) {
            const dropUp = rect.bottom + MENU_H + GAP > window.innerHeight;
            setPos({
                top: dropUp ? rect.top - MENU_H - GAP : rect.bottom + GAP,
                left: Math.min(rect.right - MENU_W, window.innerWidth - MENU_W - 12)
            });
        }
        setAskingUrl(false);
        setUrl('');
        setOpen(true);
    };

    const apply = async (fn: () => Promise<void>, ok: string) => {
        setBusy(true);
        try {
            await fn();
            toast(ok, 'success');
            setOpen(false);
            onChanged();
        } catch (e) {
            toast((e as Error).message, 'warn');
        } finally {
            setBusy(false);
        }
    };

    const setFromFile = (file: File) => {
        void apply(
            () => LISTS.setCover(kind, listId, file),
            globalize.translate('MessageCoverUpdated')
        );
    };

    const setFromUrl = () => {
        const clean = url.trim();
        if (!clean) return;
        void apply(
            () => LISTS.setCover(kind, listId, clean),
            globalize.translate('MessageCoverUpdated')
        );
    };

    const clear = () => {
        void apply(
            () => LISTS.clearCover(kind, listId),
            globalize.translate('MessageCoverCleared')
        );
    };

    return (
        <>
            <input
                ref={fileRef}
                type='file'
                accept='image/*'
                hidden
                onChange={(e) => {
                    const file = e.target.files?.[0];
                    // Se limpia el input para que elegir el MISMO fichero otra
                    // vez vuelva a disparar el change.
                    e.target.value = '';
                    if (file) setFromFile(file);
                }}
            />
            {/* Sin renderizarlo, y no con `hidden`: el `display: flex` de aquí
                abajo va en línea y le ganaría a la hoja del navegador, así que
                el botón se seguiría viendo. */}
            {!hideTrigger && (
                <button
                    ref={btnRef}
                    // La tarjeta entera es un botón que navega: sin parar aquí,
                    // el clic en los puntos abriría la lista además del menú.
                    onClick={(e) => { e.stopPropagation(); toggleMenu(); }}
                    onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                    aria-label={globalize.translate('LabelCoverImage')}
                    aria-haspopup='menu'
                    style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        width: size, height: size, borderRadius: '50%',
                        background: 'rgba(0,0,0,0.45)', border: 'none',
                        color: 'rgba(255,255,255,0.85)', cursor: 'pointer', padding: 0
                    }}
                >
                    <Ic.Dots size={Math.round(size * 0.58)} />
                </button>
            )}

            <PopupPanel
                open={open}
                onClose={() => setOpen(false)}
                position={pos}
                width={MENU_W}
            >
                <div style={{
                    fontSize: 10, letterSpacing: 2, textTransform: 'uppercase',
                    color: T.dim, padding: '6px 10px 8px'
                }}>
                    {globalize.translate('LabelCoverImage')}
                </div>
                {askingUrl ? (
                    <div style={{ padding: '0 6px 6px' }}>
                        <input
                            autoFocus
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') setFromUrl();
                                if (e.key === 'Escape') setAskingUrl(false);
                            }}
                            placeholder='https://…'
                            style={{
                                width: '100%', boxSizing: 'border-box',
                                background: 'rgba(255,255,255,0.06)', color: '#fff',
                                border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8,
                                padding: '8px 10px', fontFamily: T.ui, fontSize: 12,
                                outline: 'none', marginBottom: 6
                            }}
                        />
                        <button
                            disabled={busy || !url.trim()}
                            onClick={setFromUrl}
                            style={{
                                width: '100%', padding: '8px 12px', borderRadius: 8,
                                border: 'none',
                                background: url.trim() ? '#fff' : 'rgba(255,255,255,0.15)',
                                color: url.trim() ? '#000' : T.dim,
                                fontFamily: T.ui, fontSize: 12, fontWeight: 600,
                                cursor: busy || !url.trim() ? 'default' : 'pointer'
                            }}
                        >
                            {globalize.translate('Save')}
                        </button>
                    </div>
                ) : (
                    <>
                        <MenuEntry disabled={busy} onClick={() => fileRef.current?.click()}>
                            {globalize.translate('HeaderUploadImage')}
                        </MenuEntry>
                        <MenuEntry disabled={busy} onClick={() => setAskingUrl(true)}>
                            {globalize.translate('LabelImageUrl')}
                        </MenuEntry>
                        {custom && (
                            <MenuEntry disabled={busy} onClick={clear}>
                                {globalize.translate('MessageCoverCleared')}
                            </MenuEntry>
                        )}
                        {kind === 'collection' && (
                            <>
                                <div style={{ height: 1, background: T.hairline, margin: '4px 0' }} />
                                <MenuEntry disabled={busy} onClick={() => { setOpen(false); setAddTo(true); }}>
                                    {globalize.translate('AddToCollection')}
                                </MenuEntry>
                            </>
                        )}
                        <div style={{ height: 1, background: T.hairline, margin: '4px 0' }} />
                        <MenuEntry
                            danger
                            disabled={busy}
                            onClick={() => { setOpen(false); setConfirmDelete(true); }}
                        >
                            {globalize.translate(kind === 'collection' ? 'HeaderDeleteCollection' : 'HeaderDeletePlaylist')}
                        </MenuEntry>
                    </>
                )}
            </PopupPanel>

            {addTo && (
                <AddToDialog
                    kind='collection'
                    itemId={listId}
                    onClose={() => { setAddTo(false); onChanged(); }}
                />
            )}

            {confirmDelete && (
                <ConfirmDialog
                    title={globalize.translate(kind === 'collection' ? 'HeaderDeleteCollection' : 'HeaderDeletePlaylist')}
                    message={globalize.translate(kind === 'collection' ? 'ConfirmDeleteCollection' : 'ConfirmDeletePlaylist')}
                    confirmLabel={globalize.translate('Delete')}
                    onConfirm={async () => {
                        await LISTS.delete(kind, listId);
                        toast(globalize.translate('Delete'), 'success');
                        if (onDeleted) onDeleted();
                        else onChanged();
                    }}
                    onClose={() => setConfirmDelete(false)}
                />
            )}
        </>
    );
}

