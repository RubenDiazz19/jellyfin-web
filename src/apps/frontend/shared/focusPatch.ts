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
// custom — al desmontar (dashboard, wizard), el caller restaura el `focus`
// original para no romper el resto de jellyfin-web.

// Eventos de puntero para los que ignoramos llamadas a .focus() —
// jellyfin-web tiene handlers que llaman focus() sobre el elemento
// hovered, robando el foco al input activo mientras el usuario escribe
// y (peor) scrolleando la página. Los clicks (mousedown/pointerdown)
// SÍ deben poder focusear.
const HOVER_EVENTS = new Set([
    'pointerenter', 'pointerover', 'pointermove',
    'mouseenter', 'mouseover', 'mousemove'
]);

export function installFocusPreventScrollPatch(): () => void {
    const original = HTMLElement.prototype.focus;
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
