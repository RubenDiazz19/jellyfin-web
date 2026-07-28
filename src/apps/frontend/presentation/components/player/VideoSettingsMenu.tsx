// Ajustes del reproductor bajo un único engranaje: capítulos, subtítulos,
// audio, velocidad y relación de aspecto. Un botón por ajuste llenaba el OSD
// de iconos sin nombre; aquí cada uno se lee, y el panel enseña de un vistazo
// qué hay elegido en cada cosa.
import globalize from 'lib/globalize';

import {
    useEffect, useMemo, useRef, useState, type ReactNode
} from 'react';
import {
    chapterDisplayName, playerMarks, segmentDisplayName, videoPlayerVM,
    type AspectRatio, type PlayerMark
} from '../../../domain/viewModels/VideoPlayerViewModel';
import { useViewModel } from '../../../domain/bridge/useViewModel';
import { PlayerIc } from './playerIcons';

const RATES = [0.5, 0.75, 1, 1.25, 1.5, 2];

function markTime(seconds: number): string {
    const s = Math.floor(seconds % 60);
    const m = Math.floor((seconds / 60) % 60);
    const h = Math.floor(seconds / 3600);
    const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
    const hours = h > 0 ? `${h}:` : '';
    return `${hours}${mm}:${String(s).padStart(2, '0')}`;
}

/** Nombre del capítulo, o el del tramo detectado, o un ordinal de respaldo. */
function markLabel(mark: PlayerMark, index: number): string {
    if (mark.kind && !mark.name) return segmentDisplayName(mark.kind);
    return chapterDisplayName(mark.name, index);
}

// En función y no en const de módulo: traducir al evaluar el módulo
// congelaría el idioma con el que se cargó el chunk.
function getAspects(): { id: AspectRatio; label: string }[] {
    return [
        { id: 'auto', label: globalize.translate('Auto') },
        { id: 'cover', label: globalize.translate('AspectRatioCover') },
        { id: 'fill', label: globalize.translate('AspectRatioFill') },
        { id: '16:9', label: '16:9' },
        { id: '4:3', label: '4:3' },
        { id: '21:9', label: '21:9' }
    ];
}

function rateLabel(rate: number): string {
    return rate === 1 ? globalize.translate('Normal') : `${rate}×`;
}

/** Secciones del panel. `null` = la lista de secciones (primer nivel). */
type SectionId = 'chapters' | 'subs' | 'audio' | 'speed' | 'aspect';

