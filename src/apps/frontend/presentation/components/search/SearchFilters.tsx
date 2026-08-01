// Filas de filtro de la búsqueda: tipo, estado, etiquetas y vistas guardadas.
//
// Vive aparte de SearchPage porque lo usan dos sitios —la página /search y la
// superposición que abre la lupa— y son exactamente los mismos filtros sobre
// el mismo ViewModel. Duplicarlo era garantizar que se separasen a la primera
// corrección.

import { useEffect, useState } from 'react';

import globalize from 'lib/globalize';

import { T } from '../../theme/tokens';
import { useResponsive } from '../../theme/responsive';
import { useToast } from '../toast/ToastProvider';
import { searchVM, type StateFilter, type TypeFilter } from '../../../domain/viewModels/SearchViewModel';
import { VIEWS, type SavedView } from '../../../domain/stores';

const TYPE_TABS: { id: TypeFilter; key: string }[] = [
    { id: 'todo', key: 'All' },
    { id: 'series', key: 'Shows' },
    { id: 'peliculas', key: 'Movies' }
];

const STATE_TABS: { id: StateFilter; key: string }[] = [
    { id: 'todo', key: 'All' },
    { id: 'favs', key: 'Favorites' },
    { id: 'vistos', key: 'Watched' },
    { id: 'no-vistos', key: 'Unwatched' }
];

export function SearchFilters() {
    const typeFilter = searchVM.typeFilter.value;
    const stateFilter = searchVM.stateFilter.value;
    const allTags = searchVM.allTags.value;

    return (
        <>
            <FilterRow<TypeFilter>
                label={globalize.translate('LabelType')}
                tabs={TYPE_TABS}
                active={typeFilter}
                onChange={searchVM.setTypeFilter}
            />
            <FilterRow<StateFilter>
                label={globalize.translate('LabelStatus')}
                tabs={STATE_TABS}
                active={stateFilter}
                onChange={searchVM.setStateFilter}
            />
            {/* Sin etiquetas en la biblioteca la fila sobra: no se pinta. */}
            {allTags.length > 0 && <TagFilterRow tags={allTags} />}
            <SavedViewsRow />
        </>
    );
}

/** Etiqueta de la fila, a la izquierda. Se oculta en móvil por sitio. */
function RowLabel({ text }: { text: string }) {
    const r = useResponsive();
    if (r.mobile) return null;
    return (
        <span style={{
            fontSize: 10, letterSpacing: 3, textTransform: 'uppercase',
            color: T.dim, minWidth: 60
        }}>
            {text}
        </span>
    );
}

/**
 * Contenedor de una fila de chips.
 *
 * En touch hace scroll horizontal (es el gesto natural ahí); en escritorio
 * envuelve, porque no hay tal gesto y los chips que no cabían se quedaban
 * fuera del viewport sin forma de alcanzarlos con el ratón.
 */
function ChipRow({ label, children }: { label: string; children: React.ReactNode }) {
    const r = useResponsive();
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: r.touch ? 14 : 20 }}>
            <RowLabel text={label} />
            <div style={{
                display: 'flex', gap: 8, alignItems: 'center',
                flexWrap: r.touch ? 'nowrap' : 'wrap',
                overflowX: r.touch ? 'auto' : undefined,
                scrollbarWidth: r.touch ? 'none' : undefined,
                paddingBottom: r.touch ? 2 : undefined
            }}>
                {children}
            </div>
        </div>
    );
}

function Chip({ active, onClick, children, dashed }: {
    active?: boolean;
    onClick: () => void;
    children: React.ReactNode;
    dashed?: boolean;
}) {
    return (
        <button
            onClick={onClick}
            // Chrome desplaza el scroll para dejar visible lo que enfoca al
            // pulsar; en una fila que envuelve eso salta la página entera.
            onMouseDown={(e) => e.preventDefault()}
            style={{
                padding: '7px 16px', borderRadius: 999, cursor: 'pointer',
                fontFamily: T.ui, fontSize: 13, fontWeight: 500, transition: 'all .15s',
                whiteSpace: 'nowrap',
                background: active ? T.fg : dashed ? 'none' : 'rgba(255,255,255,0.08)',
                color: active ? '#000' : T.dim,
                border: dashed ? '1px dashed rgba(255,255,255,0.25)' : 'none'
            }}
        >
            {children}
        </button>
    );
}

// Un chip lleva o `key` (clave a traducir, para las opciones fijas) o `label`
// (texto tal cual, para las etiquetas: las escribe el usuario y no se traducen).
type Tab<T extends string> =
    | { id: T; key: string; label?: never }
    | { id: T; label: string; key?: never };

