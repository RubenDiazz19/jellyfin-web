import {
    useImperativeHandle, useRef, useState, type RefObject
} from 'react';

import globalize from 'lib/globalize';

import { Ic } from '../../theme/icons';
import { IconButton } from './IconButton';
import { ItemMenuList, type MenuItem } from './ItemMenuList';
import { PopupPanel } from './PopupPanel';
import { BottomSheet } from '../m3/BottomSheet';
import { useResponsive } from '../../theme/responsive';
import type { SelectableItem } from '../../../domain/viewModels/SelectionViewModel';
import { useItemActions, type ItemKind } from './useItemActions';
import { buildMoreMenuItems } from './moreMenuBuilder';
import { MoreDialogs } from './MoreDialogs';

/** Permite abrir el menú desde fuera, en un punto: el clic derecho. */
export type ItemMenuHandle = { openAt: (x: number, y: number) => void };

type Props = {
    id: string;
    size?: number;
    /**
     * Sin él se pinta el botón de tres puntos. Con él, el menú existe pero
     * invisible: solo lo abre quien tenga el `handle` — así una tarjeta puede
     * ofrecer el menú por clic derecho sin llenarse de botones.
     */
    handle?: RefObject<ItemMenuHandle | null>;
    hideTrigger?: boolean;
    items?: MenuItem[];
    type?: ItemKind;
    itemTitle?: string;
    // Datos para la cola de reproducción. Sin `itemTitle` no encolamos: la
    // fila de la cola quedaría sin texto.
    queueSubtitle?: string;
    queuePoster?: string;
    // Para series: id del episodio con el que arrancar "Reproducir siguiente
    // episodio" / "Reproducir todo". Si no viene, esas opciones se ocultan.
    nextEpisodeId?: string;
    // Callback personalizado de reproducción aleatoria (para reproducir con el player propio)
    onShuffle?: () => void;
    /** Datos del item para el modo selección cuando se abre desde una tarjeta. */
    selectable?: SelectableItem;
    onSelect?: () => void;
};

// Botón "más opciones" (tres puntos) con menú flotante y editor de metadata
// integrado. Las acciones se ejecutan contra la API real de Jellyfin.
const MENU_W = 260;
/** Alto que se le supone al menú para decidir si abre hacia arriba. */
const MENU_H = 540;
const GAP = 8;

/** Dónde plantar el desplegable para que quepa en pantalla. */
type MenuPos = {
    top?: number; bottom?: number; left?: number; right?: number; maxHeight: number;
};

export function MoreButton({
    id, size = 18, items, type = 'show', itemTitle, nextEpisodeId,
    queueSubtitle, queuePoster, handle, hideTrigger, onShuffle,
    selectable, onSelect
}: Props) {
    const [open, setOpen] = useState(false);
    const [menuPos, setMenuPos] = useState<MenuPos | null>(null);
    const ref = useRef<HTMLDivElement>(null);
    const r = useResponsive();

    const actions = useItemActions({
        id,
        type,
        itemTitle,
        queueSubtitle,
        queuePoster,
        nextEpisodeId,
        selectable,
        onSelect
    });

    const openMenu = () => {
        if (open) { setOpen(false); return; }
        // En touch el menú es un bottom sheet: no hay que anclar nada.
        if (!r.touch) {
            const rect = ref.current?.getBoundingClientRect();
            // Colgando del botón, separado de él y alineado a su derecha.
            if (rect) {
                setMenuPos({
                    ...verticalPlacement(rect.bottom, rect.top, GAP),
                    right: Math.max(12, window.innerWidth - rect.right)
                });
            }
        }
        setOpen(true);
    };

    /**
     * Abre el menú donde se ha pulsado, para el clic derecho sobre una
     * tarjeta. En touch no hay clic derecho: el bottom sheet se abre igual y
     * la posición da lo mismo.
     */
    const openAt = (x: number, y: number) => {
        if (!r.touch) {
            setMenuPos({
                // Sin separación: un menú contextual sale pegado al puntero.
                ...verticalPlacement(y, y, 0),
                // Se voltea al otro lado del cursor si no cabe a la derecha.
                left: Math.min(x, window.innerWidth - MENU_W - 12)
            });
        }
        setOpen(true);
    };

    useImperativeHandle(handle, () => ({ openAt }));

    const menu = buildMoreMenuItems({
        type,
        isReal: actions.isReal,
        items,
        selectable,
        isSelected: actions.isSelected,
        canQueue: actions.canQueue,
        nextEpisodeId,
        onShuffle,
        toast: actions.toast,
        doPlay: actions.doPlay,
        doPlayNextEpisode: actions.doPlayNextEpisode,
        doQueue: actions.doQueue,
        openNative: actions.openNative,
        doDownload: actions.doDownload,
        doSelect: actions.doSelect,
        setEditor: actions.setEditor,
        setAddTo: actions.setAddTo,
        setConfirmDelete: actions.setConfirmDelete
    });

    const close = () => setOpen(false);

    return (
        <div ref={ref} style={{ position: 'relative', display: 'inline-flex' }}>
            {!hideTrigger && (
                <IconButton onClick={openMenu} ariaLabel={globalize.translate('ButtonMore')} active={open}>
                    <Ic.Dots size={size} />
                </IconButton>
            )}
            {/* Touch: bottom sheet M3 (spec 4.3). Desktop: popup anclado. */}
            {open && r.touch && (
                <BottomSheet title={itemTitle} onClose={close}>
                    <ItemMenuList items={menu} sheet onPick={close} />
                </BottomSheet>
            )}
            {open && !r.touch && menuPos && (
                <PopupPanel
                    open={open}
                    onClose={close}
                    position={menuPos}
                    minWidth={MENU_W}
                >
                    <ItemMenuList items={menu} onPick={close} />
                </PopupPanel>
            )}

            <MoreDialogs
                id={id}
                type={type}
                itemTitle={itemTitle}
                editor={actions.editor}
                onCloseEditor={() => actions.setEditor(null)}
                addTo={actions.addTo}
                onCloseAddTo={() => actions.setAddTo(null)}
                refreshOpen={actions.refreshOpen}
                onCloseRefresh={() => actions.setRefreshOpen(false)}
                onRefresh={actions.doRefresh}
                tagsOpen={actions.tagsOpen}
                onCloseTags={() => actions.setTagsOpen(false)}
                confirmDelete={actions.confirmDelete}
                onCloseConfirmDelete={() => actions.setConfirmDelete(false)}
                onDelete={actions.doDelete}
            />
        </div>
    );
}

/**
 * Si el menú cae del borde inferior, se ancla por arriba y crece hacia el
 * otro lado. `below` es desde dónde colgaría y `above` hasta dónde llegaría
 * al voltearse: son el mismo punto en el clic derecho y los dos bordes del
 * botón cuando cuelga de él.
 */
function verticalPlacement(below: number, above: number, gap: number): Omit<MenuPos, 'left' | 'right'> {
    const dropUp = below + MENU_H + gap > window.innerHeight;
    return {
        top: dropUp ? undefined : below + gap,
        bottom: dropUp ? window.innerHeight - above + gap : undefined,
        maxHeight: dropUp ? above - gap - 12 : window.innerHeight - below - gap - 12
    };
}
