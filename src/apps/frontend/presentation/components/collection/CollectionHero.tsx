import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { useResponsive } from '../../theme/responsive';
import { T } from '../../theme/tokens';
import { ListCardMenu, type ListMenuHandle } from '../controls/menus/ListCardMenu';
import { COLLECTION_STYLES, type ListRef } from '../../../domain/stores';
import { CollectionCardCarousel } from './CollectionCardCarousel';
import { SubCollectionsCarousel } from './SubCollectionsCarousel';

import { imageUrl, type PlaylistItem } from '../../../domain/api';
import { analyzeImage } from '../../theme/dynamicColor';
import { logger } from '../../../shared/logger';
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
        }).catch((e) => {
            logger.debug('Error analyzing backdrop image', e);
        });
        return () => { active = false; };
    }, [currentBackdrop]);

    const internalMenu = useRef<ListMenuHandle | null>(null);
    const activeMenu = menuRef ?? internalMenu;

    return (
        <section
            className='collectionHero'
            onContextMenu={(e) => {
                e.preventDefault();
                activeMenu.current?.openAt(e.clientX, e.clientY);
            }}
            style={{
                position: 'relative',
                width: '100%',
                minHeight: '100vh',
                backgroundColor: '#000000',
                '--bg-dynamic': bgDynamic,
                userSelect: 'none',
                boxSizing: 'border-box'
            } as React.CSSProperties}
        >
            {/* 1. Hero Header con imagen, tratamiento multicapa y logo centrado */}
            <div
                style={{
                    position: 'relative',
                    width: '100%',
                    height: r.touch ? '54vh' : '64vh',
                    minHeight: r.touch ? 360 : 480,
                    maxHeight: r.touch ? 480 : 680,
                    overflow: 'hidden',
                    backgroundColor: '#000000'
                }}
            >
                {currentBackdrop && (
                    <div
                        style={{
                            position: 'absolute',
                            inset: 0,
                            zIndex: 0,
                            overflow: 'hidden',
                            pointerEvents: 'none'
                        }}
                    >
                        <img
                            key={currentBackdrop}
                            src={currentBackdrop}
                            alt=''
                            onError={() => {
                                setBackdropIndex((prev) => (prev + 1 < backdropCandidates.length ? prev + 1 : prev));
                            }}
                            style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                                objectPosition: 'center 22%',
                                display: 'block'
                            }}
                        />

                        {/* Atenuación sutil general para imágenes con zonas muy claras */}
                        <div
                            style={{
                                position: 'absolute',
                                inset: 0,
                                backgroundColor: 'rgba(0, 0, 0, 0.20)',
                                pointerEvents: 'none'
                            }}
                        />

                        {/* Scrim superior para navegación */}
                        <div
                            style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                right: 0,
                                height: 140,
                                background: 'linear-gradient(to bottom, rgba(0, 0, 0, 0.85) 0%, rgba(0, 0, 0, 0.40) 50%, transparent 100%)',
                                pointerEvents: 'none'
                            }}
                        />

                        {/* Viñeteado lateral suave */}
                        <div
                            style={{
                                position: 'absolute',
                                inset: 0,
                                background: 'linear-gradient(to right, rgba(0, 0, 0, 0.42) 0%, transparent 18%, transparent 82%, rgba(0, 0, 0, 0.42) 100%)',
                                pointerEvents: 'none'
                            }}
                        />

                        {/* Veladura radial centrada detrás del logo para legibilidad sin franjas duras */}
                        <div
                            style={{
                                position: 'absolute',
                                inset: 0,
                                background: 'radial-gradient(ellipse 70% 55% at 50% 45%, rgba(0, 0, 0, 0.35) 0%, transparent 75%)',
                                pointerEvents: 'none'
                            }}
                        />

                        {/* Transición larga y suave hacia el fondo negro sin línea dura detrás del logo */}
                        <div
                            style={{
                                position: 'absolute',
                                inset: 0,
                                background: 'linear-gradient(to bottom, transparent 0%, transparent 28%, rgba(0, 0, 0, 0.02) 36%, rgba(0, 0, 0, 0.08) 46%, rgba(0, 0, 0, 0.20) 56%, rgba(0, 0, 0, 0.40) 68%, rgba(0, 0, 0, 0.70) 80%, rgba(0, 0, 0, 0.92) 92%, #000000 100%)',
                                pointerEvents: 'none'
                            }}
                        />
                    </div>
                )}

                {/* Logo oficial o título centrado visualmente en el hero */}
                <div
                    style={{
                        position: 'absolute',
                        inset: 0,
                        zIndex: 2,
                        display: 'flex',
                        alignItems: 'flex-end',
                        justifyContent: 'center',
                        padding: r.touch ? '0 24px 12px' : '0 48px 20px',
                        pointerEvents: 'none',
                        boxSizing: 'border-box'
                    }}
                >
                    {currentLogo ? (
                        <img
                            key={currentLogo}
                            src={currentLogo}
                            alt={list?.name || ''}
                            onError={() => {
                                setLogoIndex((prev) => (prev + 1 < logoCandidates.length ? prev + 1 : prev));
                            }}
                            style={{
                                width: r.touch ? '55vw' : '38vw',
                                maxWidth: 530,
                                maxHeight: r.touch ? 85 : 176,
                                height: 'auto',
                                objectFit: 'contain',
                                filter: 'drop-shadow(0 8px 32px rgba(0,0,0,0.85)) drop-shadow(0 2px 8px rgba(0,0,0,0.65))'
                            }}
                        />
                    ) : (
                        <div
                            style={{
                                fontFamily: T.ui,
                                fontSize: r.touch ? 32 : 46,
                                fontWeight: 800,
                                color: '#ffffff',
                                letterSpacing: 1.5,
                                textTransform: 'uppercase',
                                textShadow: '0 4px 28px rgba(0,0,0,0.9)',
                                textAlign: 'center',
                                maxWidth: '90%'
                            }}
                        >
                            {list?.name}
                        </div>
                    )}
                </div>
            </div>

            {/* 2. Carruseles en el flujo normal de la página, inmediatamente después del hero */}
            {hasItems && (
                <div
                    style={{
                        position: 'relative',
                        zIndex: 3,
                        width: '100%',
                        paddingLeft: r.touch ? 16 : '5vw',
                        paddingRight: r.touch ? 16 : '5vw',
                        paddingTop: r.touch ? 12 : 20,
                        paddingBottom: r.touch ? 'calc(var(--jfp-nav-bottom, 72px) + 32px)' : 64,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: r.touch ? 28 : 44,
                        boxSizing: 'border-box'
                    }}
                >
                    {mediaItems.length > 0 && (
                        <div>
                            <CollectionCardCarousel listId={listId} items={mediaItems} navigate={navigate} />
                        </div>
                    )}
                    {collectionItems.length > 0 && (
                        <div>
                            <SubCollectionsCarousel items={collectionItems} navigate={navigate} listId={listId} />
                        </div>
                    )}
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
