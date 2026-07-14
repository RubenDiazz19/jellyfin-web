import React, { useEffect, useRef } from 'react';
import loading from 'components/loading/loading';
import App from './App';
import { toggleFullscreen } from './utils/fullscreen';
import './styles/global.css';

// jellyfin-web trae varios subsistemas (mouseManager, focusManager,
// scrollManager, autoFocuser…) diseñados para navegación por mando en modo
// TV. Cuando la app corre en desktop *dentro de nuestro frontend* alguno
// de esos handlers acaba llamando a `element.focus()` sin `preventScroll`
// en respuesta a eventos de puntero (pointerenter/mouseenter), lo que
// hace que el navegador *scrollee* la página cada vez que el ratón pasa
// por encima de un input o un botón que quede fuera del viewport. Además
// visualmente se ven inputs "auto-seleccionados" al hover.
//
// Estrategia defensiva: mientras nuestro frontend está montado,
// monkey-patcheamos `HTMLElement.prototype.focus` para forzar
// `preventScroll: true` en cualquier llamada. No cambia qué elemento gana
// foco, sólo evita el scroll indeseado. Es local al montaje del frontend
// custom — al desmontar (entrar en /video, dashboard, wizard), restauramos
// el `focus` original para no romper el resto de jellyfin-web.
function installFocusPreventScrollPatch() {
    const original = HTMLElement.prototype.focus;
    // Eventos de puntero para los que ignoramos llamadas a .focus() —
    // jellyfin-web tiene handlers que llaman focus() sobre el elemento
    // hovered, robando el foco al input activo mientras el usuario escribe
    // y (peor) scrolleando la página. Los clicks (mousedown/pointerdown)
    // SÍ deben poder focusear.
    const HOVER_EVENTS = new Set([
        'pointerenter', 'pointerover', 'pointermove',
        'mouseenter', 'mouseover', 'mousemove'
    ]);
    HTMLElement.prototype.focus = function(options?: FocusOptions) {
        // `window.event` está deprecated pero sigue funcionando en Chromium:
        // devuelve el evento que se está despachando ahora mismo. Si es un
        // evento de hover, ignoramos silenciosamente la petición de foco.
        const evt = (window as unknown as { event?: Event }).event;
        if (evt && HOVER_EVENTS.has(evt.type)) {
            return;
        }
        return original.call(this, { ...(options || {}), preventScroll: true });
    };
    return () => {
        HTMLElement.prototype.focus = original;
    };
}

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
            cleanupRefs.current.forEach(fn => fn());
            cleanupRefs.current = [];
        };
    }, []);
    return <App />;
};

export default Component;
