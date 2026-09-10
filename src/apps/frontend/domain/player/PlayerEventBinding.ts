// Enlace de eventos del elemento <video> y documento con el VideoPlayerViewModel.
// Extraído de VideoPlayerViewModel para reducir tamaño y modularizar el reproductor.

import globalize from 'lib/globalize';
import type { Signal } from '@preact/signals-core';
import { logger } from '../logger';
import { clamp } from '../../shared/math';

export interface PlayerEventHost {
    duration: Signal<number>;
    volume: Signal<number>;
    muted: Signal<boolean>;
    playing: Signal<boolean>;
    buffering: Signal<boolean>;
    loading: Signal<boolean>;
    ended: Signal<boolean>;
    playbackRate: Signal<number>;
    pipAvailable: Signal<boolean>;
    pipActive: Signal<boolean>;
    fullscreen: Signal<boolean>;
    error: Signal<string | null>;

    publishTime(time: number): void;
    syncSegments(time: number): void;
    syncAutoNext(time: number, duration: number): void;
    startProgressTimer(): void;
    stopProgressTimer(): void;
    reportProgress(): Promise<void>;
    flushPendingSubtitle(): void;
    handleEpisodeEnd(): boolean;
    syncMediaSessionPlayback(): void;
    syncMediaSessionPosition(opts?: { immediate?: boolean }): void;
    watchCast(video: HTMLVideoElement): () => void;
    retrySource(): boolean;
    isClosed(): boolean;
    setHasStarted(started: boolean): void;
}

export class PlayerEventBinding {
    private detachFns: (() => void)[] = [];

    attach(
        video: HTMLVideoElement,
        container: HTMLElement,
        host: PlayerEventHost,
        volumeKey: string
    ): () => void {
        const savedVolume = Number(localStorage.getItem(volumeKey) ?? '1');
        video.volume = Number.isFinite(savedVolume) ? clamp(savedVolume, 0, 1) : 1;
        host.volume.value = video.volume;

        video.defaultPlaybackRate = 1;
        video.playbackRate = 1;

        const on = <K extends keyof HTMLVideoElementEventMap>(
            ev: K, fn: () => void
        ) => {
            video.addEventListener(ev, fn);
            this.detachFns.push(() => video.removeEventListener(ev, fn));
        };

        on('timeupdate', () => {
            host.publishTime(video.currentTime);
            host.syncSegments(video.currentTime);
            host.syncAutoNext(video.currentTime, host.duration.value);
        });
        on('durationchange', () => {
            if (Number.isFinite(video.duration)) host.duration.value = video.duration;
        });
        on('play', () => {
            host.playing.value = true;
            host.startProgressTimer();
        });
        on('pause', () => {
            host.playing.value = false;
            host.stopProgressTimer();
            void host.reportProgress();
        });
        on('waiting', () => { host.buffering.value = true; });
        on('playing', () => {
            host.buffering.value = false;
            host.loading.value = false;
            host.setHasStarted(true);
            host.flushPendingSubtitle();
        });
        on('canplay', () => { host.buffering.value = false; host.loading.value = false; });
        on('volumechange', () => {
            host.volume.value = video.volume;
            host.muted.value = video.muted;
            localStorage.setItem(volumeKey, String(video.volume));
        });
        on('ended', () => {
            host.playing.value = false;
            host.stopProgressTimer();
            void host.reportProgress();
            if (host.handleEpisodeEnd()) {
                return;
            }
            host.ended.value = true;
        });
        on('ratechange', () => { host.playbackRate.value = video.playbackRate; });

        on('play', () => host.syncMediaSessionPlayback());
        on('pause', () => host.syncMediaSessionPlayback());
        on('timeupdate', () => host.syncMediaSessionPosition());
        on('durationchange', () => host.syncMediaSessionPosition({ immediate: true }));
        on('ratechange', () => host.syncMediaSessionPosition({ immediate: true }));

        host.pipAvailable.value =
            typeof video.requestPictureInPicture === 'function'
            // eslint-disable-next-line compat/compat -- feature-detect de PiP
            && !!document.pictureInPictureEnabled;
        on('enterpictureinpicture', () => { host.pipActive.value = true; });
        on('leavepictureinpicture', () => { host.pipActive.value = false; });

        this.detachFns.push(host.watchCast(video));

        on('error', () => {
            if (host.isClosed()) return;
            if (!video.currentSrc && !video.getAttribute('src')) return;
            logger.error(
                '[player] el <video> ha fallado',
                { code: video.error?.code, message: video.error?.message, src: video.currentSrc }
            );
            if (host.retrySource()) return;
            host.error.value = globalize.translate('MessagePlaybackFailed');
            host.loading.value = false;
        });

        const onFsChange = () => {
            host.fullscreen.value = !!document.fullscreenElement;
        };
        document.addEventListener('fullscreenchange', onFsChange);
        this.detachFns.push(() => document.removeEventListener('fullscreenchange', onFsChange));

        return () => this.detach();
    }

    detach(): void {
        for (const fn of this.detachFns) fn();
        this.detachFns = [];
    }
}
