// Ajustes del reproductor bajo un único engranaje: capítulos, subtítulos,
// audio, velocidad y relación de aspecto. Un botón por ajuste llenaba el OSD
// de iconos sin nombre; aquí cada uno se lee, y el panel enseña de un vistazo
// qué hay elegido en cada cosa.
import globalize from 'lib/globalize';

import {
    Suspense, lazy, useEffect, useMemo, useRef, useState, type ReactNode
} from 'react';
import {
    chapterDisplayName, playerMarks, segmentDisplayName,
    type AspectRatio, type PlayerMark
} from '../../../domain/player/format';
import { videoPlayerVM } from '../../../domain/viewModels/VideoPlayerViewModel';
import { useSignalValue, useVmSignals } from '../../../domain/bridge/useViewModel';
import { PlayerIc } from './playerIcons';

const SubtitlePickerModal = lazy(() =>
    import('./SubtitlePickerModal').then((m) => ({ default: m.SubtitlePickerModal }))
);

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

function sleepTimerLabel(mode: string, remaining: number | null): string {
    if (mode === 'off') return globalize.translate('SleepTimerOff');
    if (mode === 'episode') return globalize.translate('SleepTimerEndOfEpisode');
    if (remaining != null && remaining > 0) {
        const mins = Math.floor(remaining / 60);
        const secs = Math.floor(remaining % 60);
        return `${mins}:${String(secs).padStart(2, '0')}`;
    }
    return globalize.translate('SleepTimerMinutes', Number(mode) || 0);
}

/** Secciones del panel. `null` = la lista de secciones (primer nivel). */
type SectionId = 'chapters' | 'subs' | 'audio' | 'speed' | 'aspect' | 'sleep';

