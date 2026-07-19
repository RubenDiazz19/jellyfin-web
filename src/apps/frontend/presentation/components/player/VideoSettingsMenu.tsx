// Menús de pistas del reproductor, divididos en tres botones independientes:
// subtítulos, audio y velocidad. Solo un panel abierto a la vez.
import { useEffect, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { videoPlayerVM } from '../../../domain/viewModels/VideoPlayerViewModel';
import { useViewModel } from '../../../domain/bridge/useViewModel';
import { PlayerIc } from './playerIcons';

const RATES = [0.5, 0.75, 1, 1.25, 1.5, 2];

type MenuId = 'subs' | 'audio' | 'speed';

export function VideoSettingsMenu() {
    useViewModel(videoPlayerVM);
    const [open, setOpen] = useState<MenuId | null>(null);
    const rootRef = useRef<HTMLDivElement>(null);

    // Cierra el panel abierto al hacer click fuera del grupo.
    useEffect(() => {
        if (!open) return;
        const onPointerDown = (e: PointerEvent) => {
            if (!rootRef.current?.contains(e.target as Node)) setOpen(null);
        };
        window.addEventListener('pointerdown', onPointerDown);
        return () => window.removeEventListener('pointerdown', onPointerDown);
    }, [open]);

    const audio = videoPlayerVM.audioTracks.value;
    const subs = videoPlayerVM.subtitleTracks.value;
    const rate = videoPlayerVM.playbackRate.value;
    const toggle = (id: MenuId) => setOpen((v) => (v === id ? null : id));

    return (
        <div ref={rootRef} className='jfp-video-settings-cluster'>
            {subs.length > 0 && (
                <TrackMenu
                    id='subs' label='Subtítulos' icon={<PlayerIc.Subtitles />}
                    open={open === 'subs'} onToggle={toggle}
                >
                    <MenuOption
                        label='Desactivados'
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
                </TrackMenu>
            )}
            {audio.length > 0 && (
                <TrackMenu
                    id='audio' label='Audio' icon={<PlayerIc.AudioTrack />}
                    open={open === 'audio'} onToggle={toggle}
                >
                    {audio.map((a) => (
                        <MenuOption
                            key={a.index}
                            label={a.displayTitle}
                            active={videoPlayerVM.selectedAudio.value === a.index}
                            onSelect={() => videoPlayerVM.setAudioTrack(a.index)}
                        />
                    ))}
                </TrackMenu>
            )}
            <TrackMenu
                id='speed' label='Velocidad' icon={<PlayerIc.Speed />}
                open={open === 'speed'} onToggle={toggle}
            >
                {RATES.map((r) => (
                    <MenuOption
                        key={r}
                        label={r === 1 ? 'Normal' : `${r}×`}
                        active={rate === r}
                        onSelect={() => videoPlayerVM.setPlaybackRate(r)}
                    />
                ))}
            </TrackMenu>
        </div>
    );
}

function TrackMenu({
    id, label, icon, open, onToggle, children
}: {
    id: MenuId;
    label: string;
    icon: ReactElement;
    open: boolean;
    onToggle: (id: MenuId) => void;
    children: ReactNode;
}) {
    return (
        <div className='jfp-video-settings'>
            <button
                type='button'
                className={`jfp-video-btn${open ? ' is-active' : ''}`}
                onClick={() => onToggle(id)}
                aria-label={label}
                aria-expanded={open}
            >
                {icon}
            </button>
            {open && (
                <div className='jfp-video-settings-menu'>
                    <section>
                        <header>{label}</header>
                        {children}
                    </section>
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
            type='button'
            className={`jfp-video-settings-option${active ? ' is-active' : ''}`}
            onClick={onSelect}
        >
            <span className='jfp-video-settings-dot' aria-hidden />
            {label}
        </button>
    );
}
