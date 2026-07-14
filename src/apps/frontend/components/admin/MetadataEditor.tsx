import { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { T } from '../../theme/tokens';
import {
  getItemRaw, updateItemMetadata, remoteSearch, applyRemoteSearchResult,
  setImageByUrl, uploadImageFile, deleteImage, imageUrl,
  getRemoteImages, searchSubtitles, downloadSubtitle,
  type RemoteSearchResult, type RemoteSubtitle, type JFRemoteImage,
} from '../../api/jellyfin';
import { useToast } from '../toast/ToastProvider';

export type EditorKind = 'movie' | 'show' | 'episode';
type Tab = 'metadata' | 'identify' | 'images' | 'subtitles';

type Props = {
  itemId: string;
  kind: EditorKind;
  initialTab?: Tab;
  onClose: () => void;
};

// Modal genérico con 4 pestañas para editar un item. Cada pestaña es su
// propio subcomponente para mantener el estado aislado.
export function MetadataEditor({ itemId, kind, initialTab = 'metadata', onClose }: Props) {
  const [tab, setTab] = useState<Tab>(initialTab);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const canSubs = kind === 'episode' || kind === 'movie';

  return ReactDOM.createPortal(
    <div
      onMouseDown={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
      }}
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 720, maxHeight: '90vh',
          background: 'rgba(18,18,20,0.99)',
          border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14,
          fontFamily: T.ui, color: '#fff', display: 'flex', flexDirection: 'column',
          boxShadow: '0 30px 80px rgba(0,0,0,0.7)', overflow: 'hidden',
        }}
      >
        <div style={{
          display: 'flex', alignItems: 'center', padding: '16px 22px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
        }}>
          <div style={{ fontSize: 15, fontWeight: 500 }}>Editor de item</div>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            style={{
              marginLeft: 'auto', background: 'none', border: 'none',
              color: T.dim, fontSize: 22, cursor: 'pointer', lineHeight: 1,
            }}
          >×</button>
        </div>

        <div style={{
          display: 'flex', gap: 4, padding: '6px 14px',
          borderBottom: '1px solid rgba(255,255,255,0.06)', fontSize: 13,
        }}>
          <TabButton label="Metadatos" active={tab === 'metadata'} onClick={() => setTab('metadata')} />
          <TabButton label="Identificar" active={tab === 'identify'} onClick={() => setTab('identify')} />
          <TabButton label="Imágenes" active={tab === 'images'} onClick={() => setTab('images')} />
          {canSubs && (
            <TabButton label="Subtítulos" active={tab === 'subtitles'} onClick={() => setTab('subtitles')} />
          )}
        </div>

        <div style={{ overflowY: 'auto', padding: 22, flex: 1 }}>
          {tab === 'metadata'  && <MetadataTab itemId={itemId} onClose={onClose} />}
          {tab === 'identify'  && <IdentifyTab itemId={itemId} kind={kind} onClose={onClose} />}
          {tab === 'images'    && <ImagesTab itemId={itemId} />}
          {tab === 'subtitles' && canSubs && <SubtitlesTab itemId={itemId} />}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function TabButton({ label, active, onClick }: {
  label: string; active: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '10px 14px', background: 'none', border: 'none',
        color: active ? '#fff' : T.dim, cursor: 'pointer',
        fontFamily: T.ui, fontSize: 13, fontWeight: active ? 500 : 400,
        position: 'relative',
      }}
    >
      {label}
      {active && <div style={{
        position: 'absolute', bottom: 0, left: 10, right: 10, height: 2,
        background: '#fff', borderRadius: 1,
      }} />}
    </button>
  );
}