export function VideoSettingsMenu() {
    // Este botón vive montado todo el rato dentro de la barra de controles.
    // Con `useViewModel` quedaba suscrito a los 28 signals del VM —incluido
    // currentTime— y se repintaba ~4 veces por segundo durante toda la
    // reproducción solo para tener listo un panel que casi siempre está
    // cerrado. Aquí van los signals que se leen SIEMPRE; currentTime lo
    // consumen los dos subcomponentes de capítulos, que solo se montan con el
    // panel abierto (`useVmSignals` exige una lista fija, así que no puede
    // entrar y salir de esta).
    useVmSignals(videoPlayerVM, (vm) => [
        vm.audioTracks, vm.subtitleTracks, vm.playbackRate, vm.aspectRatio,
        vm.titlePref, vm.titleIsSeries, vm.selectedSubtitle, vm.selectedAudio,
        vm.chapters, vm.segmentList, vm.subtitleOffset, vm.sleepTimerMode,
        vm.sleepTimerRemaining
    ]);
    const [open, setOpen] = useState(false);
    const [section, setSection] = useState<SectionId | null>(null);
    const [subModalOpen, setSubModalOpen] = useState(false);
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
    const subOffset = videoPlayerVM.subtitleOffset.value;
    const sleepMode = videoPlayerVM.sleepTimerMode.value;
    const sleepRemaining = videoPlayerVM.sleepTimerRemaining.value;
    const itemId = videoPlayerVM.currentItemId;

    // Saltos disponibles: capítulos del fichero + tramos detectados (intro,
    // créditos) que no caigan ya sobre un capítulo.
    const chapters = videoPlayerVM.chapters.value;
    const segments = videoPlayerVM.segmentList.value;
    const marks = useMemo(() => playerMarks(chapters, segments), [chapters, segments]);

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
                                <ChaptersRow marks={marks} onOpen={() => setSection('chapters')} />
                            )}
                            <SectionRow
                                label={globalize.translate('Subtitles')}
                                value={subLabel || globalize.translate('Off')}
                                onOpen={() => setSection('subs')}
                            />
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
                            <SectionRow
                                label={globalize.translate('SleepTimer')}
                                value={sleepTimerLabel(sleepMode, sleepRemaining)}
                                onOpen={() => setSection('sleep')}
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
                                {section === 'sleep' && globalize.translate('SleepTimer')}
                            </SectionHeader>

                            {section === 'chapters' && (
                                <ChapterOptions
                                    marks={marks}
                                    onSelect={(start) => {
                                        videoPlayerVM.seek(start);
                                        close();
                                    }}
                                />
                            )}

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
                                    {selectedSubtitle != null && (
                                        <div className='jfp-video-settings-offset'>
                                            <span className='jfp-video-settings-offset-title'>
                                                {globalize.translate('SubtitleOffset')}
                                            </span>
                                            <div className='jfp-video-settings-offset-controls'>
                                                <button
                                                    type='button'
                                                    className='jfp-video-settings-offset-btn'
                                                    onMouseDown={(e) => e.preventDefault()}
                                                    onClick={() => videoPlayerVM.adjustSubtitleOffset(-0.1)}
                                                    aria-label='-100ms'
                                                >
                                                    -0.1s
                                                </button>
                                                <span className='jfp-video-settings-offset-val'>
                                                    {subOffset > 0 ? `+${subOffset.toFixed(1)}s` : `${subOffset.toFixed(1)}s`}
                                                </span>
                                                <button
                                                    type='button'
                                                    className='jfp-video-settings-offset-btn'
                                                    onMouseDown={(e) => e.preventDefault()}
                                                    onClick={() => videoPlayerVM.adjustSubtitleOffset(0.1)}
                                                    aria-label='+100ms'
                                                >
                                                    +0.1s
                                                </button>
                                                {subOffset !== 0 && (
                                                    <button
                                                        type='button'
                                                        className='jfp-video-settings-offset-reset'
                                                        onMouseDown={(e) => e.preventDefault()}
                                                        onClick={() => videoPlayerVM.resetSubtitleOffset()}
                                                    >
                                                        {globalize.translate('SubtitleOffsetReset')}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                    {prefNote}
                                    {itemId && (
                                        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', marginTop: 4, paddingTop: 4 }}>
                                            <button
                                                type='button'
                                                className='jfp-video-settings-option'
                                                onMouseDown={(e) => e.preventDefault()}
                                                onClick={() => {
                                                    close();
                                                    setSubModalOpen(true);
                                                }}
                                            >
                                                <span className='jfp-video-settings-dot' aria-hidden />
                                                + {globalize.translate('SearchForSubtitles')} / {globalize.translate('HeaderUploadSubtitle')}
                                            </button>
                                        </div>
                                    )}
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

                            {section === 'sleep' && (
                                <>
                                    <MenuOption
                                        label={globalize.translate('SleepTimerOff')}
                                        active={sleepMode === 'off'}
                                        onSelect={() => videoPlayerVM.setSleepTimer('off')}
                                    />
                                    <MenuOption
                                        label={globalize.translate('SleepTimerEndOfEpisode')}
                                        active={sleepMode === 'episode'}
                                        onSelect={() => videoPlayerVM.setSleepTimer('episode')}
                                    />
                                    {(['15', '30', '45', '60'] as const).map((m) => (
                                        <MenuOption
                                            key={m}
                                            label={globalize.translate('SleepTimerMinutes', Number(m))}
                                            active={sleepMode === m}
                                            onSelect={() => videoPlayerVM.setSleepTimer(m)}
                                        />
                                    ))}
                                </>
                            )}
                        </section>
                    )}
                </div>
            )}

            {subModalOpen && itemId && (
                <Suspense fallback={null}>
                    <SubtitlePickerModal
                        itemId={itemId}
                        onClose={() => setSubModalOpen(false)}
                    />
                </Suspense>
            )}
        </div>
    );
}

/**
 * Marca en la que cae la posición actual.
 *
 * Se suscribe a currentTime (~4 Hz), así que solo debe usarse desde partes
 * del panel que estén montadas: son las únicas que enseñan el resaltado, y
 * mientras el panel está cerrado nadie debe pagar ese re-render.
 */
function useCurrentMark(marks: PlayerMark[]): PlayerMark | null {
    const currentTime = useSignalValue(videoPlayerVM.currentTime);
    return marks.reduce<PlayerMark | null>(
        (acc, mark) => (mark.start <= currentTime ? mark : acc), null
    );
}

/** Fila de capítulos del primer nivel: enseña en cuál se está ahora. */
function ChaptersRow({ marks, onOpen }: { marks: PlayerMark[]; onOpen: () => void }) {
    const currentMark = useCurrentMark(marks);
    return (
        <SectionRow
            label={globalize.translate('Chapters')}
            value={currentMark ? markLabel(currentMark, marks.indexOf(currentMark)) : ''}
            onOpen={onOpen}
        />
    );
}

/** Lista de capítulos, con el actual marcado. */
function ChapterOptions({
    marks, onSelect
}: {
    marks: PlayerMark[]; onSelect: (start: number) => void;
}) {
    const currentMark = useCurrentMark(marks);
    return (
        <>
            {marks.map((mark, i) => (
                <MenuOption
                    key={mark.start}
                    label={`${markLabel(mark, i)} · ${markTime(mark.start)}`}
                    active={mark === currentMark}
                    onSelect={() => onSelect(mark.start)}
                />
            ))}
        </>
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
