import React, { useEffect, useRef, useState } from 'react';

import globalize from 'lib/globalize';

// Import de módulo (no una ruta de texto suelta): así Vite lo copia, hashea
// y referencia en el build de producción. Una cadena 'assets/img/...' solo
// funciona en dev, donde Vite sirve src/ tal cual.
import jellyfinLogo from '../../../../../assets/img/jellyfin-white.png';
import { T } from '../../theme/tokens';
import { Ic, JellyfinLogo } from '../../theme/icons';
import { useNavScroll } from '../../../domain/bridge/useScrollY';
import { NavActions, type NavActionData } from './NavActions';
import { UserAvatar } from './UserAvatar';
import { useResponsive } from '../../theme/responsive';
import { searchVM } from '../../../domain/viewModels/SearchViewModel';
import type { Route } from '../../../app/router';

type Crumb = { label: string; to?: Route };
export type ActionData = NavActionData;

type NavProps = {
    navigate: (r: Route) => void;
    active?: 'home' | 'series' | 'movies' | 'lists';
    breadcrumb?: Crumb[];
    actionId?: string;
    actionData?: ActionData;
};

const NAV_LINKS = [

    { id: 'home', key: 'Home' },
    { id: 'series', key: 'Shows' },
    { id: 'movies', key: 'Movies' },
    { id: 'lists', key: 'Lists' }
] as const;

// Reset para que un <button> real (accesible con teclado) se vea como los
// antiguos spans clicables.
const linkReset: React.CSSProperties = {
    background: 'none', border: 'none', padding: 0, margin: 0,
    font: 'inherit', color: 'inherit', letterSpacing: 'inherit',
    cursor: 'pointer'
};

// Logo con fallback: si el asset falla (servidor sin el fichero, base path
// distinto, proxy que devuelve HTML…), el <img> no se queda roto: se descarta
// y se pinta la silueta SVG inline JellyfinLogo. El estado vive por icono,
// no global —un fallo no afecta a otras navs montadas a la vez.
function Logo({ size, style }: { size: number; style?: React.CSSProperties }) {
    const [failed, setFailed] = useState(false);
    if (failed) return <JellyfinLogo size={size} style={style} />;
    return (
        <img
            src={jellyfinLogo}
            alt=''
            width={size}
            height={size}
            style={{ display: 'block', ...style }}
            onError={() => setFailed(true)}
        />
    );
}

