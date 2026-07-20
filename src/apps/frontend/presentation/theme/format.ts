// Convierte "176 min" en "2 h 56 min" cuando supera los 60 min.
// Si el valor no es un número simple de minutos (p.ej. "47–51 min") se
// devuelve tal cual.
export function formatRuntime(runtime: string | number | undefined): string {
    if (runtime == null) return '';
    const t = parseInt(String(runtime), 10);
    if (!t || !/^\d+\s*min$/.test(String(runtime).trim())) return String(runtime);
    const h = Math.floor(t / 60);
    const m = t % 60;
    return h ? (m ? `${h} h ${m} min` : `${h} h`) : `${m} min`;
}

type Minutes = number | string | undefined;

// Tiempo restante compacto para overlays: <60 min → "42 min";
// a partir de 60 → "1 h 12 min" (o "2 h" si cae en punto).
export function formatRemainingCompact(minutes: Minutes): string {
    const m = parseInt(String(minutes ?? ''), 10);
    if (!m || m < 0) return '';
    if (m < 60) return `${m} min`;
    const h = Math.floor(m / 60);
    const r = m % 60;
    return r ? `${h} h ${r} min` : `${h} h`;
}

// Convierte minutos restantes en "1 hora y 20 minutos restantes".
export function formatRemaining(
    minutes: Minutes,
    { suffix = ' restantes' }: { suffix?: string } = {}
): string {
    const m = parseInt(String(minutes ?? ''), 10);
    if (!m) return '';
    if (m > 60) {
        const h = Math.floor(m / 60);
        const r = m % 60;
        const hp = `${h} ${h === 1 ? 'hora' : 'horas'}`;
        return r ? `${hp} y ${r} minutos${suffix}` : `${hp}${suffix}`;
    }
    return `${m} minutos${suffix}`;
}

// Fecha larga en español ("10 de julio de 2015") con caché: toLocaleDateString
// crea un Intl.DateTimeFormat en cada llamada y las páginas repiten la misma
// fecha varias veces por render.
const dateCache = new Map<string, string>();

export function formatDateLong(date: string | undefined): string {
    if (!date) return '';
    const hit = dateCache.get(date);
    if (hit != null) return hit;
    const formatted = new Date(date).toLocaleDateString('es-ES', {
        year: 'numeric', month: 'long', day: 'numeric'
    });
    dateCache.set(date, formatted);
    return formatted;
}
