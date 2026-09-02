import { useState } from 'react';
import globalize from 'lib/globalize';
import { T } from '../theme/tokens';
import { personVM } from '../../domain/viewModels/PersonViewModel';
import { useViewModelLoad, useVmSignals } from '../../domain/bridge/useViewModel';
import type { CastMember } from '../../domain/models';
import type { Navigate } from '../../app/router';
import { MovieCard } from '../components/cards/MovieCard';
import { PosterCard } from '../components/cards/PosterCard';
import { LoadState } from '../components/controls/LoadState';
import { Nav } from '../components/layout/Nav';
import { useWidescreen } from '../theme/responsive';

type Props = { name: string; navigate: Navigate };

function getFlagFallback(location: string): string {
    const loc = location.toLowerCase();
    if (loc.includes('united states') || loc.includes('usa') || loc.includes('ee. uu.')) return '🇺🇸';
    if (loc.includes('uk') || loc.includes('united kingdom') || loc.includes('reino unido') || loc.includes('england')) return '🇬🇧';
    if (loc.includes('spain') || loc.includes('españa')) return '🇪🇸';
    if (loc.includes('france') || loc.includes('francia')) return '🇫🇷';
    if (loc.includes('italy') || loc.includes('italia')) return '🇮🇹';
    if (loc.includes('germany') || loc.includes('alemania')) return '🇩🇪';
    if (loc.includes('canada') || loc.includes('canadá')) return '🇨🇦';
    if (loc.includes('australia')) return '🇦🇺';
    if (loc.includes('japan') || loc.includes('japon') || loc.includes('japón')) return '🇯🇵';
    if (loc.includes('korea') || loc.includes('corea')) return '🇰🇷';
    if (loc.includes('mexico') || loc.includes('méxico')) return '🇲🇽';
    if (loc.includes('brazil') || loc.includes('brasil')) return '🇧🇷';
    if (loc.includes('india')) return '🇮🇳';
    if (loc.includes('china')) return '🇨🇳';
    if (loc.includes('russia') || loc.includes('rusia')) return '🇷🇺';
    if (loc.includes('argentina')) return '🇦🇷';
    if (loc.includes('colombia')) return '🇨🇴';
    if (loc.includes('chile')) return '🇨🇱';
    return '🏳️';
}

