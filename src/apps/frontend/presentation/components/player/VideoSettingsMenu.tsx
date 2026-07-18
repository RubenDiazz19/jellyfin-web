// Menú de ajustes del reproductor: pista de audio y subtítulos.
import { useEffect, useRef, useState } from 'react';
import { videoPlayerVM } from '../../../domain/viewModels/VideoPlayerViewModel';
import { useViewModel } from '../../../domain/bridge/useViewModel';
import { PlayerIc } from './playerIcons';

export function VideoSettingsMenu() {
    useViewModel(videoPlayerVM);
    const [open, setOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);

    // Cierra el menú al hacer click fuera.
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
    const hasOptions = audio.length > 1 || subs.length > 0;
    if (!hasOptions) return null;

    return (
        <div className="jfp-video-settings" ref={rootRef}>
            <button
                type="button"
                className={`jfp-video-btn${open ? ' is-active' : ''}`}
                onClick={() => setOpen((v) => !v)}
                aria-label="Audio y subtítulos"
                aria-expanded={open}
            >
                <PlayerIc.Settings />
            </button>
            {open && (
                <div className="jfp-video-settings-menu">
                    {audio.length > 1 && (
                        <section>
                            <header>Audio</header>
                            {audio.map((a) => (
                                <MenuOption
                                    key={a.index}
                                    label={a.displayTitle}
                                    active={videoPlayerVM.selectedAudio.value === a.index}
                                    onSelect={() => videoPlayerVM.setAudioTrack(a.index)}
                                />
                            ))}
                        </section>
                    )}
                    {subs.length > 0 && (
                        <section>
                            <header>Subtítulos</header>
                            <MenuOption
                                label="Desactivados"
                                active={videoPlayerVM.selectedSubtitle.value == null}
                                onSelect={() => videoPlayerVM.setSubtitleTrack(null)}
                            />
                            {subs.map((s) => (
                                <MenuOption
                                    key={s.index}
                                    label={s.displayTitle}
                                    active={videoPlayerVM.selectedSubtitle.value === s.index}
                                    onSelect={() => videoPlayerVM.setSubtitleTrack(s.index)}
                                />
                            ))}
                        </section>
                    )}
                </div>
            )}
        </div>
    );
}

function MenuOption({
    label, active, onSelect
}: {
    label: string; active: boolean; onSelect: () => void;
}) {
    return (
        <button
            type="button"
            className={`jfp-video-settings-option${active ? ' is-active' : ''}`}
            onClick={onSelect}
        >
            <span className="jfp-video-settings-dot" aria-hidden />
            {label}
        </button>
    );
}
