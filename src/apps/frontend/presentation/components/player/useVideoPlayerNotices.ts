import { useEffect, useRef, useState, useCallback } from 'react';
import globalize from 'lib/globalize';

const GESTURE_HINTS_MS = 4200;
const SUGGEST_LANDSCAPE_MS = 3800;
const HINTS_KEY = 'jfp-gesture-hints-seen';

type Params = {
    touch: boolean;
    portrait: boolean;
    showNotice: (text: string) => void;
};

export function useVideoPlayerNotices({ touch, portrait, showNotice }: Params) {
    const [showHints, setShowHints] = useState(false);
    const [suggestLandscape, setSuggestLandscape] = useState(false);

    // Hints de gestos en el primer uso táctil (una vez, persistido).
    useEffect(() => {
        if (!touch) return;
        if (localStorage.getItem(HINTS_KEY)) return;
        setShowHints(true);
        const t = setTimeout(() => {
            setShowHints(false);
            localStorage.setItem(HINTS_KEY, '1');
        }, GESTURE_HINTS_MS);
        return () => clearTimeout(t);
    }, [touch]);

    const dismissHints = useCallback(() => {
        setShowHints(false);
        localStorage.setItem(HINTS_KEY, '1');
    }, []);

    // Sugerencia de landscape: chip breve al reproducir en vertical (una vez
    // por sesión, y solo si no está ya en horizontal).
    const suggestedRef = useRef(false);
    useEffect(() => {
        if (!touch || !portrait || suggestedRef.current) return;
        suggestedRef.current = true;
        setSuggestLandscape(true);
        const t = setTimeout(() => setSuggestLandscape(false), SUGGEST_LANDSCAPE_MS);
        return () => clearTimeout(t);
    }, [touch, portrait]);

    // Aviso de temporizador de apagado completado.
    useEffect(() => {
        const onSleepExpired = () => {
            showNotice(globalize.translate('SleepTimerExpired'));
        };
        window.addEventListener('jfp-sleep-timer-expired', onSleepExpired);
        return () => window.removeEventListener('jfp-sleep-timer-expired', onSleepExpired);
    }, [showNotice]);

    return { showHints, dismissHints, suggestLandscape };
}
