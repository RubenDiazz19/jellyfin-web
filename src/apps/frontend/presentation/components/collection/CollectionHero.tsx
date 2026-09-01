import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { useResponsive } from '../../theme/responsive';
import { ListCardMenu, type ListMenuHandle } from '../controls/ListCardMenu';
import { COLLECTION_STYLES, type ListRef } from '../../../domain/stores';
import { imageUrl } from '../../../domain/api';
import type { Navigate } from '../../../app/router';

type Props = {
    listId: string;
    list: ListRef | undefined;
    ancestors?: Array<{ id: string; name: string }>;
    fallbackBackdrop?: string;
    navigate: Navigate;
    onChanged: () => void;
    menuRef?: RefObject<ListMenuHandle | null>;
};

/**
 * Vista inmersiva limpia para una colección:
 * - Muestra la imagen completa ocupando el 100% de la pantalla sin degradados negros ni textos.
 * - Muestra el logo oficial centrado sobre la imagen.
 * - Admite clic derecho en cualquier punto para editar la colección (subir fondo, logo, cambiar datos).
 */
export function CollectionHero({
    listId,
    list,
    fallbackBackdrop,
    navigate,
    onChanged,
    menuRef
}: Props) {
    const r = useResponsive();
    const internalMenu = useRef<ListMenuHandle | null>(null);
    const activeMenu = menuRef ?? internalMenu;

    const [styleState, setStyleState] = useState(() => ({
        color: COLLECTION_STYLES.getColor(listId),
        customBackdrop: COLLECTION_STYLES.getBackdrop(listId),
        customLogo: COLLECTION_STYLES.getLogo(listId),
        version: COLLECTION_STYLES.getVersion(listId)
    }));

    useEffect(() => {
        const onStyleChange = () => setStyleState({
            color: COLLECTION_STYLES.getColor(listId),
            customBackdrop: COLLECTION_STYLES.getBackdrop(listId),
            customLogo: COLLECTION_STYLES.getLogo(listId),
            version: COLLECTION_STYLES.getVersion(listId)
        });
        window.addEventListener(COLLECTION_STYLES.event, onStyleChange);
        return () => window.removeEventListener(COLLECTION_STYLES.event, onStyleChange);
    }, [listId]);

    // Candidatos para la imagen de fondo en orden de prioridad
    const backdropCandidates = useMemo(() => {
        const v = styleState.version;
        const directBackdrop = imageUrl(listId, 'Backdrop', { maxWidth: 1920 }) ? `${imageUrl(listId, 'Backdrop', { maxWidth: 1920 })}&v=${v || 1}` : undefined;
        const directPrimary = imageUrl(listId, 'Primary', { maxWidth: 1920 }) ? `${imageUrl(listId, 'Primary', { maxWidth: 1920 })}&v=${v || 1}` : undefined;

        return [
            styleState.customBackdrop,
            directBackdrop,
            directPrimary,
            list?.heroImage,
            list?.backdrop,
            list?.image,
            fallbackBackdrop
        ].filter(Boolean) as string[];
    }, [listId, styleState.customBackdrop, styleState.version, list?.heroImage, list?.backdrop, list?.image, fallbackBackdrop]);

    const [backdropIndex, setBackdropIndex] = useState(0);

    // Si cambia la lista de candidatos o suben nueva versión, volver al primer candidato
    useEffect(() => {
        setBackdropIndex(0);
    }, [backdropCandidates]);

    const currentBackdrop = backdropCandidates[backdropIndex] || backdropCandidates[0];

    // Candidatos para el logo
    const logoCandidates = useMemo(() => {
        const v = styleState.version;
        const directLogo = imageUrl(listId, 'Logo', { maxHeight: 360 }) ? `${imageUrl(listId, 'Logo', { maxHeight: 360 })}&v=${v || 1}` : undefined;
        return [
            styleState.customLogo,
            directLogo,
            list?.logo
        ].filter(Boolean) as string[];
    }, [listId, styleState.customLogo, styleState.version, list?.logo]);

    const [logoIndex, setLogoIndex] = useState(0);
    useEffect(() => {
        setLogoIndex(0);
    }, [logoCandidates]);

    const currentLogo = logoCandidates[logoIndex];

    return (
        <section
            className='collectionHero'
            onContextMenu={(e) => {
                e.preventDefault();
                activeMenu.current?.openAt(e.clientX, e.clientY);
            }}
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100vw',
                height: '100vh',
                overflow: 'hidden',
                backgroundColor: styleState.color ?? '#000000',
                userSelect: 'none',
                zIndex: 0
            }}
        >
            {/* 1. Imagen a pantalla completa pura (sin degradados oscuros ni recortes) */}
            {currentBackdrop && (
                <img
                    key={currentBackdrop}
                    src={currentBackdrop}
                    alt=''
                    onError={() => {
                        // Si falla la imagen actual (ej. 404 del Backdrop), probar el siguiente candidato
                        setBackdropIndex((prev) => (prev + 1 < backdropCandidates.length ? prev + 1 : prev));
                    }}
                    style={{
                        position: 'absolute',
                        inset: 0,
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        objectPosition: 'center top',
                        display: 'block'
                    }}
                />
            )}

            {/* 2. Logo oficial centrado sobre la imagen (sin textos de título ni subtítulo) */}
            {currentLogo && (
                <div
                    style={{
                        position: 'absolute',
                        top: r.touch ? '50%' : '52%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        zIndex: 2,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        pointerEvents: 'none'
                    }}
                >
                    <img
                        key={currentLogo}
                        src={currentLogo}
                        alt=''
                        onError={() => {
                            setLogoIndex((prev) => (prev + 1 < logoCandidates.length ? prev + 1 : prev));
                        }}
                        style={{
                            width: r.touch ? '65vw' : '32vw',
                            maxWidth: 440,
                            maxHeight: r.touch ? '20vh' : '26vh',
                            objectFit: 'contain',
                            filter: 'drop-shadow(0 8px 24px rgba(0,0,0,0.85))'
                        }}
                    />
                </div>
            )}

            {/* Menú contextual (clic derecho en cualquier parte) */}
            <ListCardMenu
                hideTrigger
                kind='collection'
                listId={listId}
                title={list?.name}
                logo={currentLogo}
                handle={activeMenu}
                onChanged={onChanged}
                onDeleted={() => navigate({ page: 'lists' })}
                size={32}
            />
        </section>
    );
}
