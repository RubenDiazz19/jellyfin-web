import globalize from 'lib/globalize';

export type RuntimeValue = string | number | undefined;

const HM_REGEX = /^(?:(\d+)\s*h)?\s*(?:(\d+)\s*m)?/i;

// Extrae el número de minutos enteros de un valor de duración
// (ej. 70, "70 min", "2 h 56 min", "176 min", "45").
export function parseRuntimeMinutes(runtime: RuntimeValue): number | undefined {
    if (runtime == null) return undefined;
    if (typeof runtime === 'number') {
        return !isNaN(runtime) && runtime > 0 ? Math.round(runtime) : undefined;
    }
    const str = String(runtime).trim();
    if (!str || str === '—') return undefined;

    // Formato "2 h 56 min" o "2 h" o "56 min"
    const hm = HM_REGEX.exec(str);
    if (hm && (hm[1] || hm[2])) {
        const h = hm[1] ? parseInt(hm[1], 10) : 0;
        const m = hm[2] ? parseInt(hm[2], 10) : 0;
        const total = h * 60 + m;
        if (total > 0) return total;
    }

    // Número directo o con rango (ej. "47–51 min" → toma el primer valor)
    const direct = parseInt(str, 10);
    return (!isNaN(direct) && direct > 0) ? direct : undefined;
}

// Convierte "176 min" en "2 h 56 min" cuando supera los 60 min.
// Si el valor no es un número simple de minutos (p.ej. "47–51 min") se
// devuelve tal cual.
export function formatRuntime(runtime: RuntimeValue): string {
    if (runtime == null) return '';
    if (typeof runtime === 'number') {
        const t = Math.round(runtime);
        if (!t || t <= 0) return '';
        const h = Math.floor(t / 60);
        const m = t % 60;
        return h ? (m ? `${h} h ${m} min` : `${h} h`) : `${m} min`;
    }
    const str = String(runtime).trim();
    if (!str || str === '—') return '';
    if (!/^\d+(\s*min)?$/.test(str)) return str;
    const t = parseInt(str, 10);
    if (!t || t <= 0) return str;
    const h = Math.floor(t / 60);
    const m = t % 60;
    return h ? (m ? `${h} h ${m} min` : `${h} h`) : `${m} min`;
}

// Calcula y formatea a qué hora terminaría una reproducción si se inicia ahora.
export function formatEndTime(
    runtime: RuntimeValue,
    fromDate: Date = new Date()
): string | undefined {
    const mins = parseRuntimeMinutes(runtime);
    if (mins == null || mins <= 0) return undefined;
    const end = new Date(fromDate.getTime() + mins * 60 * 1000);
    const timeStr = end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return globalize.translate('EndsAtValue', timeStr);
}

// Tiempo restante compacto para overlays: <60 min → "42 min";
// a partir de 60 → "1 h 12 min" (o "2 h" si cae en punto).
export function formatRemainingCompact(minutes: RuntimeValue): string {
    const m = parseInt(String(minutes ?? ''), 10);
    if (!m || m < 0) return '';
    if (m < 60) return `${m} min`;
    const h = Math.floor(m / 60);
    const r = m % 60;
    return r ? `${h} h ${r} min` : `${h} h`;
}

// Convierte minutos restantes en "1 hora y 20 minutos restantes".
export function formatRemaining(
    minutes: RuntimeValue,
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
