import React, { useEffect } from 'react';

import AppBody from 'components/AppBody';
import VideoPage from 'apps/modern/routes/video';
import loading from 'components/loading/loading';
import { playbackManager } from 'components/playback/playbackmanager';

import { installFocusPreventScrollPatch } from '../shared/focusPatch';

// La VideoPage oficial usa ViewManagerPage → viewContainer, que necesita
// encontrar `.mainAnimatedPages` en el DOM. Ese div lo pinta AppBody, así
// que envolvemos aquí para no tener que meter todo nuestro AppLayout en la
// ruta de vídeo (que trae el nav/UI custom y arruinaría el fullscreen).
export const Component = () => {
    useEffect(() => {
        // AppLayout no se monta en /video (esta ruta está registrada fuera
        // del splat en app/routes.tsx), así que replicamos los ajustes
        // globales que serían inconsistentes si sólo aplicaran a la app:
        //   1. `jf-video-active` desactiva el scrollbar del navegador y
        //      neutraliza el .backdropContainer del RootAppRouter, evitando
        //      la barra oscura a la derecha y el flash de fondo del theme.
        //   2. `loading.hide()` — index.jsx deja el splash del bootstrap
        //      visible y espera al consumidor. Sin esto el spinner queda
        //      encima del vídeo hasta el primer play.
        //   3. `focus preventScroll` — el video-osd usa `focusManager.focus`
        //      que llama a `.focus()`; sin el patch, el hover sobre
        //      controles roba scroll y desplaza el layout.
        document.body.classList.add('jf-video-active');
        loading.hide();
        const restoreFocus = installFocusPreventScrollPatch();
        return () => {
            document.body.classList.remove('jf-video-active');
            restoreFocus();
            // Al desmontar VideoRoute, AppBody llama a viewContainer.reset()
            // que vacía el DOM del videoOsdPage sin disparar `viewbeforehide`,
            // el hook que el controller del video usa para parar la reproducción
            // y reportar el stop al servidor. Sin este stop explícito, el
            // <video> sigue vivo y sonando después de salir de /video.
            // playbackManager.stop() reporta el progreso (mantiene "continue
            // watching") y libera el player.
            try { playbackManager.stop(); } catch { /* no active player */ }
        };
    }, []);
    return (
        <AppBody>
            <VideoPage />
        </AppBody>
    );
};

export default Component;