export function VideoSettingsMenu() {
    useViewModel(videoPlayerVM);
    const [open, setOpen] = useState(false);
    const [section, setSection] = useState<SectionId | null>(null);
    const rootRef = useRef<HTMLDivElement>(null);

    // Cierra el panel al hacer click fuera.
    useEffect(() => {
        if (!open) return;
        const onPointerDown = (e: PointerEvent) => {
            if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
        };
        window.addEventListener('pointerdown', onPointerDown);
        return () => window.removeEventListener('pointerdown', onPointerDown);
    }, [open]);

    const audio = videoPlayerVM.audioTracks.value;
    const subs = videoPlayerVM.subtitleTracks.value;
    const rate = videoPlayerVM.playbackRate.value;
    const aspect = videoPlayerVM.aspectRatio.value;
    const titlePref = videoPlayerVM.titlePref.value;
    const isSeries = videoPlayerVM.titleIsSeries.value;
    const selectedSubtitle = videoPlayerVM.selectedSubtitle.value;
    const selectedAudio = videoPlayerVM.selectedAudio.value;

    // Saltos disponibles: capítulos del fichero + tramos detectados (intro,
    // créditos) que no caigan ya sobre un capítulo.
    const chapters = videoPlayerVM.chapters.value;
    const segments = videoPlayerVM.segmentList.value;
    // Este componente re-renderiza en cada timeupdate (useViewModel escucha
    // todos los signals): la lista solo se rehace si cambian sus fuentes.
    const marks = useMemo(() => playerMarks(chapters, segments), [chapters, segments]);
    const currentTime = videoPlayerVM.currentTime.value;
    const currentMark = marks.reduce<PlayerMark | null>(
        (acc, mark) => (mark.start <= currentTime ? mark : acc), null
    );

    const subLabel = selectedSubtitle == null ?
        globalize.translate('Off') :
        subs.find((s) => s.index === selectedSubtitle)?.displayTitle ?? '';
    const audioLabel = audio.find((a) => a.index === selectedAudio)?.displayTitle ?? '';
    const aspectLabel = getAspects().find((a) => a.id === aspect)?.label ?? '';

    // Pie de los menús de pista: la elección se recuerda para este título (o
    // para toda la serie) por encima de la preferencia de Ajustes, y desde
    // aquí se puede deshacer.
    const prefNote = titlePref && (
        <div className='jfp-video-settings-note'>
            <span>
                {globalize.translate(
                    isSeries ? 'TrackPreferenceSavedForSeries' : 'TrackPreferenceSavedForTitle'
                )}
            </span>
            <button
                type='button'
                className='jfp-video-settings-forget'
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => videoPlayerVM.clearTitlePref()}
            >
                {globalize.translate('ButtonForget')}
            </button>
        </div>
    );

    const close = () => { setOpen(false); setSection(null); };

    return (
        <div ref={rootRef} className='jfp-video-settings'>
            <button
                type='button'
                className={`jfp-video-btn${open ? ' is-active' : ''}`}
                onClick={() => {
                    setSection(null);
                    setOpen((v) => !v);
                }}
                aria-label={globalize.translate('Settings')}
                aria-expanded={open}
            >
                <PlayerIc.Settings />
            </button>

            {open && (
                <div className='jfp-video-settings-menu'>
                    {section === null ? (
                        <section>
                            {marks.length > 0 && (
                                <SectionRow
                                    label={globalize.translate('Chapters')}
                                    value={currentMark ?
                                        markLabel(currentMark, marks.indexOf(currentMark)) :
                                        ''}
                                    onOpen={() => setSection('chapters')}
                                />
                            )}
                            {subs.length > 0 && (
                                <SectionRow
                                    label={globalize.translate('Subtitles')}
                                    value={subLabel}
                                    onOpen={() => setSection('subs')}
                                />
                            )}
                            {audio.length > 0 && (
                                <SectionRow
                                    label={globalize.translate('Audio')}
                                    value={audioLabel}
                                    onOpen={() => setSection('audio')}
                                />
                            )}
                            <SectionRow
                                label={globalize.translate('LabelPlaybackSpeed')}
                                value={rateLabel(rate)}
                                onOpen={() => setSection('speed')}
                            />
                            <SectionRow
                                label={globalize.translate('AspectRatio')}
                                value={aspectLabel}
                                onOpen={() => setSection('aspect')}
                            />
                        </section>
                    ) : (
                        <section>
                            <SectionHeader onBack={() => setSection(null)}>
                                {section === 'chapters' && globalize.translate('Chapters')}
                                {section === 'subs' && globalize.translate('Subtitles')}
                                {section === 'audio' && globalize.translate('Audio')}
                                {section === 'speed' && globalize.translate('LabelPlaybackSpeed')}
                                {section === 'aspect' && globalize.translate('AspectRatio')}
                            </SectionHeader>

                            {section === 'chapters' && marks.map((mark, i) => (
                                <MenuOption
                                    key={mark.start}
                                    label={`${markLabel(mark, i)} · ${markTime(mark.start)}`}
                                    active={mark === currentMark}
                                    onSelect={() => {
                                        videoPlayerVM.seek(mark.start);
                                        close();
                                    }}
                                />
                            ))}

                            {section === 'subs' && (
                                <>
                                    <MenuOption
                                        label={globalize.translate('Off')}
                                        active={selectedSubtitle == null}
                                        onSelect={() => videoPlayerVM.setSubtitleTrack(null)}
                                    />
                                    {subs.map((s) => (
                                        <MenuOption
                                            key={s.index}
                                            label={s.displayTitle}
                                            active={selectedSubtitle === s.index}
                                            onSelect={() => videoPlayerVM.setSubtitleTrack(s.index)}
                                        />
                                    ))}
                                    {prefNote}
                                </>
                            )}

                            {section === 'audio' && (
                                <>
                                    {audio.map((a) => (
                                        <MenuOption
                                            key={a.index}
                                            label={a.displayTitle}
                                            active={selectedAudio === a.index}
                                            onSelect={() => videoPlayerVM.setAudioTrack(a.index)}
                                        />
                                    ))}
                                    {prefNote}
                                </>
                            )}

                            {section === 'speed' && RATES.map((r) => (
                                <MenuOption
                                    key={r}
                                    label={rateLabel(r)}
                                    active={rate === r}
                                    onSelect={() => videoPlayerVM.setPlaybackRate(r)}
                                />
                            ))}

                            {section === 'aspect' && getAspects().map((a) => (
                                <MenuOption
                                    key={a.id}
                                    label={a.label}
                                    active={aspect === a.id}
                                    onSelect={() => videoPlayerVM.setAspectRatio(a.id)}
                                />
                            ))}
                        </section>
                    )}
                </div>
            )}
        </div>
    );
}

/** Fila del primer nivel: nombre del ajuste y lo que hay elegido ahora. */
function SectionRow({
    label, value, onOpen
}: {
    label: string; value: string; onOpen: () => void;
}) {
    return (
        <button
            type='button'
            className='jfp-video-settings-row'
            onMouseDown={(e) => e.preventDefault()}
            onClick={onOpen}
        >
            <span className='jfp-video-settings-row-label'>{label}</span>
            <span className='jfp-video-settings-row-value'>{value}</span>
            <span className='jfp-video-settings-row-chevron' aria-hidden='true'>›</span>
        </button>
    );
}

function SectionHeader({ children, onBack }: { children: ReactNode; onBack: () => void }) {
    return (
        <button
            type='button'
            className='jfp-video-settings-back'
            onMouseDown={(e) => e.preventDefault()}
            onClick={onBack}
        >
            <span aria-hidden='true'>‹</span>
            {children}
        </button>
    );
}

function MenuOption({
    label, active, onSelect
}: {
    label: string; active: boolean; onSelect: () => void;
}) {
    return (
        <button
            type='button'
            className={`jfp-video-settings-option${active ? ' is-active' : ''}`}
            // preventDefault en mousedown = no enfocar al pulsar. Sin esto, en
            // una lista larga con scroll (62 subtítulos), Chrome desplaza el
            // contenedor para dejar visible el botón que acaba de enfocar; la
            // lista se movía entre el mousedown y el mouseup y el click caía en
            // otra pista («traslada la vista en vez de seleccionar»). El click
            // se sigue disparando y el Tab conserva la accesibilidad.
            onMouseDown={(e) => e.preventDefault()}
            onClick={onSelect}
        >
            <span className='jfp-video-settings-dot' aria-hidden />
            {label}
        </button>
    );
}
