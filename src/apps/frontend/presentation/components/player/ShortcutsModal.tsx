import globalize from 'lib/globalize';

import { useEffect } from 'react';
import ReactDOM from 'react-dom';

type Props = {
    onClose: () => void;
};

type ShortcutItem = {
    keys: string[];
    description: string;
};

type ShortcutGroup = {
    title: string;
    items: ShortcutItem[];
};

export function ShortcutsModal({ onClose }: Props) {
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape' || e.key === '?') {
                e.stopPropagation();
                onClose();
            }
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [onClose]);

    const groups: ShortcutGroup[] = [
        {
            title: globalize.translate('ShortcutCategoryPlayback'),
            items: [
                { keys: ['Espacio', 'K'], description: globalize.translate('ShortcutPlayPause') },
                { keys: ['N'], description: globalize.translate('ShortcutNextEpisode') },
                { keys: ['[', ']'], description: globalize.translate('ShortcutPlaybackSpeed') },
                { keys: ['0–9'], description: globalize.translate('ShortcutSeekPercent') }
            ]
        },
        {
            title: globalize.translate('ShortcutCategoryNavigation'),
            items: [
                { keys: ['←', '→'], description: globalize.translate('ShortcutSeekShort') },
                { keys: ['J', 'L'], description: globalize.translate('ShortcutSeek10s') },
                { keys: ['S'], description: globalize.translate('ShortcutSkipSegment') }
            ]
        },
        {
            title: globalize.translate('ShortcutCategoryAudioSubs'),
            items: [
                { keys: ['↑', '↓'], description: globalize.translate('ShortcutVolume') },
                { keys: ['M'], description: globalize.translate('ShortcutMute') },
                { keys: ['C'], description: globalize.translate('ShortcutSubtitles') },
                { keys: ['G', 'H'], description: globalize.translate('ShortcutSubtitleOffset') }
            ]
        },
        {
            title: globalize.translate('ShortcutCategoryGeneral'),
            items: [
                { keys: ['F'], description: globalize.translate('ShortcutFullscreen') },
                { keys: ['P'], description: globalize.translate('ShortcutPip') },
                { keys: ['?'], description: globalize.translate('ShortcutHelp') },
                { keys: ['Esc'], description: globalize.translate('ButtonClose') }
            ]
        }
    ];

    return ReactDOM.createPortal(
        <div
            className='jfp-shortcuts-backdrop'
            onMouseDown={onClose}
            onClick={(e) => e.stopPropagation()}
        >
            <div
                className='jfp-shortcuts-dialog'
                onMouseDown={(e) => e.stopPropagation()}
            >
                <div className='jfp-shortcuts-header'>
                    <h2 className='jfp-shortcuts-title'>
                        {globalize.translate('KeyboardShortcuts')}
                    </h2>
                    <button
                        type='button'
                        className='jfp-shortcuts-close'
                        onClick={onClose}
                        aria-label={globalize.translate('ButtonClose')}
                    >
                        ✕
                    </button>
                </div>

                <div className='jfp-shortcuts-grid'>
                    {groups.map((group) => (
                        <div key={group.title} className='jfp-shortcuts-group'>
                            <h3 className='jfp-shortcuts-group-title'>{group.title}</h3>
                            <div className='jfp-shortcuts-list'>
                                {group.items.map((item) => (
                                    <div key={item.description} className='jfp-shortcuts-row'>
                                        <span className='jfp-shortcuts-desc'>{item.description}</span>
                                        <div className='jfp-shortcuts-keys'>
                                            {item.keys.map((k) => (
                                                <kbd key={k} className='jfp-shortcut-key'>{k}</kbd>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>,
        document.body
    );
}
