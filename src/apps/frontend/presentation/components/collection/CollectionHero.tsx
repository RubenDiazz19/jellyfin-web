import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { useResponsive } from '../../theme/responsive';
import { ListCardMenu, type ListMenuHandle } from '../controls/ListCardMenu';
import { COLLECTION_STYLES, type ListRef } from '../../../domain/stores';
import { CollectionCardCarousel } from './CollectionCardCarousel';
import { useCollectionScrollTransition } from './useCollectionScrollTransition';
import { imageUrl, type PlaylistItem } from '../../../domain/api';
import type { Navigate } from '../../../app/router';

type Props = {
    listId: string;
    list: ListRef | undefined;
    ancestors?: Array<{ id: string; name: string }>;
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
    const trans = useCollectionScrollTransition(r.touch);
    const hasItems = !!(items && items.length > 0);
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

            {/* 1.1. Capa de oscurecimiento general del fondo vinculada al progreso del scroll para resaltar el carrusel */}
            {hasItems && (
                <div
                    style={{
                        position: 'absolute',
                        inset: 0,
                        backgroundColor: '#000000',
                        opacity: trans.progress * 0.45,
                        pointerEvents: 'none',
                        zIndex: 1,
                        willChange: 'opacity',
                        transition: 'opacity 0.1s linear'
                    }}
                />
            )}

            {/* 2. Capa de degradado negro translúcido tras el carrusel para contraste de lectura */}
            {hasItems && (
                <div
                    style={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        height: r.touch ? '380px' : '480px',
                        background: 'linear-gradient(to top, rgba(0, 0, 0, 0.94) 0%, rgba(0, 0, 0, 0.72) 48%, rgba(0, 0, 0, 0.25) 80%, transparent 100%)',
                        opacity: trans.gradientOpacity,
                        pointerEvents: 'none',
                        zIndex: 1,
                        willChange: 'opacity'
                    }}
                />
            )}

            {/* 3. Logo oficial: siempre centrado horizontalmente y pegado abajo del todo */}
            {currentLogo && (
                <div
                    style={{
                        position: 'absolute',
                        bottom: r.touch ? 'calc(var(--jfp-nav-bottom, 72px) + 38px)' : 80,
                        left: '50%',
                        transform: `translate3d(-50%, ${hasItems ? trans.logoTranslateY : 0}px, 0)`,
                        zIndex: 2,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        pointerEvents: 'none',
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

            {/* 4. Indicador de scroll: Flechas animadas apuntando hacia abajo justo debajo del logo */}
            {hasItems && (
                <div
                    onClick={trans.scrollToContent}
                    style={{
                        position: 'absolute',
                        bottom: r.touch ? 'calc(var(--jfp-nav-bottom, 72px) + 8px)' : 26,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 2,
                        cursor: 'pointer',
                        opacity: trans.scrollHintOpacity,
                        pointerEvents: trans.scrollHintOpacity > 0.05 ? 'auto' : 'none',
                        zIndex: 3,
                        transition: 'opacity 0.15s ease-out'
                    }}
                >
                    <svg
                        width='18'
                        height='18'
                        viewBox='0 0 24 24'
                        fill='none'
                        style={{
                            animation: 'jfp-arrow 1.8s ease-in-out infinite',
                            filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.85))'
                        }}
                    >
                        <path
                            d='M6 9l6 6 6-6'
                            stroke='rgba(255,255,255,0.85)'
                            strokeWidth='2'
                            strokeLinecap='round'
                            strokeLinejoin='round'
                        />
                    </svg>
                </div>
            )}

            {/* 5. Carrusel de cards por encima de los iconos de navegación en móvil/tablet */}
            {hasItems && (
                <div
                    style={{
                        position: 'absolute',
                        bottom: r.touch ? 'calc(var(--jfp-nav-bottom, 72px) + 8px)' : 0,
                        left: 0,
                        right: 0,
                        zIndex: 2,
                        opacity: trans.carouselOpacity,
                        transform: `translate3d(0, ${trans.carouselTranslateY}px, 0)`,
                        pointerEvents: trans.carouselInteractive ? 'auto' : 'none',
                        willChange: 'transform, opacity'
                    }}
                >
                    <CollectionCardCarousel listId={listId} items={items} navigate={navigate} />
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
