import React, { useEffect, useRef, useState, type ReactNode } from 'react';
import { observeElement } from '../../../shared/useIntersectionObserver';

// Se monta un observer genérico para las secciones (Similar, CastList)
// con un margen grande (900px) para que se monten bastante antes de
// que el usuario llegue a ellas haciendo scroll.
const ROOT_MARGIN = '900px 0px';

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
        return observeElement(el, ROOT_MARGIN, (isVisible) => {
            if (isVisible) setVisible(true);
        });
    }, []);

    return (
        <div ref={ref} style={!visible ? { minHeight } : undefined}>
            {visible ? children : null}
        </div>
    );
}
