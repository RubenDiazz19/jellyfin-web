// Colaborador de VideoPlayerViewModel para la gestión del temporizador de apagado (Sleep Timer).
// Permite pausar la reproducción al terminar el episodio o tras un tiempo establecido (15, 30, 45, 60 min).
// Regla MVVM: sin dependencias de React ni de presentation/.

import { signal } from '@preact/signals-core';

export type SleepTimerMode = 'off' | 'episode' | '15' | '30' | '45' | '60';

export class SleepTimerTracker {
    mode = signal<SleepTimerMode>('off');
    remainingSeconds = signal<number | null>(null);

    private timerId: ReturnType<typeof setInterval> | null = null;

    constructor(private readonly onExpire: () => void) {}

    /** Configura el modo del temporizador de apagado. */
    setMode(newMode: SleepTimerMode): void {
        this.clearTimer();
        this.mode.value = newMode;

        if (newMode === 'off' || newMode === 'episode') {
            this.remainingSeconds.value = null;
            return;
        }

        const minutes = Number(newMode);
        if (!Number.isFinite(minutes) || minutes <= 0) {
            this.mode.value = 'off';
            this.remainingSeconds.value = null;
            return;
        }

        const totalSeconds = minutes * 60;
        this.remainingSeconds.value = totalSeconds;

        this.timerId = setInterval(() => {
            const cur = this.remainingSeconds.value;
            if (cur == null || cur <= 1) {
                this.clearTimer();
                this.mode.value = 'off';
                this.remainingSeconds.value = null;
                this.onExpire();
            } else {
                this.remainingSeconds.value = cur - 1;
            }
        }, 1000);
    }

    /**
     * Llamado cuando un episodio finaliza.
     * @returns true si el modo era 'episode' y debe detener el auto-avance.
     */
    handleEpisodeEnd(): boolean {
        if (this.mode.value === 'episode') {
            this.setMode('off');
            this.onExpire();
            return true;
        }
        return false;
    }

    private clearTimer(): void {
        if (this.timerId != null) {
            clearInterval(this.timerId);
            this.timerId = null;
        }
    }

    reset(): void {
        this.clearTimer();
        this.mode.value = 'off';
        this.remainingSeconds.value = null;
    }

    dispose(): void {
        this.reset();
    }
}
