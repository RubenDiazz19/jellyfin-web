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

// Convierte minutos restantes en "1 hora y 20 minutos restantes".
export function formatRemaining(
  minutes: number | string | undefined,
  { suffix = ' restantes' }: { suffix?: string } = {},
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
