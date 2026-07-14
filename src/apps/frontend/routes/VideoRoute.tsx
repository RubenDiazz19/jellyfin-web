import React from 'react';

import AppBody from 'components/AppBody';
import VideoPage from 'apps/modern/routes/video';

// La VideoPage oficial usa ViewManagerPage → viewContainer, que necesita
// encontrar `.mainAnimatedPages` en el DOM. Ese div lo pinta AppBody, así
// que envolvemos aquí para no tener que meter todo nuestro AppLayout en la
// ruta de vídeo (que trae el nav/UI custom y arruinaría el fullscreen).
export const Component = () => (
    <AppBody>
        <VideoPage />
    </AppBody>
);

export default Component;
