// Diálogo del selector de avatar: rejilla de personajes de tres fuentes (la
// biblioteca, AniList, TMDB) con búsqueda, y un pie donde se compone la
// elección —retrato + color de fondo— antes de subirla. El estado vive en
// AvatarPickerViewModel; aquí solo se pinta y se traducen los errores a toasts.

import globalize from 'lib/globalize';

import { useEffect } from 'react';
import { useVmSignals } from '../../../domain/bridge/useViewModel';
import {
    AVATAR_BACKGROUND, avatarPickerVM, type AvatarCandidate
} from '../../../domain/viewModels/AvatarPickerViewModel';
import {
    Dialog, DialogFooter, DialogHeader
} from '../../components/controls/Dialog';
import { Muted, PillButton, TextField } from '../../components/controls/fields';
import { useToast } from '../../components/toast/ToastProvider';
import { T } from '../../theme/tokens';

type Props = {
    onClose: () => void;
    /** La imagen ya subida: quien abrió refresca el avatar de la página. */
    onApplied: () => void;
};

export function AvatarPickerDialog({ onClose, onApplied }: Props) {
    const toast = useToast();
    useVmSignals(avatarPickerVM, (vm) => [
        vm.query, vm.candidates, vm.loading, vm.selected, vm.saving, vm.artById
    ]);

    useEffect(() => {
        avatarPickerVM.open();
        return () => avatarPickerVM.close();
    }, []);

    const doApply = async () => {
        try {
            await avatarPickerVM.apply();
            toast(globalize.translate('ImageSaved'), 'success');
            onApplied();
        } catch (e) {
            // El diálogo sigue abierto con la elección a mano para reintentar.
            toast((e as Error).message, 'warn');
        }
    };

    const candidates = avatarPickerVM.candidates.value;
    const selected = avatarPickerVM.selected.value;
    const saving = avatarPickerVM.saving.value;
    // El arte del personaje de AniList cuando ha llegado; la foto del
    // intérprete es el respaldo mientras tanto.
    const artById = avatarPickerVM.artById.value;
    const photoOf = (c: AvatarCandidate) => artById.get(c.id) ?? c.imageUrl;
    const selectedPhoto = selected ? photoOf(selected) : '';

    return (
        <Dialog
            label={globalize.translate('AvatarPickerTitle')}
            width={560}
            maxHeight='75vh'
            column
            dismissable={!saving}
            onClose={onClose}
        >
            <DialogHeader title={globalize.translate('AvatarPickerTitle')} onClose={onClose} />

            <TextField
                value={avatarPickerVM.query.value}
                onChange={avatarPickerVM.setQuery}
                placeholder={globalize.translate('AvatarPickerSearchPlaceholder')}
                autoFocus
            />

            {/* minHeight: 0 es la parte no obvia del flex: sin él la rejilla no
                puede encogerse y el overflow del diálogo no se desplaza aquí. */}
            <div style={{
                flex: 1, minHeight: 0, overflowY: 'auto', margin: '14px 0',
                display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))',
                gap: 10, alignContent: 'start'
            }}>
                {candidates.map((c) => (
                    <CandidateTile
                        key={c.id}
                        candidate={c}
                        photo={photoOf(c)}
                        selected={selected?.id === c.id}
                        onClick={() => avatarPickerVM.select(c)}
                    />
                ))}
                {candidates.length === 0 && (
                    <div style={{ gridColumn: '1 / -1' }}>
                        <Muted>
                            {globalize.translate(avatarPickerVM.loading.value ?
                                'Loading' : 'AvatarPickerEmpty')}
                        </Muted>
                    </div>
                )}
            </div>

            <DialogFooter>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    {/* Vista previa tal cual se compondrá: «cover» con sesgo
                        hacia arriba (ver buildAvatarFile), llenando el círculo
                        igual que lo enseña Ajustes. */}
                    {selected && (
                        <div
                            aria-hidden='true'
                            style={{
                                width: 72, height: 72, borderRadius: '50%', flexShrink: 0,
                                backgroundColor: AVATAR_BACKGROUND,
                                backgroundImage: `url(${selectedPhoto})`,
                                backgroundSize: 'cover',
                                backgroundPosition: 'center 25%'
                            }}
                        />
                    )}
                    <div style={{ flex: 1 }} />
                    <PillButton
                        onClick={() => { void doApply(); }}
                        busy={saving}
                        disabled={!selected}
                    >
                        {globalize.translate(saving ? 'Saving' : 'Save')}
                    </PillButton>
                </div>
            </DialogFooter>
        </Dialog>
    );
}

/** Una casilla de la rejilla: el retrato, su etiqueta y la marca de anime. */
function CandidateTile({
    candidate, photo, selected, onClick
}: {
    candidate: AvatarCandidate; photo: string; selected: boolean; onClick: () => void;
}) {
    return (
        <button
            onClick={onClick}
            aria-pressed={selected}
            title={`${candidate.name} — ${candidate.subtitle}`}
            style={{
                background: 'none', border: 'none', padding: 0,
                cursor: 'pointer', fontFamily: T.ui, color: '#fff',
                textAlign: 'left'
            }}
        >
            <div style={{
                position: 'relative', width: '100%', aspectRatio: '1 / 1',
                borderRadius: 10, overflow: 'hidden',
                backgroundImage: `url(${photo})`,
                backgroundSize: 'cover',
                // Encuadre con el mismo sesgo hacia arriba del canvas final:
                // centrar del todo corta la frente de casi cualquier retrato.
                backgroundPosition: 'center 20%',
                outline: selected ? '2px solid #fff' : '1px solid rgba(255,255,255,0.12)',
                outlineOffset: selected ? -2 : 0
            }}>
                {candidate.source === 'anilist' && (
                    <span style={{
                        position: 'absolute', top: 6, left: 6,
                        background: 'rgba(0,0,0,0.6)', borderRadius: 999,
                        padding: '2px 7px', fontSize: 10, letterSpacing: 0.5
                    }}>
                        {globalize.translate('AvatarPickerBadgeAnime')}
                    </span>
                )}
            </div>
            <div style={{
                fontSize: 12, marginTop: 6,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
            }}>
                {candidate.name}
            </div>
            <div style={{
                fontSize: 11, color: T.dim,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
            }}>
                {candidate.subtitle}
            </div>
        </button>
    );
}
