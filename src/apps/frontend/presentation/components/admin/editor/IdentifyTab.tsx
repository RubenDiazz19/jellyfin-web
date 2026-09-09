import globalize from 'lib/globalize';

import { useEffect, useState } from 'react';
import {
    applyRemoteSearchResult,
    getItemRaw,
    remoteSearch,
    type RemoteSearchItemType,
    type RemoteSearchResult
} from '../../../../domain/api';
import { T } from '../../../theme/tokens';
import { useToast } from '../../toast/ToastProvider';
import type { IdentifiableKind } from './MetadataEditor';
import { Muted, PillButton, TextField } from '../../controls/fields';
import { Field } from './primitives';

type Props = {
    itemId: string;
    kind: IdentifiableKind;
    onClose: () => void;
};

export function IdentifyTab({ itemId, kind, onClose }: Props) {
    const [name, setName] = useState('');
    const [year, setYear] = useState('');
    const [tmdbId, setTmdbId] = useState('');
    const [imdbId, setImdbId] = useState('');
    const [tvdbId, setTvdbId] = useState('');
    const [showExternalIds, setShowExternalIds] = useState(false);
    const [resolvedType, setResolvedType] = useState<RemoteSearchItemType | null>(null);
    const [results, setResults] = useState<RemoteSearchResult[] | null>(null);
    const [searching, setSearching] = useState(false);
    const [applying, setApplying] = useState<number | null>(null);
    const toast = useToast();

    const kindApi: RemoteSearchItemType =
        kind === 'show' ? 'Series' : kind === 'movie' ? 'Movie' : kind === 'collection' ? 'BoxSet' : 'Episode';
    const effectiveKind = resolvedType ?? kindApi;

    const executeSearch = async (
        searchName: string,
        searchYear?: number,
        customProviderIds?: Record<string, string>,
        searchKind?: RemoteSearchItemType
    ) => {
        setSearching(true);
        try {
            const rs = await remoteSearch(itemId, searchKind ?? resolvedType ?? kindApi, {
                name: searchName || undefined,
                year: searchYear,
                providerIds: customProviderIds
            });
            setResults(rs);
            if (rs.length === 0) toast(globalize.translate('MessageNoResults'), 'info');
        } catch (e) {
            toast((e as Error).message, 'warn');
        } finally {
            setSearching(false);
        }
    };

    const buildProviderIds = (): Record<string, string> => {
        const pIds: Record<string, string> = {};
        if (tmdbId.trim()) pIds.TheMovieDb = tmdbId.trim();
        if (imdbId.trim()) pIds.Imdb = imdbId.trim();
        if (tvdbId.trim()) pIds.TheTVDb = tvdbId.trim();

        // Si el usuario introdujo un IMDb ID (tt...) directamente en el campo Name
        const trimmedName = name.trim();
        if (/^tt\d+$/i.test(trimmedName) && !pIds.Imdb) {
            pIds.Imdb = trimmedName;
        }
        return pIds;
    };

    const doSearch = () => {
        const cleanYear = year.trim() ? Number(year.trim()) : undefined;
        const validYear = cleanYear && !isNaN(cleanYear) && cleanYear > 0 ? cleanYear : undefined;
        const pIds = buildProviderIds();
        void executeSearch(name.trim(), validYear, Object.keys(pIds).length > 0 ? pIds : undefined);
    };

    useEffect(() => {
        getItemRaw(itemId).then((it) => {
            const rawType = (it.Type === 'Movie' || it.Type === 'Series' || it.Type === 'Episode' || it.Type === 'BoxSet') ?
                it.Type :
                undefined;
            if (rawType) {
                setResolvedType(rawType);
            }
            const initialName = it.Name ?? '';
            setName(initialName);
            const initialYear = it.ProductionYear ? String(it.ProductionYear) : '';
            setYear(initialYear);
            if (initialName) {
                const initYearNum = initialYear ? Number(initialYear) : undefined;
                void executeSearch(
                    initialName,
                    initYearNum && !isNaN(initYearNum) ? initYearNum : undefined,
                    undefined,
                    rawType ?? kindApi
                );
            }
        }).catch(() => {});
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [itemId]);

    const apply = async (i: number) => {
        if (!results) return;
        setApplying(i);
        try {
            await applyRemoteSearchResult(itemId, results[i]);
            toast(globalize.translate('MessageIdentifiedRefreshing'), 'success');
            onClose();
        } catch (e) {
            toast((e as Error).message, 'warn');
        } finally {
            setApplying(null);
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Muted>
                Busca en los proveedores externos (TMDB/TVDB) para reemplazar la metadata
                actual por otra distinta.
            </Muted>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: 12 }}>
                <Field label={globalize.translate('LabelName')}>
                    <TextField size='md' value={name} onChange={setName} onEnter={doSearch} />
                </Field>
                <Field label={globalize.translate('LabelYear')}>
                    <TextField size='md' value={year} onChange={setYear} placeholder={globalize.translate('Optional')} onEnter={doSearch} />
                </Field>
                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                    <PillButton onClick={doSearch} busy={searching}>
                        {globalize.translate(searching ? 'Searching' : 'Search')}
                    </PillButton>
                </div>
            </div>

            <div>
                <button
                    type='button'
                    onClick={() => setShowExternalIds(!showExternalIds)}
                    style={{
                        background: 'none', border: 'none', padding: 0,
                        color: T.dim, fontSize: 12, cursor: 'pointer',
                        display: 'inline-flex', alignItems: 'center', gap: 4
                    }}
                >
                    <span>{showExternalIds ? '▾' : '▸'}</span>
                    <span>{globalize.translate('HeaderExternalIds')} ({globalize.translate('Optional')})</span>
                </button>

                {showExternalIds && (
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: effectiveKind === 'Series' || effectiveKind === 'Episode' ? '1fr 1fr 1fr' : '1fr 1fr',
                        gap: 12, marginTop: 10, padding: 12,
                        background: 'rgba(255,255,255,0.02)', borderRadius: 8,
                        border: '1px solid rgba(255,255,255,0.05)'
                    }}>
                        <Field label='TheMovieDb ID'>
                            <TextField size='md' value={tmdbId} onChange={setTmdbId} placeholder='ej. 11' onEnter={doSearch} />
                        </Field>
                        <Field label='IMDb ID'>
                            <TextField size='md' value={imdbId} onChange={setImdbId} placeholder='ej. tt0076759' onEnter={doSearch} />
                        </Field>
                        {(effectiveKind === 'Series' || effectiveKind === 'Episode') && (
                            <Field label='TheTVDB ID'>
                                <TextField size='md' value={tvdbId} onChange={setTvdbId} placeholder='ej. 261753' onEnter={doSearch} />
                            </Field>
                        )}
                    </div>
                )}
            </div>

            {results && results.length === 0 && !searching && (
                <div style={{
                    padding: '24px 16px', textAlign: 'center', color: T.dim,
                    background: 'rgba(255,255,255,0.02)', borderRadius: 8,
                    border: '1px dashed rgba(255,255,255,0.08)', fontSize: 13
                }}>
                    {globalize.translate('MessageNoResults')}
                </div>
            )}

            {results && results.length > 0 && (
                <div style={{
                    display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4,
                    maxHeight: 420, overflowY: 'auto', paddingRight: 4
                }}>
                    {results.map((r, i) => (
                        <div key={i} style={{
                            display: 'flex', gap: 12, padding: 10,
                            background: 'rgba(255,255,255,0.04)', borderRadius: 8,
                            border: '1px solid rgba(255,255,255,0.06)'
                        }}>
                            {r.ImageUrl && (
                                <img
                                    src={r.ImageUrl} alt=''
                                    style={{ width: 60, height: 90, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }}
                                />
                            )}
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 14, fontWeight: 500 }}>
                                    {r.Name} {r.ProductionYear && <span style={{ color: T.dim }}>({r.ProductionYear})</span>}
                                </div>
                                {r.SearchProviderName && (
                                    <div style={{ fontSize: 11, color: T.dim, marginTop: 2 }}>{r.SearchProviderName}</div>
                                )}
                                {r.Overview && (
                                    <div style={{
                                        fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 6,
                                        display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical',
                                        overflow: 'hidden'
                                    }}>
                                        {r.Overview}
                                    </div>
                                )}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                <PillButton
                                    onClick={() => apply(i)}
                                    variant='ghost'
                                    busy={applying === i}
                                >
                                    {globalize.translate(applying === i ? 'Applying' : 'Apply')}
                                </PillButton>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