/** Fila de una sola opción activa: tipo y estado. */
function FilterRow<T extends string>({ label, tabs, active, onChange }: {
    label: string;
    tabs: Tab<T>[];
    active: T;
    onChange: (v: T) => void;
}) {
    return (
        <ChipRow label={label}>
            {tabs.map((tab) => (
                <Chip key={tab.id} active={active === tab.id} onClick={() => onChange(tab.id)}>
                    {tab.key ? globalize.translate(tab.key) : tab.label}
                </Chip>
            ))}
        </ChipRow>
    );
}

/**
 * Fila de etiquetas, con varias activas a la vez. «Todo» no es una etiqueta
 * más: limpia el filtro, y se marca cuando no hay ninguna puesta.
 */
function TagFilterRow({ tags }: { tags: string[] }) {
    const active = searchVM.tagFilters.value;
    return (
        <ChipRow label={globalize.translate('Tags')}>
            <Chip active={active.length === 0} onClick={searchVM.clearTagFilters}>
                {globalize.translate('All')}
            </Chip>
            {tags.map((tag) => (
                <Chip
                    key={tag}
                    active={searchVM.hasTagFilter(tag)}
                    onClick={() => searchVM.toggleTagFilter(tag)}
                >
                    {tag}
                </Chip>
            ))}
        </ChipRow>
    );
}

/**
 * Vistas guardadas: un chip por vista más «guardar actual». La fila aparece
 * en cuanto hay una vista o hay filtros que valga la pena guardar, para no
 * ocupar sitio en la pantalla de búsqueda recién abierta.
 */
function SavedViewsRow() {
    const [views, setViews] = useState<SavedView[]>(() => VIEWS.all());
    const [naming, setNaming] = useState(false);
    const [name, setName] = useState('');
    const toast = useToast();
    const anyFilterActive = searchVM.anyFilterActive.value;

    useEffect(() => {
        const sync = () => setViews(VIEWS.all());
        window.addEventListener(VIEWS.event, sync);
        return () => window.removeEventListener(VIEWS.event, sync);
    }, []);

    if (views.length === 0 && !anyFilterActive) return null;

    const save = () => {
        const clean = name.trim();
        if (!clean) return;
        VIEWS.save(searchVM.currentView(clean));
        toast(globalize.translate('MessageViewSaved'), 'success');
        setName('');
        setNaming(false);
    };

    return (
        <ChipRow label={globalize.translate('HeaderMyViews')}>
            {views.map((v) => (
                <span
                    key={v.id}
                    style={{
                        display: 'inline-flex', alignItems: 'center',
                        borderRadius: 999, background: 'rgba(255,255,255,0.08)'
                    }}
                >
                    <button
                        onClick={() => searchVM.applyView(v)}
                        onMouseDown={(e) => e.preventDefault()}
                        style={{
                            padding: '7px 8px 7px 16px', border: 'none', background: 'none',
                            color: T.dim, fontFamily: T.ui, fontSize: 13, cursor: 'pointer',
                            whiteSpace: 'nowrap'
                        }}
                    >
                        {v.name}
                    </button>
                    <button
                        onClick={() => VIEWS.remove(v.id)}
                        onMouseDown={(e) => e.preventDefault()}
                        aria-label={`${globalize.translate('Delete')} ${v.name}`}
                        style={{
                            padding: '0 12px 0 4px', border: 'none', background: 'none',
                            color: T.dim, fontSize: 14, lineHeight: 1, cursor: 'pointer'
                        }}
                    >×</button>
                </span>
            ))}

            {naming ? (
                <span style={{ display: 'inline-flex', gap: 6 }}>
                    <input
                        autoFocus
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') save();
                            // Se para aquí: si no, el Escape llegaría a la
                            // superposición y la cerraría al cancelar el nombre.
                            if (e.key === 'Escape') {
                                e.stopPropagation();
                                setNaming(false);
                            }
                        }}
                        placeholder={globalize.translate('LabelViewName')}
                        style={{
                            background: 'rgba(255,255,255,0.06)', color: 'inherit',
                            border: '1px solid rgba(255,255,255,0.15)', borderRadius: 999,
                            padding: '6px 14px', fontFamily: T.ui, fontSize: 13, outline: 'none'
                        }}
                    />
                    <button
                        onClick={save}
                        style={{
                            padding: '6px 14px', borderRadius: 999, border: 'none',
                            background: '#fff', color: '#000',
                            fontFamily: T.ui, fontSize: 12, fontWeight: 600, cursor: 'pointer'
                        }}
                    >
                        {globalize.translate('Save')}
                    </button>
                </span>
            ) : anyFilterActive && (
                <Chip dashed onClick={() => setNaming(true)}>
                    + {globalize.translate('SaveCurrentView')}
                </Chip>
            )}
        </ChipRow>
    );
}
