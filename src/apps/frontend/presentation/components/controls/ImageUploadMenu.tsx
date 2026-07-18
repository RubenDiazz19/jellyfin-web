import { T } from '../../theme/tokens';

type Props = {
    id: string;
    type: 'backdrop' | 'poster';
    onUpload: (id: string, type: 'backdrop' | 'poster', dataUrl: string) => void;
};

// Entrada de menú que abre el selector de archivos y persiste la imagen
// elegida en localStorage a través del callback onUpload.
export function ImageUploadMenu({ id, type, onUpload }: Props) {
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
        <label
            style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                background: 'none',
                border: 'none',
                color: '#fff',
                cursor: 'pointer',
                padding: '11px 12px',
                fontSize: 14,
                borderRadius: 8,
                fontFamily: T.ui,
                letterSpacing: 0.1,
                transition: 'background .15s',
                margin: 0
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
            <input type='file' accept='image/*' onChange={handleFileChange} style={{ display: 'none' }} />
            Cambiar {type === 'backdrop' ? 'fondo' : 'póster'}
        </label>
    );
}
