import { useEffect, useRef } from 'react';
import loading from 'components/loading/loading';
import App from './App';
import { toggleFullscreen } from '../shared/fullscreen';
import { installFocusPreventScrollPatch } from '../shared/focusPatch';
import { MobileThemeProvider } from '../presentation/theme/MobileThemeProvider';
import { InstallBanner } from '../presentation/components/pwa/InstallBanner';
import { OfflineIndicator } from '../presentation/components/pwa/OfflineIndicator';
import { initPwa, registerServiceWorker, watchStandalone } from '../shared/pwa';
import '../presentation/styles/global.css';

// Entry point del frontend dentro de jellyfin-web. El RootAppRouter oficial
// monta este componente para cualquier URL que no matchee dashboard/wizard.
// Añadimos una clase al <body> mientras el frontend está montado: los estilos
// globales agresivos (fondos, resets) están scopeados a esa clase para no
// contaminar la UI de admin/wizard si el usuario navega allí.
export const Component = () => {
    const cleanupRefs = useRef<Array<() => void>>([]);
    useEffect(() => {
        document.body.classList.add('jf-frontend-active');
        // index.jsx hace loading.show() antes de renderizar el árbol React y
        // deja que el consumidor lo oculte cuando termina de montarse. El
        // modern/legacy tienen sus propios hooks; nuestro frontend lo hace aquí.
        loading.hide();

        cleanupRefs.current.push(installFocusPreventScrollPatch());

        // PWA (solo actúa en mobile/tablet; en desktop todo esto es no-op):
        // captura del prompt de instalación, service worker y clase
        // jfp-standalone cuando corre instalada.
        initPwa();
        void registerServiceWorker();
        cleanupRefs.current.push(watchStandalone());

        // Interceptamos F11: algunos navegadores derivados de Chromium tienen
        // implementación rota (sólo maximizan la ventana) y dejan un borde
        // blanco visible. La Fullscreen API da fullscreen real a nivel de OS.
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'F11') {
                e.preventDefault();
                void toggleFullscreen();
            }
        };
        window.addEventListener('keydown', onKey, { capture: true });

        return () => {
            document.body.classList.remove('jf-frontend-active');
            window.removeEventListener('keydown', onKey, { capture: true });
            cleanupRefs.current.forEach(fn => { fn(); });
            cleanupRefs.current = [];
        };
    }, []);
    // MobileThemeProvider: tokens M3 en mobile/tablet; passthrough en desktop.
    // Los overlays PWA se auto-ocultan en desktop (layout null en contexto).
    return (
        <MobileThemeProvider>
            <App />
            <OfflineIndicator />
            <InstallBanner />
        </MobileThemeProvider>
    );
};

export default Component;