export function PersonPage({ name, navigate }: Props) {
    useViewModelLoad(personVM, (vm) => vm.load(name), [name]);
    useVmSignals(personVM, (vm) => [vm.shows, vm.movies, vm.details, vm.loading, vm.error]);

    const isWidescreen = useWidescreen();
    const [bioExpanded, setBioExpanded] = useState(false);

    const shows = personVM.shows.value;
    const movies = personVM.movies.value;
    const details = personVM.details.value;
    const totalCount = shows.length + movies.length;
    const loading = personVM.loading.value;
    const error = personVM.error.value;

    const credits = [...shows, ...movies]
        .map((item) => item?.cast?.find((c: CastMember) => c?.name === name))
        .filter((c): c is CastMember => Boolean(c));

    // Foto de la persona — máxima resolución nativa eliminando límites de escala de Jellyfin
    const rawLocalPhoto = credits.find((c) => Boolean(c?.photo))?.photo;
    let localPhoto: string | null = null;
    if (rawLocalPhoto) {
        try {
            const u = new URL(rawLocalPhoto);
            u.searchParams.delete('maxHeight');
            u.searchParams.delete('maxWidth');
            u.searchParams.set('quality', '95');
            localPhoto = u.toString();
        } catch {
            localPhoto = rawLocalPhoto.replace(/[?&]max(Height|Width)=\d+/g, '');
        }
    }
    const photo = details?.photo || localPhoto;

    const age = details?.age;
    const gender = details?.gender;
    const country = details?.country;
    const countryCode = details?.countryCode;
    const bio = details?.bio;
    const placeOfBirth = details?.placeOfBirth;
    let birthCity = placeOfBirth ? placeOfBirth.split(',')[0].trim() : null;
    if (birthCity && country && birthCity.toLowerCase() === country.toLowerCase()) {
        birthCity = null;
    }

    const moviesWatched = movies.filter((m) => m.watched).length;
    const showsWatched = shows.filter((s) => s.watched).length;

    // Formatear nombre: First Name en pequeño, Last Name en grande
    const nameParts = name.split(' ');
    const firstName = nameParts.length > 1 ? nameParts.slice(0, -1).join(' ') : '';
    const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : nameParts[0];

    // Mientras carga y no hay nada, mostramos el estado de carga
    if (totalCount === 0 && (loading || error)) {
        return (
            <div style={{ background: '#000', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: 20 }}>
                    <button
                        onClick={() => window.history.back()}
                        style={{
                            width: 44,
                            height: 44,
                            borderRadius: 22,
                            background: 'rgba(255,255,255,0.1)',
                            border: 'none',
                            color: '#fff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer'
                        }}
                    >
                        <svg width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'><line x1='19' y1='12' x2='5' y2='12'></line><polyline points='12 19 5 12 12 5'></polyline></svg>
                    </button>
                </div>
                <LoadState
                    variant='page'
                    loading={loading}
                    error={error}
                    count={0}
                    emptyTitle={error ? globalize.translate('MessageCatalogQueryFailed') : ''}
                    emptyHint={error ?? ''}
                >
                    <div />
                </LoadState>
            </div>
        );
    }

    const statsBlock = (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 28,
            justifyContent: isWidescreen ? 'flex-start' : 'center',
            textAlign: 'center'
        }}>
            {/* Género */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 84 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 32 }}>
                    <span style={{ fontSize: 20, fontWeight: 700, fontFamily: T.display }}>
                        {gender || '—'}
                    </span>
                </div>
                <div style={{ fontSize: 13, color: T.dim, marginTop: 1, fontFamily: T.ui }}>Género</div>
            </div>

            {/* Edad */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 84 }}>
                <div style={{ fontFamily: T.display, display: 'flex', alignItems: 'center', justifyContent: 'center', height: 32 }}>
                    <span style={{ fontSize: 28, fontWeight: 700 }}>
                        {(age !== null && age !== undefined) ? age : '—'}
                    </span>
                </div>
                <div style={{ fontSize: 13, color: T.dim, marginTop: 1, fontFamily: T.ui }}>Años</div>
            </div>

            {/* Nacionalidad / Bandera — proporción 3:2 */}
            <div style={{
                position: 'relative',
                width: 78,
                height: 52,
                aspectRatio: '3 / 2',
                borderRadius: 6,
                overflow: 'hidden',
                boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
                border: '1px solid rgba(255,255,255,0.18)',
                background: '#1a1a1a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
            }}>
                {countryCode ? (
                    <img
                        src={`https://flagcdn.com/w160/${countryCode.toLowerCase()}.png`}
                        alt={country || ''}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                ) : (
                    <span style={{ fontSize: 24 }}>{getFlagFallback(country || '')}</span>
                )}

                {/* Degradado suave sólo en el tercio inferior */}
                <div style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.35) 36%, rgba(0,0,0,0) 65%)'
                }} />

                {/* Texto en letrita pequeña abajo del todo dentro de la bandera */}
                <div style={{
                    position: 'absolute',
                    bottom: 3,
                    left: 3,
                    right: 3,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    pointerEvents: 'none'
                }}>
                    <span style={{
                        fontSize: 9.5,
                        fontWeight: 700,
                        color: '#fff',
                        fontFamily: T.ui,
                        lineHeight: 1.15,
                        textShadow: '0 1px 3px rgba(0,0,0,0.9), 0 0 4px rgba(0,0,0,0.8)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        maxWidth: '100%'
                    }}>
                        {country || '—'}
                    </span>
                    {birthCity && (
                        <span style={{
                            fontSize: 8,
                            fontWeight: 500,
                            color: 'rgba(255,255,255,0.9)',
                            fontFamily: T.ui,
                            lineHeight: 1.1,
                            textShadow: '0 1px 2px rgba(0,0,0,0.95)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            maxWidth: '100%'
                        }}>
                            {birthCity}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );

    const filmographyContent = totalCount > 0 ? (
        <div>
            {movies.length > 0 && (
                <div style={{ marginBottom: 40 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 20 }}>
                        <h2 style={{ fontFamily: T.display, fontSize: 22, fontWeight: 700, margin: 0 }}>Películas</h2>
                        <span style={{ fontSize: 14, color: T.dim, fontFamily: T.ui }}>{moviesWatched} / {movies.length} vistas</span>
                    </div>
                    <div style={{
                        display: 'flex',
                        gap: 16,
                        overflowX: 'auto',
                        paddingBottom: 12,
                        scrollbarWidth: 'none',
                        WebkitOverflowScrolling: 'touch'
                    }}>
                        {movies.map((m) => (
                            <div key={m.id} style={{ width: 140, flexShrink: 0 }}>
                                <MovieCard movie={m} navigate={navigate} />
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {shows.length > 0 && (
                <div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 20 }}>
                        <h2 style={{ fontFamily: T.display, fontSize: 22, fontWeight: 700, margin: 0 }}>Series</h2>
                        <span style={{ fontSize: 14, color: T.dim, fontFamily: T.ui }}>{showsWatched} / {shows.length} vistas</span>
                    </div>
                    <div style={{
                        display: 'flex',
                        gap: 16,
                        overflowX: 'auto',
                        paddingBottom: 12,
                        scrollbarWidth: 'none',
                        WebkitOverflowScrolling: 'touch'
                    }}>
                        {shows.map((s) => (
                            <div key={s.id} style={{ width: 140, flexShrink: 0 }}>
                                <PosterCard slide={s} navigate={navigate} />
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    ) : (
        <div style={{ marginTop: 40 }}>
            <LoadState
                variant='page'
                loading={false}
                count={0}
                emptyTitle={globalize.translate('MessageNoAppearancesFor', name)}
                emptyHint={globalize.translate('MessageNoAppearancesForHelp')}
            >
                <div />
            </LoadState>
        </div>
    );

    // Modo 16:9 / Widescreen: Columna izquierda (foto 100vh) y Columna derecha (Fila 1: datos, Fila 2: filmografía)
    if (isWidescreen) {
        return (
            <div style={{ background: '#000', color: T.fg, minHeight: '100vh', display: 'flex', position: 'relative', overflowX: 'hidden' }}>
                <Nav navigate={navigate} breadcrumb={[
                    { label: globalize.translate('Home'), to: { page: 'home' } },
                    { label: name }
                ]} />

                {/* Columna Izquierda: Foto pegada a la izquierda ocupando todo el alto con degradado al borde derecho */}
                <div style={{
                    position: 'sticky',
                    top: 0,
                    left: 0,
                    width: '38vw',
                    minWidth: 380,
                    maxWidth: 540,
                    height: '100vh',
                    flexShrink: 0,
                    overflow: 'hidden',
                    background: '#0a0a0a'
                }}>
                    {photo ? (
                        <img
                            src={photo}
                            alt={name}
                            style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 20%' }}
                        />
                    ) : (
                        <div style={{ width: '100%', height: '100%', background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 100, color: 'rgba(255,255,255,0.1)' }}>👤</div>
                    )}

                    {/* Borde derecho con degradado para que pegue con el fondo negro */}
                    <div style={{
                        position: 'absolute',
                        inset: 0,
                        background: 'linear-gradient(to right, rgba(0,0,0,0) 45%, rgba(0,0,0,0.55) 75%, #000 100%)'
                    }} />

                    {/* Degradado superior para legibilidad de nav y sombra inferior suave */}
                    <div style={{
                        position: 'absolute',
                        inset: 0,
                        background: 'linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, transparent 15%, transparent 85%, rgba(0,0,0,0.8) 100%)'
                    }} />
                </div>

                {/* Columna Derecha: se divide en dos filas */}
                <div style={{
                    flex: 1,
                    minWidth: 0,
                    padding: '96px 48px 60px 32px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 36
                }}>
                    {/* Fila 1: Datos (Nombre, Género, Años, País y Biografía) */}
                    <div>
                        <div style={{ marginBottom: 20 }}>
                            {firstName && (
                                <div style={{ fontFamily: '"Playfair Display", "Georgia", serif', fontSize: 32, fontWeight: 400, letterSpacing: -0.5, opacity: 0.85 }}>
                                    {firstName}
                                </div>
                            )}
                            <div style={{ fontFamily: '"Playfair Display", "Georgia", serif', fontSize: 58, fontWeight: 700, marginTop: firstName ? -8 : 0, letterSpacing: -1 }}>
                                {lastName}
                            </div>
                        </div>

                        <div style={{ margin: '20px 0 24px' }}>
                            {statsBlock}
                        </div>

                        {bio && (
                            <div
                                onClick={() => setBioExpanded(!bioExpanded)}
                                style={{ maxWidth: 780, cursor: 'pointer', userSelect: 'none' }}
                            >
                                <p style={{
                                    fontSize: 14,
                                    lineHeight: 1.65,
                                    color: 'rgba(255, 255, 255, 0.72)',
                                    fontFamily: T.ui,
                                    margin: 0,
                                    display: '-webkit-box',
                                    WebkitLineClamp: bioExpanded ? 'unset' : 4,
                                    WebkitBoxOrient: 'vertical',
                                    overflow: bioExpanded ? 'visible' : 'hidden'
                                }}>
                                    {bio}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Fila 2: Películas / Series */}
                    <div>
                        {filmographyContent}
                    </div>
                </div>
            </div>
        );
    }

    // Modo Vertical / Móvil: Layout tradicional centrado
    return (
        <div style={{ background: '#000', color: T.fg, minHeight: '100vh', overflowX: 'hidden' }}>

            <Nav navigate={navigate} breadcrumb={[
                { label: globalize.translate('Home'), to: { page: 'home' } },
                { label: name }
            ]} />

            {/* Hero Image & Header */}
            <div style={{ position: 'relative', width: '100%', height: '65vh', minHeight: 400 }}>
                {photo ? (
                    <img
                        src={photo}
                        alt={name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 20%' }}
                    />
                ) : (
                    <div style={{ width: '100%', height: '100%', background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 100, color: 'rgba(255,255,255,0.1)' }}>👤</div>
                )}

                {/* Degradado para fundir a negro y hacer legible el texto */}
                <div style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0) 40%, rgba(0,0,0,0.8) 80%, #000 100%)'
                }} />

                {/* Name */}
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, textAlign: 'center', paddingBottom: 10, zIndex: 10 }}>
                    {firstName && (
                        <div style={{ fontFamily: '"Playfair Display", "Georgia", serif', fontSize: 36, fontWeight: 400, letterSpacing: -0.5 }}>
                            {firstName}
                        </div>
                    )}
                    <div style={{ fontFamily: '"Playfair Display", "Georgia", serif', fontSize: 68, fontWeight: 700, marginTop: firstName ? -15 : 0, letterSpacing: -1 }}>
                        {lastName}
                    </div>
                </div>
            </div>

            {/* Stats */}
            <div style={{ marginTop: 24, display: 'flex', justifyContent: 'center', zIndex: 10, position: 'relative' }}>
                {statsBlock}
            </div>

            {/* Description / Bio */}
            {bio && (
                <div
                    onClick={() => setBioExpanded(!bioExpanded)}
                    style={{
                        maxWidth: 720,
                        margin: '28px auto 0',
                        padding: '0 24px',
                        cursor: 'pointer',
                        textAlign: 'center',
                        userSelect: 'none'
                    }}
                >
                    <p style={{
                        fontSize: 14,
                        lineHeight: 1.6,
                        color: 'rgba(255, 255, 255, 0.7)',
                        fontFamily: T.ui,
                        margin: 0,
                        display: '-webkit-box',
                        WebkitLineClamp: bioExpanded ? 'unset' : 3,
                        WebkitBoxOrient: 'vertical',
                        overflow: bioExpanded ? 'visible' : 'hidden'
                    }}>
                        {bio}
                    </p>
                </div>
            )}

            {/* Known For */}
            <div style={{ padding: '40px 30px 60px', overflow: 'hidden' }}>
                {filmographyContent}
            </div>
        </div>
    );
}
