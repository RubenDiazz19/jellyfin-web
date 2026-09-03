import { T } from '../../theme/tokens';
import { useResponsive } from '../../theme/responsive';

// Animated placeholders shown while a title is still loading its
// poster/backdrop from the Jellyfin API.

export function SkeletonPoster() {
    const r = useResponsive();
    const w = r.touch ? r.cardW : 230;
    return (
        <div style={{ width: w, flex: `0 0 ${w}px` }}>
            <div className='jfp-skeleton' style={{ aspectRatio: '2/3', borderRadius: 4 }} />
            <div className='jfp-skeleton' style={{ height: 12, marginTop: 12, width: '60%' }} />
        </div>
    );
}

export function SkeletonRow({ count = 6, title }: { count?: number; title?: string }) {
    const r = useResponsive();
    return (
        <div style={{
            marginTop: r.touch ? 28 : 64,
            padding: r.touch ? `0 ${r.pagePad}px` : '0 56px'
        }}>
            {title && (
                <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: r.touch ? 12 : 24 }}>
                    <h3 style={{
                        fontFamily: T.ui,
                        fontSize: r.touch ? 21 : 30, fontWeight: 300,
                        margin: 0, letterSpacing: -0.3, color: T.dim
                    }}>
                        {title}
                    </h3>
                </div>
            )}
            <div style={{ display: 'flex', gap: r.touch ? r.gap : 24, overflowX: 'hidden' }}>
                {Array.from({ length: count }).map((_, i) => <SkeletonPoster key={i} />)}
            </div>
        </div>
    );
}

// Estado vacío reutilizable — mismo layout centrado para "sin resultados",
// biblioteca vacía, sin favoritos, etc.
export function EmptyState({
    title, hint, icon = '·'
}: {
    title: string; hint?: string; icon?: string;
}) {
    return (
        <div style={{
            minHeight: 240,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            padding: '80px 24px', color: T.dim, fontFamily: T.ui, textAlign: 'center'
        }}>
            <div style={{ fontSize: 42, opacity: 0.4, marginBottom: 14 }}>{icon}</div>
            <div style={{ fontSize: 15, color: T.fg, fontWeight: 500, marginBottom: 6 }}>{title}</div>
            {hint && <div style={{ fontSize: 13, maxWidth: 420, lineHeight: 1.5 }}>{hint}</div>}
        </div>
    );
}
