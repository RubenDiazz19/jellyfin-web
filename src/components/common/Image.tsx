// Componente canónico de imagen en React (F2). Es el ÚNICO sitio que
// implementa la carga de una imagen: lazy loading, placeholder blurhash y
// fade-in según los ajustes del usuario.
//
// Los otros dos "sistemas de imágenes" del repo no son alternativas:
//   - `components/Image.tsx` es un marco MUI (superficie + aspect-ratio +
//     skeleton + icono de fallback) que delega aquí el <img>. No duplica nada.
//   - `components/images/imageLoader.js` es el lazy loading imperativo de las
//     tarjetas que se construyen como HTML a mano (cardBuilder, guide…). No
//     se puede sustituir por un componente React mientras exista ese renderer;
//     se cae con F4/G1/G2.

import React, { useCallback, useState } from 'react';
import { BlurhashCanvas } from 'react-blurhash';
import { LazyLoadImage } from 'react-lazy-load-image-component';

import * as userSettings from '../../scripts/settings/userSettings';

/** Ocupa por completo al ancestro posicionado (tarjetas y listas). */
const fillStyle: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    width: '100%',
    height: '100%',
    zIndex: 0
};

/** En el flujo normal: ocupa el ancho y respeta la caja del contenedor. */
const flowStyle: React.CSSProperties = {
    width: '100%',
    height: '100%'
};

interface ImageProps {
    readonly imgUrl: string;
    /** Texto alternativo. Vacío = decorativa (la tarjeta ya lleva su título). */
    readonly alt?: string;
    readonly blurhash?: string;
    /** `object-fit: contain` en vez de `cover` (logos, canales de TV). */
    readonly containImage?: boolean;
    /**
     * `fill` (por defecto) se posiciona en absoluto sobre el contenedor;
     * `flow` la deja en el flujo normal, para marcos que ya fijan la caja.
     */
    readonly layout?: 'fill' | 'flow';
}

function Image({
    imgUrl,
    alt = '',
    blurhash,
    containImage = false,
    layout = 'fill'
}: ImageProps) {
    const [isLoaded, setIsLoaded] = useState(false);
    const [isLoadStarted, setIsLoadStarted] = useState(false);
    const handleLoad = useCallback(() => {
        setIsLoaded(true);
    }, []);

    const handleLoadStarted = useCallback(() => {
        setIsLoadStarted(true);
    }, []);

    const fadeinDuration = userSettings.enableFastFadein() ? '0.1s' : '0.5s';
    const transitionDuration = isLoaded ? fadeinDuration : 'none';
    const baseStyle = layout === 'fill' ? fillStyle : flowStyle;

    return (
        <div>
            {!isLoaded && isLoadStarted && blurhash && userSettings.enableBlurhash() && (
                <BlurhashCanvas
                    hash={blurhash}
                    width={20}
                    height={20}
                    punch={1}
                    style={{
                        ...baseStyle,
                        borderRadius: '0.2em',
                        pointerEvents: 'none'
                    }}
                />
            )}
            <LazyLoadImage
                key={imgUrl}
                src={imgUrl}
                alt={alt}
                style={{
                    ...baseStyle,
                    objectFit: containImage ? 'contain' : 'cover',
                    opacity: isLoaded ? 1 : 0,
                    transition: transitionDuration
                }}
                onLoad={handleLoad}
                beforeLoad={handleLoadStarted}
            />

        </div>
    );
}

export default Image;
