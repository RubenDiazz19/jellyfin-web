// Ventana de montaje para las rejillas largas: en el DOM solo viven las
// tarjetas que están cerca del viewport; las demás son un hueco del mismo
// tamaño.
//
// La biblioteca monta una tarjeta por título, y cada tarjeta no es un nodo:
// son el marco, el degradado, dos botones con sus suscripciones a los stores
// de visto y favoritos, el pie y el sitio del menú contextual. Con un catálogo
// grande eso son decenas de miles de nodos vivos, y el coste no se paga una
// vez sino en cada repintado. Con la ventana, el número de tarjetas montadas
// depende del alto de la pantalla, no del tamaño de la biblioteca.
//
// El hueco tiene que medir EXACTAMENTE lo que la tarjeta real: si midiera de
// menos, montar y desmontar cambiaría el alto de las filas y el scroll daría
// tirones bajo el dedo.

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { T } from '../../theme/tokens';

/**
 * Cuánto se adelanta el montaje al borde del viewport. Con casi una pantalla
 * de margen arriba y abajo, la tarjeta ya está montada y con su carátula
 * pedida mucho antes de que se vea, incluso en un scroll rápido.
 */
const ROOT_MARGIN = '900px 0px';

/**
 * Tarjetas que arrancan montadas sin esperar al observer. El primer aviso del
 * IntersectionObserver llega de forma asíncrona, así que sin esto la primera
 * pantalla se pintaría en huecos y se rellenaría un instante después. De
 * sobra para la primera pantalla de cualquier rejilla.
 */
export const EAGER_CARDS = 30;

// Un solo observer para toda la rejilla: uno por tarjeta serían mil
// suscripciones al scroll haciendo el mismo trabajo.
let observer: IntersectionObserver | null = null;
const listeners = new WeakMap<Element, (visible: boolean) => void>();

function sharedObserver(): IntersectionObserver {
    observer ??= new IntersectionObserver(
        (entries) => {
            for (const entry of entries) listeners.get(entry.target)?.(entry.isIntersecting);
        },
        { rootMargin: ROOT_MARGIN }
    );
    return observer;
}

type Props = {
    /** Ancho fijo de la tarjeta, o null si llena la columna de la rejilla. */
    width: number | null;
    /** Monta ya, sin esperar al observer. Para la primera pantalla. */
    eager?: boolean;
    children: ReactNode;
};

export function LazyCard({ width, eager = false, children }: Props) {
    const ref = useRef<HTMLDivElement>(null);
    const [visible, setVisible] = useState(eager);

    useEffect(() => {
        const el = ref.current;
        // Sin IntersectionObserver (jsdom en los tests, navegadores viejos) se
        // monta todo: la rejilla de siempre, sin ventana.
        if (!el || typeof IntersectionObserver === 'undefined') {
            setVisible(true);
            return;
        }
        listeners.set(el, setVisible);
        const io = sharedObserver();
        io.observe(el);
        return () => {
            io.unobserve(el);
            listeners.delete(el);
        };
    }, []);

    return (
        <div ref={ref}>
            {visible ? children : <CardGap width={width} />}
        </div>
    );
}

/** El hueco de una tarjeta desmontada: su marco y su pie, en blanco. */
function CardGap({ width }: { width: number | null }) {
    return (
        <div style={width == null ? { width: '100%' } : { width, flex: `0 0 ${width}px` }}>
            <div style={{
                aspectRatio: '2/3', borderRadius: 4,
                background: 'rgba(255,255,255,0.05)'
            }} />
            {/* El pie va con los mismos estilos y un espacio duro dentro: así
                su línea mide lo mismo que la de una leyenda de verdad sin
                tener que codificar aquí ninguna altura. Duro y no un espacio
                normal, que se colapsaría dejando el div sin línea y sin
                alto. */}
            <div style={{
                marginTop: 10, fontFamily: T.ui, fontSize: 11, color: T.dim,
                letterSpacing: 1, textTransform: 'uppercase'
            }}>
                {'\u00A0'}
            </div>
        </div>
    );
}
