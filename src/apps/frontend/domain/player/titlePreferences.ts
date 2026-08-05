// Los idiomas que el usuario ha elegido para un título concreto.
//
// «Título» es la serie si lo que se reproduce es un episodio, y la película si
// no: elegir audio en el 1x01 tiene que valer para el 1x02. Manda sobre la
// preferencia global del usuario que aplica el servidor, y por eso hay que
// saber si existe ANTES de pedir PlaybackInfo (ver `hasAny`).
//
// Vive fuera del ViewModel porque es una preferencia persistida con sus
// propias reglas de lectura y escritura; el VM solo pregunta con qué pistas
// abrir y le cuenta lo que el usuario elige.

import { signal } from '@preact/signals-core';
import { preferredTrackIndices, type PlaybackContext } from '../../data/api/playbackContext';
import {
    clearTitleLanguagePref, countTitleLanguagePrefs, getTitleLanguagePref,
    setTitleLanguagePref, type TitleLanguagePref
} from '../../data/preferences/languagePrefs';

export class TitlePreferences {
    /**
     * Idiomas recordados para este título, o null si nunca se han tocado. La
     * View los muestra en el menú de pistas.
     */
    readonly pref = signal<TitleLanguagePref | null>(null);

    /** El item en reproducción es un episodio: la preferencia es de la serie. */
    readonly isSeries = signal(false);

    /** Id bajo el que se recuerdan las pistas: la serie, o la película. */
    private titleId = '';

    /** Las preferencias se guardan separadas por cuenta. */
    constructor(private userId: () => string) {}

    /**
     * Estado de partida de un item recién abierto: todavía no se sabe si es
     * un episodio ni de qué serie, así que el propio item hace de título.
     */
    reset(itemId: string): void {
        this.titleId = itemId;
        this.isSeries.value = false;
        this.pref.value = null;
    }

    /** Con el contexto ya cargado: título real y lo que hubiera recordado. */
    adopt(context: PlaybackContext): void {
        this.titleId = context.titleId;
        this.isSeries.value = context.isEpisode;
        this.pref.value = getTitleLanguagePref(this.userId(), context.titleId);
    }

    /**
     * ¿Este usuario tiene idiomas recordados de ALGÚN título?
     *
     * Lo pregunta `open()` para decidir si merece la pena esperar al contexto
     * antes de pedir la fuente: sin ninguno recordado —la primera
     * reproducción— esa espera era una vuelta a la red de más delante del
     * primer fotograma.
     */
    hasAny(): boolean {
        return countTitleLanguagePrefs(this.userId()) > 0;
    }

    /**
     * Los índices de pista con los que abrir. La traducción vive en la capa de
     * datos porque el pre-calentamiento de la ficha tiene que llegar a los
     * mismos: ver `preferredTrackIndices`.
     */
    tracksFor(context: PlaybackContext | null) {
        return preferredTrackIndices(this.pref.value, context);
    }

    /** Recuerda un idioma para este título (o para su serie). */
    remember(patch: TitleLanguagePref): void {
        if (!this.titleId) return;
        const userId = this.userId();
        setTitleLanguagePref(userId, this.titleId, patch);
        this.pref.value = getTitleLanguagePref(userId, this.titleId);
    }

    /**
     * Olvida los idiomas recordados de este título: a partir de la próxima
     * reproducción vuelve a mandar la preferencia del usuario.
     */
    clear = () => {
        if (!this.titleId) return;
        clearTitleLanguagePref(this.userId(), this.titleId);
        this.pref.value = null;
    };
}
