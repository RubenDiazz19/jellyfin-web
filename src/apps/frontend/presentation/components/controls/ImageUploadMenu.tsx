import globalize from 'lib/globalize';
import { useRef } from 'react';
import { MenuEntry } from './MenuEntry';

type Props = {
    id: string;
    type: 'backdrop' | 'poster';
    onUpload: (id: string, type: 'backdrop' | 'poster', dataUrl: string) => void;
};

// Entrada de menú que abre el selector de archivos y persiste la imagen
// elegida en localStorage a través del callback onUpload.
export function ImageUploadMenu({ id, type, onUpload }: Props) {
    const fileRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            const dataUrl = ev.target?.result;
            if (typeof dataUrl === 'string') onUpload(id, type, dataUrl);
        };
        reader.readAsDataURL(file);
    };

    return (
        <>
            <input
                ref={fileRef}
                type='file'
                accept='image/*'
                onChange={handleFileChange}
                style={{ display: 'none' }}
            />
            <MenuEntry onClick={() => fileRef.current?.click()}>
                {globalize.translate(type === 'backdrop' ? 'ChangeBackdrop' : 'ChangePoster')}
            </MenuEntry>
        </>
    );
}

