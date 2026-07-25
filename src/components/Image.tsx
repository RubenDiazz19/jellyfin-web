// Marco de imagen del dashboard: superficie MUI con aspect-ratio, skeleton
// mientras carga el dato y un icono cuando no hay imagen.
//
// El <img> NO se implementa aquí: se delega en `components/common/Image`, el
// componente canónico (lazy loading + blurhash + fade-in). Este fichero es
// solo la presentación alrededor.

import type { SvgIconComponent } from '@mui/icons-material';
import ImageNotSupported from '@mui/icons-material/ImageNotSupported';
import Box from '@mui/material/Box/Box';
import Paper from '@mui/material/Paper/Paper';

import CommonImage from './common/Image';
import { LoadingSkeleton } from './LoadingSkeleton';

interface ImageProps {
    readonly isLoading: boolean;
    readonly alt?: string;
    readonly url?: string;
    readonly aspectRatio?: number;
    readonly FallbackIcon?: SvgIconComponent;
}

function Image({
    isLoading,
    alt,
    url,
    aspectRatio = 16 / 9,
    FallbackIcon = ImageNotSupported
}: ImageProps) {
    return (
        <Paper
            sx={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                width: '100%',
                aspectRatio,
                overflow: 'hidden'
            }}
        >
            <LoadingSkeleton
                isLoading={isLoading}
                variant='rectangular'
                width='100%'
                height='100%'
            >
                {url ? (
                    // `flow`: el marco ya fija la caja, así que la imagen no
                    // debe posicionarse en absoluto. `containImage` para no
                    // recortar logos ni capturas dentro del aspect-ratio.
                    <CommonImage
                        imgUrl={url}
                        alt={alt}
                        layout='flow'
                        containImage
                    />
                ) : (
                    <Box
                        sx={{
                            height: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}
                    >
                        <FallbackIcon
                            sx={{
                                height: '25%',
                                width: 'auto'
                            }}
                        />
                    </Box>
                )}
            </LoadingSkeleton>
        </Paper>
    );
}

export default Image;
