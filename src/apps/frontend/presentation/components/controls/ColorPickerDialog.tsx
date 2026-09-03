import globalize from 'lib/globalize';

import { useRef, useState } from 'react';
import { T } from '../../theme/tokens';
import { Dialog } from './Dialog';
import { PillButton } from './fields';

type Props = {
    title: string;
    logo?: string | null;
    initialColor?: string;
    onSave: (color: string | undefined) => void;
    onClose: () => void;
};

const PRESETS = [
    { label: 'Marvel Red', hex: '#E23636' },
    { label: 'Star Wars Blue', hex: '#0B3056' },
    { label: 'Disney Blue', hex: '#113CCF' },
    { label: 'Netflix Red', hex: '#E50914' },
    { label: 'DC Dark', hex: '#1E1E24' },
    { label: 'Gold', hex: '#D4AF37' },
    { label: 'Regal Purple', hex: '#581845' },
    { label: 'Forest Green', hex: '#1E5631' },
    { label: 'OLED Black', hex: '#000000' }
];

function normalizeHex(input: string): string {
    const trimmed = input.trim();
    if (!trimmed) return '';
    return trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
}

function isValidHex(hex: string): boolean {
    return /^#([0-9A-F]{3}|[0-9A-F]{6})$/i.test(hex);
}

export function ColorPickerDialog({ title, logo, initialColor, onSave, onClose }: Props) {
    const [color, setColor] = useState(initialColor ?? '#E23636');
    const [hasColor, setHasColor] = useState(Boolean(initialColor));
    const [hexInput, setHexInput] = useState(initialColor ?? '#E23636');
    const colorInputRef = useRef<HTMLInputElement>(null);

    const handleHexChange = (val: string) => {
        setHexInput(val);
        const norm = normalizeHex(val);
        if (isValidHex(norm)) {
            setColor(norm);
            setHasColor(true);
        }
    };

    const handleNativeColor = (val: string) => {
        setColor(val);
        setHexInput(val);
        setHasColor(true);
    };

    const selectPreset = (hex: string) => {
        setColor(hex);
        setHexInput(hex);
        setHasColor(true);
    };

    const removeColor = () => {
        setHasColor(false);
    };

    const handleSave = () => {
        const finalColor = hasColor && isValidHex(normalizeHex(hexInput)) ?
            normalizeHex(hexInput) :
            (hasColor ? color : undefined);
        onSave(finalColor);
        onClose();
    };

    return (
        <Dialog
            label={globalize.translate('LabelBackgroundColor')}
            padding={22}
            width={440}
            onClose={onClose}
        >
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>
                {globalize.translate('LabelBackgroundColor')} · {title}
            </div>

            {/* Vista previa en vivo de la tarjeta con la proporción 16:9 */}
            <div style={{
                position: 'relative',
                width: '100%',
                aspectRatio: '16/9',
                borderRadius: 10,
                overflow: 'hidden',
                backgroundColor: hasColor ? color : 'rgba(255, 255, 255, 0.08)',
                backgroundImage: hasColor ? undefined : 'linear-gradient(135deg, rgba(255,255,255,0.12), rgba(255,255,255,0.03))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 20,
                boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                border: '1px solid rgba(255,255,255,0.1)'
            }}>
                {logo ? (
                    <img
                        src={logo}
                        alt={title}
                        style={{
                            maxWidth: '75%',
                            maxHeight: '60%',
                            objectFit: 'contain',
                            filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.5))'
                        }}
                    />
                ) : (
                    <span style={{
                        color: '#fff',
                        fontSize: 20,
                        fontWeight: 700,
                        textAlign: 'center',
                        padding: '0 16px',
                        textTransform: 'uppercase',
                        letterSpacing: 1,
                        textShadow: '0 2px 8px rgba(0,0,0,0.8)'
                    }}>
                        {title}
                    </span>
                )}
            </div>

            {/* Control Hexadecimal + Selector Nativo */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
                <div style={{ fontSize: 13, color: T.dim }}>
                    {globalize.translate('LabelHexColor')}
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <button
                        type='button'
                        onClick={() => colorInputRef.current?.click()}
                        title={globalize.translate('LabelChooseColor')}
                        style={{
                            width: 38,
                            height: 38,
                            borderRadius: 8,
                            border: '2px solid rgba(255,255,255,0.2)',
                            backgroundColor: hasColor ? color : '#333',
                            cursor: 'pointer',
                            flexShrink: 0,
                            padding: 0
                        }}
                    />
                    <input
                        ref={colorInputRef}
                        type='color'
                        value={isValidHex(color) ? color : '#E23636'}
                        onChange={(e) => handleNativeColor(e.target.value)}
                        style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 0, height: 0 }}
                    />
                    <input
                        value={hexInput}
                        onChange={(e) => handleHexChange(e.target.value)}
                        placeholder='#E23636'
                        style={{
                            flex: 1,
                            background: 'rgba(255,255,255,0.06)',
                            color: '#fff',
                            border: '1px solid rgba(255,255,255,0.15)',
                            borderRadius: 8,
                            padding: '9px 12px',
                            fontFamily: 'monospace',
                            fontSize: 14,
                            outline: 'none'
                        }}
                    />
                    <PillButton
                        size='sm'
                        variant='ghost'
                        onClick={() => colorInputRef.current?.click()}
                    >
                        {globalize.translate('LabelChooseColor')}
                    </PillButton>
                </div>
            </div>

            {/* Paleta rápida de colores preestablecidos */}
            <div style={{ marginBottom: 22 }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {PRESETS.map((p) => (
                        <button
                            key={p.hex}
                            type='button'
                            onClick={() => selectPreset(p.hex)}
                            title={p.label}
                            style={{
                                width: 28,
                                height: 28,
                                borderRadius: '50%',
                                backgroundColor: p.hex,
                                border: hasColor && color.toLowerCase() === p.hex.toLowerCase() ?
                                    '2px solid #fff' :
                                    '1px solid rgba(255,255,255,0.2)',
                                cursor: 'pointer',
                                padding: 0,
                                transform: hasColor && color.toLowerCase() === p.hex.toLowerCase() ? 'scale(1.15)' : 'scale(1)',
                                transition: 'transform 0.15s'
                            }}
                        />
                    ))}
                    {hasColor && (
                        <PillButton
                            size='sm'
                            variant='ghost'
                            onClick={removeColor}
                            style={{ marginLeft: 8 }}
                        >
                            {globalize.translate('LabelRemoveColor')}
                        </PillButton>
                    )}
                </div>
            </div>

            {/* Acciones */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <PillButton variant='ghost' onClick={onClose}>
                    {globalize.translate('ButtonCancel')}
                </PillButton>
                <PillButton variant='primary' onClick={handleSave}>
                    {globalize.translate('Save')}
                </PillButton>
            </div>
        </Dialog>
    );
}
