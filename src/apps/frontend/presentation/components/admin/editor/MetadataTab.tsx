import globalize from 'lib/globalize';

import { useEffect, useState } from 'react';
import { getItemRaw, updateItemMetadata } from '../../../../domain/api';
import { useToast } from '../../toast/ToastProvider';
import {
    ErrText,
    Field,
    FooterRow,
    Muted,
    PrimaryBtn,
    SecondaryBtn,
    TextArea,
    TextInput
} from './primitives';

export function MetadataTab({ itemId, onClose }: { itemId: string; onClose: () => void }) {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [name, setName] = useState('');
    const [originalTitle, setOriginalTitle] = useState('');
    const [year, setYear] = useState<string>('');
    const [overview, setOverview] = useState('');
    const [taglines, setTaglines] = useState<string>('');
    const [genres, setGenres] = useState<string>('');
    const [officialRating, setOfficialRating] = useState('');
    const toast = useToast();

    useEffect(() => {
        let cancelled = false;
        getItemRaw(itemId).then((it) => {
            if (cancelled) return;
            setName(it.Name ?? '');
            setOriginalTitle(it.OriginalTitle ?? '');
            setYear(it.ProductionYear ? String(it.ProductionYear) : '');
            setOverview(it.Overview ?? '');
            setTaglines((it.Taglines ?? []).join('\n'));
            setGenres((it.Genres ?? []).join(', '));
            setOfficialRating(it.OfficialRating ?? '');
            setLoading(false);
        }).catch((e: Error) => {
            if (!cancelled) {
                setError(e.message);
                setLoading(false);
            }
        });
        return () => { cancelled = true; };
    }, [itemId]);

    const save = async () => {
        setSaving(true);
        try {
            await updateItemMetadata(itemId, {
                Name: name || undefined,
                OriginalTitle: originalTitle || undefined,
                ProductionYear: year ? Number(year) : null,
                Overview: overview || undefined,
                Taglines: taglines.split('\n').map((s) => s.trim()).filter(Boolean),
                Genres: genres.split(',').map((s) => s.trim()).filter(Boolean),
                OfficialRating: officialRating || undefined
            });
            toast(globalize.translate('SettingsSaved'), 'success');
            onClose();
        } catch (e) {
            toast((e as Error).message, 'warn');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <Muted>{globalize.translate('Loading')}</Muted>;
    if (error) return <ErrText>{error}</ErrText>;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Field label={globalize.translate('LabelTitle')}>
                <TextInput value={name} onChange={setName} autoFocus />
            </Field>
            <Field label={globalize.translate('LabelOriginalTitle')}>
                <TextInput value={originalTitle} onChange={setOriginalTitle} />
            </Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <Field label={globalize.translate('LabelYear')}>
                    <TextInput value={year} onChange={setYear} placeholder='2015' />
                </Field>
                <Field label={globalize.translate('LabelParentalRating')}>
                    <TextInput value={officialRating} onChange={setOfficialRating} placeholder='TV-14' />
                </Field>
            </div>
            <Field label={globalize.translate('LabelGenresCommaSeparated')}>
                <TextInput value={genres} onChange={setGenres} />
            </Field>
            <Field label={globalize.translate('Overview')}>
                <TextArea value={overview} onChange={setOverview} rows={5} />
            </Field>
            <Field label={globalize.translate('LabelTaglinesOnePerLine')}>
                <TextArea value={taglines} onChange={setTaglines} rows={2} />
            </Field>
            <FooterRow>
                <PrimaryBtn onClick={save} disabled={saving}>
                    {globalize.translate(saving ? 'Saving' : 'Save')}
                </PrimaryBtn>
                <SecondaryBtn onClick={onClose}>{globalize.translate('ButtonCancel')}</SecondaryBtn>
            </FooterRow>
        </div>
    );
}
