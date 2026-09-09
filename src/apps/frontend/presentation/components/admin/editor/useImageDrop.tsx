// Soltar imágenes sobre una caja, o pulsarla para elegirlas del disco.
//
// Las dos cajas que lo hacen —la carátula de un título y la de añadir un
// fondo— no se parecen en nada (una enseña la imagen actual, la otra es un
// hueco con un «+»), pero la mecánica es idéntica hasta el detalle de que sin
// `preventDefault` en el `dragover` el navegador nunca entrega el `drop`. Eso
// es lo que está aquí; el aspecto se queda en cada sitio.

import globalize from 'lib/globalize';

import { useRef, useState } from 'react';
import { useToast } from '../../toast/ToastProvider';

type Options = {
    /** Ya filtradas: solo llegan las que son imágenes. */
    onFiles: (files: File[]) => void;
    /** Los fondos admiten varios de una vez; una carátula es una sola. */
    multiple?: boolean;
};

function isImageFile(f: File): boolean {
    if (f.type && f.type.startsWith('image/')) return true;
    return /\.(jpe?g|png|webp|gif|svg|avif|bmp|ico|tbn)$/i.test(f.name);
}

export function useImageDrop({ onFiles, multiple }: Options) {
    const [over, setOver] = useState(false);
    const ref = useRef<HTMLInputElement>(null);
    const toast = useToast();

    const take = (list: FileList | null) => {
        const rawFiles = Array.from(list ?? []);
        if (rawFiles.length === 0) return;
        const files = rawFiles.filter(isImageFile);
        if (files.length > 0) {
            onFiles(multiple ? files : files.slice(0, 1));
        } else {
            toast(globalize.translate('MessageImageFileTypeAllowed'), 'warn');
        }
    };

    return {
        /** Si hay algo arrastrado encima: para realzar el borde de la caja. */
        over,
        /** Abre el selector del sistema — desde la caja o desde un botón aparte. */
        open: () => ref.current?.click(),
        /** Se cuelgan del elemento que hace de zona. */
        props: {
            onClick: () => ref.current?.click(),
            // Sin este preventDefault el navegador no considera el elemento un
            // destino válido y nunca llega el drop.
            onDragOver: (e: React.DragEvent) => { e.preventDefault(); setOver(true); },
            onDragLeave: () => setOver(false),
            onDrop: (e: React.DragEvent) => {
                e.preventDefault();
                setOver(false);
                take(e.dataTransfer.files);
            }
        },
        /** El `<input type="file">` escondido; fuera de pantalla para que click() funcione siempre. */
        input: (
            <input
                ref={ref}
                type='file'
                accept='image/*,.jpg,.jpeg,.png,.webp,.gif,.svg,.avif,.bmp,.tbn'
                multiple={multiple}
                style={{
                    position: 'fixed',
                    top: -10000,
                    left: -10000,
                    width: 1,
                    height: 1,
                    opacity: 0,
                    pointerEvents: 'none'
                }}
                tabIndex={-1}
                aria-hidden='true'
                // Se limpia el valor para que elegir DOS VECES el mismo fichero
                // vuelva a disparar el change.
                onChange={(e) => { take(e.target.files); e.target.value = ''; }}
            />
        )
    };
}
