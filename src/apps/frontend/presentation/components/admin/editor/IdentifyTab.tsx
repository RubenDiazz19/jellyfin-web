import { useEffect, useState } from 'react';
import {
    applyRemoteSearchResult,
    getItemRaw,
    remoteSearch,
    type RemoteSearchResult
} from '../../../../domain/api';
import { T } from '../../../theme/tokens';
import { useToast } from '../../toast/ToastProvider';
import type { IdentifiableKind } from './MetadataEditor';
import { Field, Muted, PrimaryBtn, SecondaryBtn, TextInput } from './primitives';

type Props = {
    itemId: string;
    kind: IdentifiableKind;
    onClose: () => void;
};

export function IdentifyTab({ itemId, kind, onClose }: Props) {
    const [name, setName] = useState('');
    const [year, setYear] = useState('');
    const [results, setResults] = useState<RemoteSearchResult[] | null>(null);
    const [searching, setSearching] = useState(false);
    const [applying, setApplying] = useState<number | null>(null);
    const toast = useToast();

    useEffect(() => {
        getItemRaw(itemId).then((it) => {
            setName(it.Name ?? '');
            setYear(it.ProductionYear ? String(it.ProductionYear) : '');
        }).catch(() => {});
    }, [itemId]);

    const kindApi: 'Movie' | 'Series' | 'Episode' =
        kind === 'show' ? 'Series' : kind === 'movie' ? 'Movie' : 'Episode';

    const doSearch = async () => {
        setSearching(true);
        try {
            const rs = await remoteSearch(itemId, kindApi, {
                name: name || undefined,
                year: year ? Number(year) : undefined
            });
            setResults(rs);
            if (rs.length === 0) toast('Sin resultados', 'info');
        } catch (e) {
            toast((e as Error).message, 'warn');
        } finally {
            setSearching(false);
        }
    };

    const apply = async (i: number) => {
        if (!results) return;
        setApplying(i);
        try {
            await applyRemoteSearchResult(itemId, results[i]);
            toast('Identificado — se está refrescando la metadata', 'success');
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
                <Field label='Nombre'>
                    <TextInput value={name} onChange={setName} />
                </Field>
                <Field label='Año'>
                    <TextInput value={year} onChange={setYear} placeholder='opcional' />
                </Field>
                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                    <PrimaryBtn onClick={doSearch} disabled={searching}>
                        {searching ? 'Buscando…' : 'Buscar'}
                    </PrimaryBtn>
                </div>
            </div>

            {results && results.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                    {results.map((r, i) => (
                        <div key={i} style={{
                            display: 'flex', gap: 12, padding: 10,
                            background: 'rgba(255,255,255,0.04)', borderRadius: 8,
                            border: '1px solid rgba(255,255,255,0.06)'
                        }}>
                            {r.ImageUrl && (
                                <img
                                    src={r.ImageUrl} alt=''
                                    style={{ width: 60, height: 90, objectFit: 'cover', borderRadius: 4 }}
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
                                <SecondaryBtn onClick={() => apply(i)} disabled={applying === i}>
                                    {applying === i ? 'Aplicando…' : 'Aplicar'}
                                </SecondaryBtn>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
