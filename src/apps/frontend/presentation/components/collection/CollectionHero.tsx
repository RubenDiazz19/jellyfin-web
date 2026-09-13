import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { useResponsive } from '../../theme/responsive';
import { ListCardMenu, type ListMenuHandle } from '../controls/ListCardMenu';
import { COLLECTION_STYLES, type ListRef } from '../../../domain/stores';
import { CollectionCardCarousel } from './CollectionCardCarousel';
import { SubCollectionsCarousel } from './SubCollectionsCarousel';
import { useCollectionScrollTransition } from './useCollectionScrollTransition';

import { imageUrl, type PlaylistItem } from '../../../domain/api';
import { analyzeImage } from '../../theme/dynamicColor';
import type { Navigate } from '../../../app/router';

type Props = {
    listId: string;
    list: ListRef | undefined;
    fallbackBackdrop?: string;
    items?: PlaylistItem[] | null;
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
    items,
    navigate,
    onChanged,
    menuRef
}: Props) {
    const r = useResponsive();
    const hasItems = !!(items && items.length > 0);

    // Separamos subcolecciones (BoxSet hijos) de películas/series
    const collectionItems = useMemo(() => items?.filter(i => i.kind === 'collection') || [], [items]);
    const mediaItems = useMemo(() => items?.filter(i => i.kind !== 'collection') || [], [items]);
    const onlyCollections = hasItems && mediaItems.length === 0 && collectionItems.length > 0;

    const internalMenu = useRef<ListMenuHandle | null>(null);
    const activeMenu = menuRef ?? internalMenu;

    const {
        scrollY,
        logoTranslateY,
        logoScale,
        headerHeight,
        backgroundBlur,
        backgroundScale,
        gradientOpacity,
        backdropOpacity,
        logoBottomFromTop
    } = useCollectionScrollTransition(r.touch, onlyCollections);

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
        const directBackdrop = imageUrl(listId, 'Backdrop', { maxWidth: 1920, index: 0 }) ? `${imageUrl(listId, 'Backdrop', { maxWidth: 1920, index: 0 })}&v=${v || 1}` : undefined;
        const directPrimary = imageUrl(listId, 'Primary', { maxWidth: 1920 }) ? `${imageUrl(listId, 'Primary', { maxWidth: 1920 })}&v=${v || 1}` : undefined;

        return [
            styleState.customBackdrop,
            directBackdrop,
            directPrimary,
            list?.backdrop,
            list?.heroImage,
            list?.image,
            fallbackBackdrop
        ].filter(Boolean) as string[];
    }, [listId, styleState.customBackdrop, styleState.version, list?.backdrop, list?.heroImage, list?.image, fallbackBackdrop]);

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

    const [bgDynamic, setBgDynamic] = useState('#050505');

    useEffect(() => {
        if (!currentBackdrop) {
            setBgDynamic('#050505');
            return;
        }
        let active = true;
        analyzeImage(currentBackdrop).then(res => {
            if (active) {
                setBgDynamic(res.seed || '#000000');
            }
        }).catch(() => {});
        return () => { active = false; };
    }, [currentBackdrop]);

    return (
        <section
            className='collectionHero'
            onContextMenu={(e) => {
                e.preventDefault();
                activeMenu.current?.openAt(e.clientX, e.clientY);
            }}
            style={{
                position: 'relative',
                top: 0,
                left: 0,
                width: '100vw',
                height: '100vh',
                overflow: 'hidden',
                backgroundColor: '#000000',
                '--bg-dynamic': bgDynamic,
                transition: 'background 0.5s ease-in-out',
                userSelect: 'none',
                zIndex: 0
            } as React.CSSProperties}
        >
            {/* 1. Imagen a pantalla completa que se recorta a encabezado al hacer scroll */}
            {currentBackdrop && (
                <div style={{
                    position: 'fixed',
                    top: 0, left: 0, right: 0,
                    height: headerHeight,
                    zIndex: 0,
                    overflow: 'hidden',
                    pointerEvents: 'none',
                    opacity: backdropOpacity,
                    willChange: 'height, opacity'
                }}>
                    <img
                        key={currentBackdrop}
                        src={currentBackdrop}
                        alt=''
                        onError={() => {
                            // Si falla la imagen actual (ej. 404 del Backdrop), probar el siguiente candidato
                            setBackdropIndex((prev) => (prev + 1 < backdropCandidates.length ? prev + 1 : prev));
                        }}
                        style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            objectPosition: 'top center',
                            display: 'block',
                            transform: `scale(${backgroundScale})`,
                            filter: `blur(${backgroundBlur}px)`,
                            transition: 'transform 0.1s ease-out, filter 0.1s ease-out'
                        }}
                    />
                </div>
            )}

            {/* 2. Capas de degradado negro dinámico */}
            {hasItems && (
                <div
                    style={{
                        position: 'fixed',
                        top: 0, left: 0, right: 0,
                        height: headerHeight,
                        background: 'linear-gradient(to bottom, transparent 35%, rgba(0,0,0, 0.8) 55%, #000000 75%, #000000 100%)',
                        pointerEvents: 'none',
                        zIndex: 1,
                        willChange: 'height'
                    }}
                />
            )}
            <div
                style={{
                    position: 'fixed',
                    top: 0, left: 0, right: 0,
                    height: headerHeight,
                    backgroundColor: `rgba(0,0,0,${Math.min(0.65, gradientOpacity)})`,
                    pointerEvents: 'none',
                    zIndex: 1,
                    transition: 'background-color 0.1s ease-out',
                    willChange: 'height'
                }}
            />

            {/* 3. Logo oficial: siempre centrado horizontalmente y pegado sobre el carrusel */}
            {currentLogo && (
                <div
                    style={{
                        position: 'fixed',
                        bottom: r.touch ? 280 : (hasItems ? (onlyCollections ? 500 : 360) : 280),
                        left: '50%',
                        transform: `translate(-50%, ${logoTranslateY}px) scale(${logoScale})`,
                        zIndex: 2,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        pointerEvents: 'none',
                        transformOrigin: 'center center',
                        willChange: 'transform'
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
                            width: r.touch ? '60vw' : '30vw',
                            maxWidth: 420,
                            maxHeight: r.touch ? '16vh' : '22vh',
                            objectFit: 'contain',
                            filter: 'drop-shadow(0 8px 24px rgba(0,0,0,0.85))'
                        }}
                    />
                </div>
            )}

            {/* 5. Carrusel de cards solapado, fijo en pantalla, traslada con el scroll y recortado bajo el logo */}
            {hasItems && (
                <div
                    style={{
                        position: 'fixed',
                        top: 0, left: 0, right: 0, bottom: 0,
                        zIndex: 4,
                        pointerEvents: 'none',
                        maskImage: `linear-gradient(to bottom, transparent 0px, transparent ${logoBottomFromTop}px, black ${logoBottomFromTop + 80}px, black 100%)`,
                        WebkitMaskImage: `linear-gradient(to bottom, transparent 0px, transparent ${logoBottomFromTop}px, black ${logoBottomFromTop + 80}px, black 100%)`
                    }}
                >
                    <div style={{
                        position: 'absolute',
                        bottom: r.touch ? 'calc(var(--jfp-nav-bottom, 72px) + 8px)' : 40,
                        left: 0,
                        right: 0,
                        paddingLeft: r.touch ? 16 : '5vw',
                        pointerEvents: 'auto',
                        transform: `translateY(${-scrollY}px)`,
                        willChange: 'transform'
                    }}>
                        {mediaItems.length > 0 ? (
                            <>
                                <CollectionCardCarousel listId={listId} items={mediaItems} navigate={navigate} />
                                {collectionItems.length > 0 && (
                                    <div style={{
                                        position: 'absolute',
                                        top: r.touch ? 'calc(100% + var(--jfp-nav-bottom, 72px) + 28px)' : 'calc(100% + 50px)',
                                        left: 0,
                                        right: 0,
                                        paddingLeft: r.touch ? 16 : '5vw',
                                        paddingRight: r.touch ? 16 : '5vw',
                                        pointerEvents: 'auto'
                                    }}>
                                        <SubCollectionsCarousel items={collectionItems} navigate={navigate} listId={listId} />
                                    </div>
                                )}
                            </>
                        ) : (
                            collectionItems.length > 0 && (
                                <SubCollectionsCarousel items={collectionItems} navigate={navigate} />
                            )
                        )}
                    </div>
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
