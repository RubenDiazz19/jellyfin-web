// ViewModel para la reproducción de trailers automáticos en el Hero de la Home.
// Gestiona la máquina de estados (idle -> transitioning -> playing), temporizadores,
// precarga diferida (lazy), visibilidad en pantalla y silenciamiento.
// Regla MVVM: esta clase no importa React ni nada de presentation/.

import { signal } from '@preact/signals-core';
import { apiService, type ApiService } from '../../data/api/ApiService';
import type { CarouselSlide } from '../../data/models';
import type { TrailerSource } from '../../data/api/trailers';
export type { TrailerSource };
import { logger } from '../../shared/logger';

export type HeroTrailerState = 'idle' | 'transitioning' | 'playing';

export const DEFAULT_TRAILER_DELAY_MS = 7000;
export const DEFAULT_TRANSITION_DURATION_MS = 550;

export class HeroTrailerViewModel {
    readonly state = signal<HeroTrailerState>('idle');
    readonly trailerSource = signal<TrailerSource | null>(null);
    readonly isMuted = signal<boolean>(false);
    readonly isPaused = signal<boolean>(false);
    readonly hasTrailer = signal<boolean>(false);
    readonly activeSlideId = signal<string | null>(null);

    private delayMs: number;
    private transitionDurationMs: number;

    private countdownTimer: ReturnType<typeof setTimeout> | null = null;
    private transitionTimer: ReturnType<typeof setTimeout> | null = null;
    private currentResolutionId: string | null = null;
    private timerFired = false;

    private playTrailerAudio = true;

    constructor(
        private api: ApiService,
        options: { delayMs?: number; transitionDurationMs?: number } = {}
    ) {
        this.delayMs = options.delayMs ?? DEFAULT_TRAILER_DELAY_MS;
        this.transitionDurationMs = options.transitionDurationMs ?? DEFAULT_TRANSITION_DURATION_MS;
        
        // Cargar configuración de audio de los trailers
        void this.api.users.getCurrentUser().then(user => {
            this.playTrailerAudio = user.config.PlayTrailerAudio !== false;
            // actualizamos isMuted por defecto
            this.isMuted.value = !this.playTrailerAudio;
        }).catch(() => {});
    }

    /**
     * Invocado cuando cambia el slide activo en el Hero.
     * Cancela temporizadores previos, reinicia el estado a 'idle' e inicia
     * la precarga diferida y el temporizador si el contenido tiene trailer.
     */
    onSlideChanged(slide: { id: string; hasTrailer?: boolean; localTrailerCount?: number } | undefined): void {
        this.clearTimers();
        this.state.value = 'idle';
        this.timerFired = false;
        
        // Restaurar estado de silencio por defecto al cambiar de slide
        this.isMuted.value = !this.playTrailerAudio;

        if (!slide?.id) {
            this.activeSlideId.value = null;
            this.hasTrailer.value = false;
            this.trailerSource.value = null;
            this.currentResolutionId = null;
            return;
        }

        const slideId = slide.id;
        this.activeSlideId.value = slideId;
        this.currentResolutionId = slideId;

        // Comprobamos si tiene trailer local declarado o potencial
        const declaredTrailer = slide.hasTrailer
            || (slide.localTrailerCount != null && slide.localTrailerCount > 0);

        this.hasTrailer.value = declaredTrailer;
        this.trailerSource.value = null;

        if (!declaredTrailer) {
            return;
        }

        // 1. Precarga lazy: resolvemos la fuente de forma diferida en paralelo al temporizador
        void this.api.trailers.resolveTrailerSource({
            id: slideId,
            localTrailerCount: slide.localTrailerCount
        }).then((source) => {
            // Descartamos si el usuario ya cambió a otro slide mientras se resolvía
            if (this.currentResolutionId !== slideId) return;

            if (source) {
                this.trailerSource.value = source;
                this.hasTrailer.value = true;
                // Si el temporizador de 7s ya había vencido mientras se resolvía la fuente,
                // disparamos la transición de inmediato.
                if (this.timerFired && this.state.value === 'idle') {
                    this.startTransition();
                }
            } else {
                this.hasTrailer.value = false;
                this.trailerSource.value = null;
            }
        }).catch((err) => {
            if (this.currentResolutionId === slideId) {
                logger.debug('[HeroTrailerVM] Error resolviendo trailer:', err);
                this.hasTrailer.value = false;
                this.trailerSource.value = null;
            }
        });

        // 2. Temporizador de inactividad de 7 segundos
        this.countdownTimer = setTimeout(() => {
            if (this.currentResolutionId !== slideId) return;
            this.timerFired = true;

            // Si la fuente ya está disponible, arrancamos la transición
            if (this.trailerSource.value) {
                this.startTransition();
            }
        }, this.delayMs);
    }

    private startTransition(): void {
        this.state.value = 'transitioning';
        if (this.transitionTimer) clearTimeout(this.transitionTimer);

        this.transitionTimer = setTimeout(() => {
            if (this.state.value === 'transitioning') {
                this.state.value = 'playing';
            }
        }, this.transitionDurationMs);
    }

    /**
     * Pausa o reanuda la reproducción según el Hero esté visible en el viewport.
     * Permite ahorrar CPU y batería cuando el usuario hace scroll hacia la biblioteca.
     */
    onHeroOffscreen(isOffscreen: boolean): void {
        this.isPaused.value = isOffscreen;
    }

    /**
     * Fallback ante fallo de carga o reproducción de vídeo.
     * Revierte suavemente al estado estático original.
     */
    onError(err?: unknown): void {
        logger.debug('[HeroTrailerVM] Fallo en reproducción de trailer, revirtiendo a idle:', err);
        this.clearTimers();
        this.state.value = 'idle';
    }

    /** Alterna el estado de silencio del trailer. */
    toggleMute(): void {
        this.isMuted.value = !this.isMuted.value;
    }

    /** Establece explícitamente el estado de silencio. */
    setMuted(muted: boolean): void {
        this.isMuted.value = muted;
    }

    /** Reinicia inmediatamente el estado a idle. */
    reset(): void {
        this.clearTimers();
        this.state.value = 'idle';
        this.timerFired = false;
    }

    /** Cancela temporizadores en vuelo. */
    private clearTimers(): void {
        if (this.countdownTimer) {
            clearTimeout(this.countdownTimer);
            this.countdownTimer = null;
        }
        if (this.transitionTimer) {
            clearTimeout(this.transitionTimer);
            this.transitionTimer = null;
        }
    }

    /** Limpia recursos y suscripciones. */
    dispose(): void {
        this.clearTimers();
        this.currentResolutionId = null;
        this.state.value = 'idle';
        this.trailerSource.value = null;
    }
}

export const heroTrailerVM = new HeroTrailerViewModel(apiService);
