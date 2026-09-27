import type { ApiService } from '../../data/api/ApiService';
import { TICKS_PER_SECOND } from './format';

const PROGRESS_REPORT_MS = 10_000;

export class ProgressReporter {
    private progressTimer: ReturnType<typeof setInterval> | null = null;
    private video: HTMLVideoElement | null = null;
    private itemId = '';
    private playMethod?: 'DirectPlay' | 'DirectStream' | 'Transcode';
    private closed = false;

    constructor(private api: ApiService) {}

    attach(video: HTMLVideoElement) {
        this.video = video;
        this.closed = false;
    }

    detach() {
        this.stopProgressTimer();
        this.video = null;
        this.closed = true;
    }

    startPlayback(itemId: string, playMethod?: 'DirectPlay' | 'DirectStream' | 'Transcode') {
        this.itemId = itemId;
        this.playMethod = playMethod;
        this.closed = false;
    }

    startProgressTimer = () => {
        this.stopProgressTimer();
        this.progressTimer = setInterval(() => {
            void this.reportProgress();
        }, PROGRESS_REPORT_MS);
    };

    stopProgressTimer = () => {
        if (this.progressTimer) clearInterval(this.progressTimer);
        this.progressTimer = null;
    };

    reportProgress = async () => {
        const v = this.video;
        if (!v || !this.itemId || this.closed) return;
        
        await this.api.playback.reportPlaybackProgress(
            this.itemId,
            Math.floor(v.currentTime * TICKS_PER_SECOND),
            v.paused,
            this.playMethod
        );
    };
}