// -------- Metadata --------
function MetadataTab({ itemId, onClose }: { itemId: string; onClose: () => void }) {
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
    }).catch((e: Error) => { if (!cancelled) { setError(e.message); setLoading(false); } });
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
        OfficialRating: officialRating || undefined,
      });
      toast('Metadatos guardados', 'success');
      onClose();
    } catch (e) {
      toast((e as Error).message, 'warn');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Muted>Cargando…</Muted>;
  if (error)   return <ErrText>{error}</ErrText>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Field label="Título">
        <TextInput value={name} onChange={setName} autoFocus />
      </Field>
      <Field label="Título original">
        <TextInput value={originalTitle} onChange={setOriginalTitle} />
      </Field>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <Field label="Año">
          <TextInput value={year} onChange={setYear} placeholder="2015" />
        </Field>
        <Field label="Calificación">
          <TextInput value={officialRating} onChange={setOfficialRating} placeholder="TV-14" />
        </Field>
      </div>
      <Field label="Géneros (separados por comas)">
        <TextInput value={genres} onChange={setGenres} />
      </Field>
      <Field label="Sinopsis">
        <TextArea value={overview} onChange={setOverview} rows={5} />
      </Field>
      <Field label="Taglines (una por línea)">
        <TextArea value={taglines} onChange={setTaglines} rows={2} />
      </Field>
      <FooterRow>
        <PrimaryBtn onClick={save} disabled={saving}>
          {saving ? 'Guardando…' : 'Guardar cambios'}
        </PrimaryBtn>
        <SecondaryBtn onClick={onClose}>Cancelar</SecondaryBtn>
      </FooterRow>
    </div>
  );
}

