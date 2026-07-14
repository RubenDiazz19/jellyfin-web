// Estado "visto" persistido en localStorage. Emite un evento cuando
// cambia para que los hooks suscritos se re-lean.
//
// El Set vive en memoria: `has()` es una consulta O(1) sin tocar
// localStorage. Solo escribimos JSON al persistir un cambio.

const KEY = 'jfp-watched';
const EVENT = 'jfp-watched-change';

let cache: Set<string> | null = null;

function ensure(): Set<string> {
  if (cache) return cache;
  try {
    cache = new Set(JSON.parse(localStorage.getItem(KEY) || '[]'));
  } catch {
    cache = new Set();
  }
  return cache;
}

function persist() {
  if (!cache) return;
  localStorage.setItem(KEY, JSON.stringify([...cache]));
  window.dispatchEvent(new Event(EVENT));
}

export const WATCHED = {
  event: EVENT,
  has(id: string): boolean {
    return ensure().has(id);
  },
  toggle(id: string) {
    const s = ensure();
    if (s.has(id)) s.delete(id);
    else s.add(id);
    persist();
  },
  setMany(ids: string[], value: boolean) {
    const s = ensure();
    ids.forEach((id) => (value ? s.add(id) : s.delete(id)));
    persist();
  },
};
