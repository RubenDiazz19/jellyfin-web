// Soltar imágenes sobre una caja, o pulsarla para elegirlas del disco.
//
// Las dos cajas que lo hacen —la carátula de un título y la de añadir un
// fondo— no se parecen en nada (una enseña la imagen actual, la otra es un
// hueco con un «+»), pero la mecánica es idéntica hasta el detalle de que sin
// `preventDefault` en el `dragover` el navegador nunca entrega el `drop`. Eso
// es lo que está aquí; el aspecto se queda en cada sitio.

import { useRef, useState } from 'react';

type Options = {
    /** Ya filtradas: solo llegan las que son imágenes. */
    onFiles: (files: File[]) => void;
    /** Los fondos admiten varios de una vez; una carátula es una sola. */
    multiple?: boolean;
};

export function useImageDrop({ onFiles, multiple }: Options) {
    const [over, setOver] = useState(false);
    const ref = useRef<HTMLInputElement>(null);

    const take = (list: FileList | null) => {
        const files = Array.from(list ?? []).filter((f) => f.type.startsWith('image/'));
        if (files.length > 0) onFiles(multiple ? files : files.slice(0, 1));
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
        /** El `<input type="file">` escondido; hay que pintarlo en algún sitio. */
        input: (
            <input
                ref={ref} type='file' accept='image/*' multiple={multiple} hidden
                // Se limpia el valor para que elegir DOS VECES el mismo fichero
                // vuelva a disparar el change.
                onChange={(e) => { take(e.target.files); e.target.value = ''; }}
            />
        )
    };
}