export function Nav({ navigate, active = 'home', breadcrumb, actionId, actionData }: NavProps) {
    const { isScrolled, isScrolling } = useNavScroll(40, 350);
    const r = useResponsive();
    const [isHovered, setIsHovered] = useState(false);
    const [isFocused, setIsFocused] = useState(false);
    const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

    const onNavMouseEnter = () => {
        if (hoverTimerRef.current) {
            clearTimeout(hoverTimerRef.current);
            hoverTimerRef.current = undefined;
        }
        setIsHovered(true);
    };

    const onNavMouseLeave = () => {
        if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
        hoverTimerRef.current = setTimeout(() => {
            setIsHovered(false);
        }, 180);
    };

    useEffect(() => {
        return () => {
            if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
        };
    }, []);

    // Mobile/tablet: barra superior slim — solo logo, acciones del item y
    // avatar. Los enlaces y la lupa viven en la navegación M3 inferior/rail.
    if (r.touch) {
        const showMobileBrandText = !isScrolled || !isScrolling;
        return (
            <div data-jfp-nav='' style={{
                position: 'fixed', top: 0, right: 0, zIndex: 50,
                // El rail de tablet es vertical y centrado: nunca llega hasta
                // arriba, así que la barra arranca del borde izquierdo (si
                // esperaba al rail, el logo quedaba flotando a media pantalla).
                // En móvil lo único que hay que respetar es el safe-area.
                left: 'env(safe-area-inset-left, 0px)',
                padding: `calc(12px + env(safe-area-inset-top, 0px)) ${r.pagePad + 4}px 12px`,
                display: 'flex', alignItems: 'center', gap: 14,
                fontFamily: T.ui, fontSize: 14,
                background: 'transparent',
                pointerEvents: 'none'
            }}>
                <button
                    onClick={() => navigate({ page: 'home' })}
                    style={{
                        ...linkReset,
                        display: 'flex', alignItems: 'center', gap: 8,
                        fontFamily: T.ui, fontSize: 21, letterSpacing: 0.5,
                        color: 'var(--md-sys-color-on-surface, #fff)',
                        pointerEvents: 'auto',
                        filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.8))'
                    }}
                >
                    <Logo size={21} />
                    <span
                        data-jfp-brand-text=''
                        style={{
                            display: 'inline-block',
                            overflow: 'hidden',
                            whiteSpace: 'nowrap',
                            maxWidth: showMobileBrandText ? '100px' : '0px',
                            opacity: showMobileBrandText ? 1 : 0,
                            transform: showMobileBrandText ? 'translateX(0)' : 'translateX(-6px)',
                            transition: 'max-width .3s cubic-bezier(0.16, 1, 0.3, 1), opacity .25s ease, transform .3s cubic-bezier(0.16, 1, 0.3, 1)'
                        }}
                    >
                        jellyfin
                    </span>
                </button>
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    color: 'var(--md-sys-color-on-surface-variant, rgba(255,255,255,0.55))',
                    marginLeft: 'auto',
                    pointerEvents: 'auto'
                }}>
                    {actionId && <NavActions actionId={actionId} actionData={actionData} />}
                    {/* Sin lupa aquí: en táctil la búsqueda es el segmento
                        central de la píldora de abajo (MobileNav), donde llega
                        el pulgar. Arriba quedan el logo, las acciones del item
                        y la cuenta. En escritorio sigue estando, más abajo. */}
                    <UserAvatar navigate={navigate} />
                </div>
            </div>
        );
    }

    // Desktop:
    // Al hacer scroll, la barra se funde sin raya inferior. Durante el scroll
    // activo se contrae todo dejando solo el icono; al detenerse el scroll
    // reaparece el texto de la marca, y al pasar el ratón se despliegan los
    // enlaces con una animación suave.
    const showBrandText = !isScrolled || (!isScrolling || isHovered);
    const showLinks = !isScrolled || (!isScrolling && (isHovered || isFocused));

    return (
        <div data-jfp-nav='' style={{
            position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
            padding: isScrolled ? '16px 24px 16px 56px' : '22px 24px 22px 56px',
            display: 'flex', alignItems: 'center', gap: 32,
            fontFamily: T.ui, fontSize: 14, letterSpacing: 0.2,
            background: 'transparent',
            pointerEvents: 'none',
            transition: 'padding .3s cubic-bezier(0.16, 1, 0.3, 1)'
        }}>
            <div
                onMouseEnter={onNavMouseEnter}
                onMouseLeave={onNavMouseLeave}
                onFocus={() => setIsFocused(true)}
                onBlur={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                        setIsFocused(false);
                    }
                }}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: showLinks ? 26 : (showBrandText ? 10 : 0),
                    transition: 'gap .35s cubic-bezier(0.16, 1, 0.3, 1)',
                    pointerEvents: 'auto',
                    filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.8))'
                }}
            >
                <button
                    onClick={() => navigate({ page: 'home' })}
                    style={{
                        ...linkReset,
                        display: 'flex', alignItems: 'center', gap: 10,
                        fontFamily: T.ui, fontSize: 24, letterSpacing: 0.5,
                        color: T.fg,
                        flexShrink: 0
                    }}
                >
                    {/* Silueta blanca del logo: el original a color desentona con
                        el blanco y negro del resto de la interfaz. */}
                    <Logo size={24} />
                    <span
                        data-jfp-brand-text=''
                        style={{
                            display: 'inline-block',
                            overflow: 'hidden',
                            whiteSpace: 'nowrap',
                            maxWidth: showBrandText ? '120px' : '0px',
                            opacity: showBrandText ? 1 : 0,
                            transform: showBrandText ? 'translateX(0)' : 'translateX(-8px)',
                            transition: 'max-width .35s cubic-bezier(0.16, 1, 0.3, 1), opacity .25s ease, transform .35s cubic-bezier(0.16, 1, 0.3, 1)',
                            pointerEvents: showBrandText ? 'auto' : 'none'
                        }}
                    >
                        jellyfin
                    </span>
                </button>

                {breadcrumb ? (
                    <div
                        data-jfp-nav-links=''
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                            color: T.dim,
                            fontSize: 12,
                            overflow: 'hidden',
                            whiteSpace: 'nowrap',
                            maxWidth: showLinks ? '600px' : '0px',
                            opacity: showLinks ? 1 : 0,
                            transform: showLinks ? 'translateX(0)' : 'translateX(-10px)',
                            transition: 'max-width .4s cubic-bezier(0.16, 1, 0.3, 1), opacity .3s ease, transform .4s cubic-bezier(0.16, 1, 0.3, 1)',
                            pointerEvents: showLinks ? 'auto' : 'none',
                            flexShrink: 0
                        }}
                    >
                        {breadcrumb.map((b, i) => (
                            <React.Fragment key={i}>
                                {i > 0 && <span style={{ opacity: 0.4 }}>›</span>}
                                {b.to ? (
                                    <button
                                        onClick={() => navigate(b.to as Route)}
                                        style={{
                                            ...linkReset,
                                            color: i === breadcrumb.length - 1 ? T.fg : T.dim
                                        }}
                                    >
                                        {b.label}
                                    </button>
                                ) : (
                                    <span style={{ color: i === breadcrumb.length - 1 ? T.fg : T.dim }}>
                                        {b.label}
                                    </span>
                                )}
                            </React.Fragment>
                        ))}
                    </div>
                ) : (
                    <div
                        data-jfp-nav-links=''
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 26,
                            overflow: 'hidden',
                            whiteSpace: 'nowrap',
                            maxWidth: showLinks ? '500px' : '0px',
                            opacity: showLinks ? 1 : 0,
                            transform: showLinks ? 'translateX(0)' : 'translateX(-10px)',
                            transition: 'max-width .4s cubic-bezier(0.16, 1, 0.3, 1), opacity .3s ease, transform .4s cubic-bezier(0.16, 1, 0.3, 1)',
                            pointerEvents: showLinks ? 'auto' : 'none',
                            flexShrink: 0
                        }}
                    >
                        {NAV_LINKS.map((l) => (
                            <button
                                key={l.id}
                                onClick={() => navigate(l.id === 'home' ? { page: 'home' } : { page: l.id })}
                                style={{
                                    ...linkReset,
                                    color: l.id === active ? T.fg : T.dim,
                                    fontWeight: l.id === active ? 500 : 400,
                                    position: 'relative',
                                    padding: '4px 0'
                                }}
                            >
                                {globalize.translate(l.key)}
                                {l.id === active && (
                                    <div style={{ position: 'absolute', bottom: -2, left: 0, right: 0, height: 1, background: T.fg }} />
                                )}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <div style={{
                display: 'flex', alignItems: 'center', gap: 18, color: T.dim, marginLeft: 'auto',
                pointerEvents: 'auto',
                filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.8))'
            }}>
                {actionId && <NavActions actionId={actionId} actionData={actionData} withDivider />}
                <button
                    // Abre la capa encima de la página en vez de navegar: se
                    // busca sin perder dónde estaba uno, y volver es cerrarla.
                    onClick={searchVM.openOverlay}
                    aria-label={globalize.translate('Search')}
                    style={{
                        ...linkReset, display: 'flex', alignItems: 'center',
                        padding: '4px 6px', borderRadius: 6, transition: 'background .15s'
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                    <Ic.Search size={18} />
                </button>
                <UserAvatar navigate={navigate} />
            </div>

        </div>
    );
}