// -------- Identificar --------
function IdentifyTab({
  itemId, kind, onClose,
}: {
  itemId: string; kind: EditorKind; onClose: () => void;
}) {
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

  const kindApi = (kind === 'show' ? 'Series' : kind === 'movie' ? 'Movie' : 'Episode') as
    'Movie' | 'Series' | 'Episode';

  const doSearch = async () => {
    setSearching(true);
    try {
      const rs = await remoteSearch(itemId, kindApi, {
        name: name || undefined,
        year: year ? Number(year) : undefined,
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
        <Field label="Nombre">
          <TextInput value={name} onChange={setName} />
        </Field>
        <Field label="Año">
          <TextInput value={year} onChange={setYear} placeholder="opcional" />
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
              border: '1px solid rgba(255,255,255,0.06)',
            }}>
              {r.ImageUrl && (
                <img
                  src={r.ImageUrl} alt=""
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
                    overflow: 'hidden',
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

// -------- Imágenes --------
type ImgType = 'Primary' | 'Backdrop' | 'Logo';

function ImagesTab({ itemId }: { itemId: string }) {
  const [refreshTick, setRefreshTick] = useState(0);
  const [backdropTags, setBackdropTags] = useState<string[]>([]);
  const [primaryTag, setPrimaryTag] = useState<string | undefined>();
  const [logoTag, setLogoTag] = useState<string | undefined>();
  const toast = useToast();

  // Traemos el item para saber cuántos backdrops hay y los tags actuales.
  useEffect(() => {
    let cancelled = false;
    getItemRaw(itemId).then((it) => {
      if (cancelled) return;
      setBackdropTags(it.BackdropImageTags ?? []);
      setPrimaryTag(it.ImageTags?.Primary);
      setLogoTag(it.ImageTags?.Logo);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [itemId, refreshTick]);

  const bust = (u?: string, tag?: string) =>
    u ? `${u}${u.includes('?') ? '&' : '?'}bust=${tag ?? refreshTick}` : undefined;

  const primary = bust(
    imageUrl(itemId, 'Primary', { maxHeight: 600, tag: primaryTag }),
    primaryTag,
  );
  const logo = bust(
    imageUrl(itemId, 'Logo', { maxHeight: 300, tag: logoTag }),
    logoTag,
  );

  const applyOk = () => { setRefreshTick((n) => n + 1); };
  const showErr = (e: unknown) => toast((e as Error).message, 'warn');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 30 }}>
      <SingleImageSection
        label="Póster (Primary)" itemId={itemId} type="Primary" src={primary}
        onDone={applyOk} onError={showErr}
      />
      <BackdropSection
        itemId={itemId} tags={backdropTags} refreshTick={refreshTick}
        onDone={applyOk} onError={showErr}
      />
      <SingleImageSection
        label="Logo" itemId={itemId} type="Logo" src={logo} wide
        onDone={applyOk} onError={showErr}
      />
    </div>
  );
}

// -------- Póster / Logo (única) --------
function SingleImageSection({
  label, itemId, type, src, wide, onDone, onError,
}: {
  label: string; itemId: string; type: ImgType; src?: string; wide?: boolean;
  onDone: () => void; onError: (e: unknown) => void;
}) {
  const [alt, setAlt] = useState<'idle' | 'loading' | 'results'>('idle');
  const [images, setImages] = useState<JFRemoteImage[]>([]);
  const [applying, setApplying] = useState<string | null>(null);
  const toast = useToast();

  const doApplyUrl = async (url: string) => {
    try { await setImageByUrl(itemId, type, url); onDone(); }
    catch (e) { onError(e); }
  };
  const doUploadFile = async (file: File) => {
    try {
      await uploadImageFile(itemId, type, file);
      toast(`${label} subida (${(file.size / 1024).toFixed(0)} KB)`, 'success');
      onDone();
    } catch (e) { onError(e); }
  };
  const doDelete = async () => {
    if (!confirm(`¿Borrar ${label}?`)) return;
    try { await deleteImage(itemId, type); onDone(); }
    catch (e) { onError(e); }
  };

  const openAlternatives = async () => {
    setAlt('loading');
    try {
      const { images } = await getRemoteImages(itemId, type);
      setImages(images);
      setAlt('results');
    } catch (e) {
      setAlt('idle');
      onError(e);
    }
  };

  const applyRemote = async (url: string) => {
    setApplying(url);
    try {
      await setImageByUrl(itemId, type, url);
      toast(`${label} aplicada`, 'success');
      onDone();
      setAlt('idle');
    } catch (e) { onError(e); }
    finally { setApplying(null); }
  };

  return (
    <div>
      <SectionHeader label={label} onSearch={openAlternatives} loading={alt === 'loading'} />
      <ImageEditor
        src={src} wide={wide}
        onUploadFile={doUploadFile}
        onApplyUrl={doApplyUrl}
        onDelete={src ? doDelete : undefined}
      />
      {alt === 'results' && (
        <RemoteImagesGrid
          images={images} thumbAspect={type === 'Primary' ? '2/3' : '16/9'}
          onPick={applyRemote} applying={applying}
          onClose={() => setAlt('idle')}
        />
      )}
    </div>
  );
}

// -------- Fondos (múltiples) --------
function BackdropSection({
  itemId, tags, refreshTick, onDone, onError,
}: {
  itemId: string; tags: string[]; refreshTick: number;
  onDone: () => void; onError: (e: unknown) => void;
}) {
  const [alt, setAlt] = useState<'idle' | 'loading' | 'results'>('idle');
  const [images, setImages] = useState<JFRemoteImage[]>([]);
  const [applying, setApplying] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [newUrl, setNewUrl] = useState('');
  const toast = useToast();

  const thumbs = tags.map((tag, i) => ({
    index: i,
    url: imageUrl(itemId, 'Backdrop', { tag, maxWidth: 640, index: i })
      + `&bust=${refreshTick}`,
  }));

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    for (const f of Array.from(files)) {
      if (!/^image\//.test(f.type)) continue;
      try {
        await uploadImageFile(itemId, 'Backdrop', f);
        toast(`Fondo añadido (${(f.size / 1024).toFixed(0)} KB)`, 'success');
      } catch (e) { onError(e); }
    }
    onDone();
  };

  const addByUrl = async () => {
    try {
      await setImageByUrl(itemId, 'Backdrop', newUrl);
      toast('Fondo añadido', 'success');
      setNewUrl('');
      onDone();
    } catch (e) { onError(e); }
  };

  const deleteAt = async (index: number) => {
    if (!confirm(`¿Borrar el fondo ${index + 1}?`)) return;
    try { await deleteImage(itemId, 'Backdrop', index); onDone(); }
    catch (e) { onError(e); }
  };

  const openAlternatives = async () => {
    setAlt('loading');
    try {
      const { images } = await getRemoteImages(itemId, 'Backdrop');
      setImages(images);
      setAlt('results');
    } catch (e) { setAlt('idle'); onError(e); }
  };

  const applyRemote = async (url: string) => {
    setApplying(url);
    try {
      await setImageByUrl(itemId, 'Backdrop', url);
      toast('Fondo añadido', 'success');
      onDone();
    } catch (e) { onError(e); }
    finally { setApplying(null); }
  };

  return (
    <div>
      <SectionHeader
        label={`Fondos (${tags.length})`}
        onSearch={openAlternatives}
        loading={alt === 'loading'}
      />
      <div style={{ fontSize: 12, color: T.dim, marginBottom: 12 }}>
        Se muestran rotando en el hero de la ficha. Puedes tener todos los que quieras.
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {thumbs.map((b) => (
          <div key={b.index} style={{ position: 'relative' }}>
            <div style={{
              width: 220, aspectRatio: '16/9', borderRadius: 6,
              backgroundImage: `url(${b.url})`,
              backgroundSize: 'cover', backgroundPosition: 'center',
              border: '1px solid rgba(255,255,255,0.08)',
            }} />
            <button
              onClick={() => deleteAt(b.index)}
              aria-label="Borrar"
              style={{
                position: 'absolute', top: 6, right: 6,
                width: 26, height: 26, borderRadius: '50%',
                background: 'rgba(0,0,0,0.7)', color: '#fff',
                border: '1px solid rgba(255,255,255,0.2)',
                cursor: 'pointer', fontSize: 14, lineHeight: 1,
              }}
            >×</button>
          </div>
        ))}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
          onClick={() => fileRef.current?.click()}
          style={{
            width: 220, aspectRatio: '16/9', borderRadius: 6, cursor: 'pointer',
            background: 'rgba(255,255,255,0.05)',
            border: `1px dashed ${dragOver ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.2)'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: T.dim, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase',
            transition: 'border-color .15s',
          }}
        >
          + Añadir fondo
        </div>
      </div>
      <input
        ref={fileRef} type="file" accept="image/*" multiple hidden
        onChange={(e) => { handleFiles(e.target.files); e.target.value = ''; }}
      />
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <div style={{ flex: 1 }}>
          <TextInput value={newUrl} onChange={setNewUrl} placeholder="Añadir por URL: https://…" />
        </div>
        <SecondaryBtn onClick={addByUrl} disabled={!newUrl}>Añadir URL</SecondaryBtn>
      </div>
      {alt === 'results' && (
        <RemoteImagesGrid
          images={images} thumbAspect="16/9"
          onPick={applyRemote} applying={applying}
          onClose={() => setAlt('idle')}
        />
      )}
    </div>
  );
}

// -------- Utilidades UI de imágenes --------
function SectionHeader({
  label, onSearch, loading,
}: {
  label: string; onSearch: () => void; loading: boolean;
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', marginBottom: 10,
    }}>
      <div style={{
        fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', color: T.dim,
      }}>{label}</div>
      <div style={{ marginLeft: 'auto' }}>
        <SecondaryBtn onClick={onSearch} disabled={loading}>
          {loading ? 'Buscando…' : 'Buscar alternativas'}
        </SecondaryBtn>
      </div>
    </div>
  );
}

function ImageEditor({
  src, wide, onUploadFile, onApplyUrl, onDelete,
}: {
  src?: string; wide?: boolean;
  onUploadFile: (file: File) => void;
  onApplyUrl: (url: string) => void;
  onDelete?: () => void;
}) {
  const [newUrl, setNewUrl] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const previewStyle: React.CSSProperties = wide
    ? { width: 220, aspectRatio: '16/9' }
    : { width: 100, aspectRatio: '2/3' };

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const f = files[0];
    if (!/^image\//.test(f.type)) return;
    onUploadFile(f);
  };

  return (
    <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
        onClick={() => fileRef.current?.click()}
        style={{
          ...previewStyle,
          borderRadius: 6, cursor: 'pointer',
          background: 'rgba(255,255,255,0.05)',
          border: `1px dashed ${dragOver ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.16)'}`,
          backgroundImage: src ? `url(${src})` : undefined,
          backgroundSize: 'cover', backgroundPosition: 'center',
          position: 'relative', transition: 'border-color .15s, transform .15s',
          transform: dragOver ? 'scale(1.02)' : 'scale(1)',
        }}
      >
        {!src && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            fontSize: 11, color: T.dim, textAlign: 'center', padding: 8,
            letterSpacing: 1, textTransform: 'uppercase',
          }}>
            Arrastra o pulsa
          </div>
        )}
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <input
          ref={fileRef} type="file" accept="image/*" hidden
          onChange={(e) => { handleFiles(e.target.files); e.target.value = ''; }}
        />
        <div style={{ display: 'flex', gap: 8 }}>
          <PrimaryBtn onClick={() => fileRef.current?.click()}>Subir archivo</PrimaryBtn>
          {onDelete && <SecondaryBtn onClick={onDelete}>Borrar actual</SecondaryBtn>}
        </div>
        <div style={{ fontSize: 11, color: T.dim, marginTop: 4 }}>o desde una URL:</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <TextInput value={newUrl} onChange={setNewUrl} placeholder="https://…" />
          </div>
          <SecondaryBtn
            onClick={() => { onApplyUrl(newUrl); setNewUrl(''); }}
            disabled={!newUrl}
          >Aplicar URL</SecondaryBtn>
        </div>
      </div>
    </div>
  );
}

// -------- Grid de resultados remotos --------
function RemoteImagesGrid({
  images, thumbAspect, onPick, applying, onClose,
}: {
  images: JFRemoteImage[]; thumbAspect: string;
  onPick: (url: string) => void; applying: string | null;
  onClose: () => void;
}) {
  const [lang, setLang] = useState<string>('');
  const langs = Array.from(new Set(images.map((i) => i.Language).filter(Boolean))) as string[];
  const filtered = lang ? images.filter((i) => i.Language === lang) : images;
  return (
    <div style={{
      marginTop: 16, padding: 14, borderRadius: 10,
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.08)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ fontSize: 12, color: T.dim }}>
          {filtered.length} alternativa{filtered.length === 1 ? '' : 's'}
          {langs.length > 1 && (
            <select
              value={lang}
              onChange={(e) => setLang(e.target.value)}
              style={{
                marginLeft: 10, background: 'rgba(255,255,255,0.06)',
                color: '#fff', border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: 6, padding: '4px 8px', fontSize: 12,
              }}
            >
              <option value="">Todos los idiomas</option>
              {langs.map((l) => (<option key={l} value={l}>{l}</option>))}
            </select>
          )}
        </div>
        <button
          onClick={onClose}
          style={{
            marginLeft: 'auto', background: 'none', border: 'none',
            color: T.dim, cursor: 'pointer', fontSize: 12,
          }}
        >Cerrar ×</button>
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
        gap: 10, maxHeight: 380, overflowY: 'auto',
      }}>
        {filtered.map((im) => {
          const isApplying = applying === im.Url;
          return (
            <button
              key={im.Url}
              onClick={() => onPick(im.Url)}
              disabled={isApplying}
              title={[im.Width && im.Height && `${im.Width}×${im.Height}`, im.ProviderName, im.Language]
                .filter(Boolean).join(' · ')}
              style={{
                padding: 0, border: '1px solid rgba(255,255,255,0.08)',
                background: 'rgba(255,255,255,0.04)', borderRadius: 6,
                cursor: isApplying ? 'wait' : 'pointer',
                display: 'flex', flexDirection: 'column', overflow: 'hidden',
                opacity: isApplying ? 0.6 : 1,
                transition: 'transform .12s, border-color .12s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.02)';
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.35)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
              }}
            >
              <div style={{
                width: '100%', aspectRatio: thumbAspect,
                backgroundImage: `url(${im.ThumbnailUrl || im.Url})`,
                backgroundSize: 'cover', backgroundPosition: 'center',
              }} />
              <div style={{
                padding: '6px 8px', fontSize: 10, color: T.dim,
                display: 'flex', justifyContent: 'space-between', gap: 6,
                textAlign: 'left',
              }}>
                <span>{im.Width && im.Height ? `${im.Width}×${im.Height}` : ''}</span>
                <span>{im.Language ?? ''}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// -------- Subtítulos --------
function SubtitlesTab({ itemId }: { itemId: string }) {
  const [lang, setLang] = useState('spa');
  const [results, setResults] = useState<RemoteSubtitle[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const toast = useToast();

  const doSearch = async () => {
    setSearching(true);
    try {
      const rs = await searchSubtitles(itemId, lang);
      setResults(rs);
      if (rs.length === 0) toast('Sin resultados', 'info');
    } catch (e) {
      toast((e as Error).message, 'warn');
    } finally {
      setSearching(false);
    }
  };

  const doDownload = async (id: string) => {
    setDownloading(id);
    try {
      await downloadSubtitle(itemId, id);
      toast('Subtítulo descargado y aplicado', 'success');
    } catch (e) {
      toast((e as Error).message, 'warn');
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Muted>
        Busca subtítulos en los proveedores conectados en Jellyfin (OpenSubtitles, etc.).
        Se descargan y añaden como pista adicional al fichero.
      </Muted>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12 }}>
        <Field label="Idioma (ISO 639-2, ej. spa/eng/jpn)">
          <TextInput value={lang} onChange={setLang} />
        </Field>
        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
          <PrimaryBtn onClick={doSearch} disabled={searching || !lang}>
            {searching ? 'Buscando…' : 'Buscar'}
          </PrimaryBtn>
        </div>
      </div>

      {results && results.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
          {results.map((r) => (
            <div key={r.Id} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: 10,
              background: 'rgba(255,255,255,0.04)', borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.06)',
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{r.Name}</div>
                <div style={{ fontSize: 11, color: T.dim, marginTop: 2 }}>
                  {[r.ProviderName, r.Language, r.Format].filter(Boolean).join(' · ')}
                </div>
              </div>
              <SecondaryBtn onClick={() => doDownload(r.Id)} disabled={downloading === r.Id}>
                {downloading === r.Id ? 'Descargando…' : 'Descargar'}
              </SecondaryBtn>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// -------- Primitivas UI --------
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{
        fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', color: T.dim,
      }}>{label}</label>
      {children}
    </div>
  );
}

function TextInput({
  value, onChange, placeholder, autoFocus,
}: {
  value: string; onChange: (v: string) => void; placeholder?: string; autoFocus?: boolean;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      autoFocus={autoFocus}
      style={{
        width: '100%', boxSizing: 'border-box',
        background: 'rgba(255,255,255,0.06)',
        border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8,
        padding: '10px 12px', color: '#fff', fontFamily: T.ui, fontSize: 14,
        outline: 'none',
      }}
    />
  );
}

function TextArea({
  value, onChange, rows = 4,
}: {
  value: string; onChange: (v: string) => void; rows?: number;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={rows}
      style={{
        width: '100%', boxSizing: 'border-box',
        background: 'rgba(255,255,255,0.06)',
        border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8,
        padding: '10px 12px', color: '#fff', fontFamily: T.ui, fontSize: 14,
        outline: 'none', resize: 'vertical',
      }}
    />
  );
}

function PrimaryBtn({
  onClick, disabled, children,
}: {
  onClick: () => void; disabled?: boolean; children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick} disabled={disabled}
      style={{
        padding: '10px 18px', background: '#fff', color: '#000',
        border: 'none', borderRadius: 999,
        fontFamily: T.ui, fontSize: 13, fontWeight: 600, letterSpacing: 0.3,
        cursor: disabled ? 'wait' : 'pointer', opacity: disabled ? 0.7 : 1,
      }}
    >
      {children}
    </button>
  );
}

function SecondaryBtn({
  onClick, disabled, children,
}: {
  onClick: () => void; disabled?: boolean; children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick} disabled={disabled}
      style={{
        padding: '10px 16px', background: 'transparent', color: '#fff',
        border: '1px solid rgba(255,255,255,0.25)', borderRadius: 999,
        fontFamily: T.ui, fontSize: 13, fontWeight: 500,
        cursor: disabled ? 'wait' : 'pointer', opacity: disabled ? 0.7 : 1,
      }}
    >
      {children}
    </button>
  );
}

function FooterRow({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 12,
    }}>{children}</div>
  );
}

function Muted({ children }: { children: React.ReactNode }) {
  return <div style={{ color: T.dim, fontSize: 13, lineHeight: 1.5 }}>{children}</div>;
}
function ErrText({ children }: { children: React.ReactNode }) {
  return <div style={{ color: '#ff6b6b', fontSize: 13 }}>{children}</div>;
}
