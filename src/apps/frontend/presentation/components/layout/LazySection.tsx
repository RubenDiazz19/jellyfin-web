import React, { useEffect, useRef, useState, type ReactNode } from 'react';

// Se monta un observer genérico para las secciones (Similar, CastList)
// con un margen grande (900px) para que se monten bastante antes de
// que el usuario llegue a ellas haciendo scroll.
const ROOT_MARGIN = '900px 0px';

let observer: IntersectionObserver | null = null;
const listeners = new WeakMap<Element, (visible: boolean) => void>();

function sharedObserver(): IntersectionObserver {
    observer ??= new IntersectionObserver(
        (entries) => {
            for (const entry of entries) {
                if (entry.isIntersecting) {
                    listeners.get(entry.target)?.(true);
                }
            }
        },
        { rootMargin: ROOT_MARGIN }
    );
    return observer;
}

type Props = {
    children: ReactNode;
    /** Alto mínimo reservado mientras no se ha renderizado para evitar saltos de scroll */
    minHeight?: number;
};

export function LazySection({ children, minHeight = 200 }: Props) {
    const ref = useRef<HTMLDivElement>(null);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const el = ref.current;
        if (!el || typeof IntersectionObserver === 'undefined') {
            setVisible(true);
            return;
        }

        // Una vez que es visible, ya no se desmonta:
        // las secciones enteras no son tantas como las tarjetas,
        // no hace falta liberarlas, solo retrasar su montaje inicial.
        listeners.set(el, (isVisible) => {
            if (isVisible) {
                setVisible(true);
                const currentIo = observer;
                if (currentIo) currentIo.unobserve(el);
            }
        });

        const io = sharedObserver();
        io.observe(el);

        return () => {
            io.unobserve(el);
            listeners.delete(el);
        };
    }, []);

    return (
        <div ref={ref} style={!visible ? { minHeight } : undefined}>
            {visible ? children : null}
        </div>
    );
}
