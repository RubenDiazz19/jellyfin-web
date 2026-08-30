export type RuntimeValue = string | number | undefined;

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
    const t = parseInt(str, 10);
    if (!t) return str;
    if (str.endsWith('min') || /^\d+$/.test(str)) {
        const h = Math.floor(t / 60);
        const m = t % 60;
        return h ? (m ? `${h} h ${m} min` : `${h} h`) : `${m} min`;
    }
    return str;
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

/**
 * Parsea una duración dada como número o como cadena ("70 min", "1 h 10 min", etc.)
 * a minutos enteros. Devuelve null si no es válida.
 */
export function parseRuntimeMinutes(runtime: RuntimeValue): number | null {
    if (runtime == null) return null;
    if (typeof runtime === 'number') {
        return isNaN(runtime) || runtime <= 0 ? null : Math.round(runtime);
    }
    const str = String(runtime).trim();
    if (!str) return null;

    const parts = str.split(/\s+/);
    let totalMinutes = 0;
    let foundUnit = false;

    for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (!part) continue;

        if (part.endsWith('min')) {
            const num = parseInt(part.slice(0, -3), 10);
            if (!isNaN(num) && num > 0) {
                totalMinutes += num;
                foundUnit = true;
            }
        } else if (part.endsWith('h')) {
            const num = parseInt(part.slice(0, -1), 10);
            if (!isNaN(num) && num > 0) {
                totalMinutes += num * 60;
                foundUnit = true;
            }
        } else if (i + 1 < parts.length && (parts[i + 1] === 'h' || parts[i + 1] === 'min')) {
            const num = parseInt(part, 10);
            const unit = parts[i + 1];
            if (!isNaN(num) && num > 0) {
                totalMinutes += unit === 'h' ? num * 60 : num;
                foundUnit = true;
                i++;
            }
        } else {
            const num = parseInt(part, 10);
            if (!isNaN(num) && num > 0 && parts.length === 1) {
                return num;
            }
        }
    }

    if (foundUnit && totalMinutes > 0) {
        return totalMinutes;
    }

    const fallbackNum = parseInt(str, 10);
    return !isNaN(fallbackNum) && fallbackNum > 0 ? fallbackNum : null;
}

/**
 * Calcula y formatea la hora de finalización en base a la duración y fecha actual.
 * Devuelve ej. «Termina a las 22:45» o null si no se puede calcular.
 */
export function formatEndTime(runtime: RuntimeValue, baseDate: Date = new Date()): string | null {
    const mins = parseRuntimeMinutes(runtime);
    if (!mins) return null;
    const endTime = new Date(baseDate.getTime() + mins * 60 * 1000);
    const hours = String(endTime.getHours()).padStart(2, '0');
    const minutes = String(endTime.getMinutes()).padStart(2, '0');
    return `Termina a las ${hours}:${minutes}`;
}
