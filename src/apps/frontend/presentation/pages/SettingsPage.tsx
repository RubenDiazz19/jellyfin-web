import { T } from '../theme/tokens';
import { Nav } from '../components/layout/Nav';
import { useSession } from '../../domain/bridge/useSession';
import { useToast } from '../components/toast/ToastProvider';
import type { Navigate } from '../../app/router';

// Placeholder de ajustes/perfil. Deja hueco para las secciones reales de
// Jellyfin (usuarios, bibliotecas, reproducción, red…) sin implementarlas
// todavía; solo cubre lo que la app necesita hoy: ver la sesión y salir.
export function SettingsPage({ navigate }: { navigate: Navigate }) {
    const { session, logout } = useSession();
    const toast = useToast();
    const notImpl = (label: string) =>
        toast(`«${label}» — pendiente de conectar con Jellyfin`, 'info');

    return (
        <>
            <Nav navigate={navigate} breadcrumb={[{ label: 'Inicio', to: { page: 'home' } }, { label: 'Ajustes' }]} />
            <section style={{
                background: '#000', color: '#fff', minHeight: '100vh',
                padding: '120px 56px 96px', fontFamily: T.ui
            }}>
                <h1 style={{
                    fontFamily: T.display, fontStyle: 'italic', fontWeight: 300,
                    fontSize: 52, margin: 0, letterSpacing: -0.5, marginBottom: 44
                }}>
                    Ajustes
                </h1>

                <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 56, alignItems: 'start' }}>
                    <nav style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {[
                            { label: 'Perfil', active: true },
                            { label: 'Reproducción' },
                            { label: 'Subtítulos' },
                            { label: 'Bibliotecas' },
                            { label: 'Usuarios' },
                            { label: 'Servidor' },
                            { label: 'Plugins' }
                        ].map((item) => (
                            <button
                                key={item.label}
                                onClick={() => item.active ? undefined : notImpl(item.label)}
                                style={{
                                    textAlign: 'left', padding: '10px 14px',
                                    background: item.active ? 'rgba(255,255,255,0.08)' : 'transparent',
                                    color: item.active ? T.fg : T.dim,
                                    border: 'none', borderRadius: 8,
                                    fontFamily: T.ui, fontSize: 14, cursor: 'pointer',
                                    transition: 'background .15s, color .15s'
                                }}
                            >
                                {item.label}
                            </button>
                        ))}
                    </nav>

                    <div>
                        <div style={{
                            fontSize: 11, letterSpacing: 3, textTransform: 'uppercase',
                            color: T.dim, marginBottom: 18
                        }}>
                            Sesión
                        </div>
                        <Row label='Servidor' value={session?.serverUrl ?? '—'} />
                        <Row label='Usuario' value={session?.displayName ?? '—'} />
                        <Row label='Inicio de sesión' value={session ?
                            new Date(session.createdAt).toLocaleString('es-ES') :
                            '—'}
                        />

                        <div style={{ display: 'flex', gap: 12, marginTop: 32 }}>
                            <button
                                onClick={() => notImpl('Editar perfil')}
                                style={btnSecondary}
                            >
                                Editar perfil
                            </button>
                            <button onClick={logout} style={btnDanger}>
                                Cerrar sesión
                            </button>
                        </div>
                    </div>
                </div>
            </section>
        </>
    );
}

function Row({ label, value }: { label: string; value: string }) {
    return (
        <div style={{
            display: 'grid', gridTemplateColumns: '160px 1fr', padding: '14px 0',
            borderBottom: `1px solid ${T.hairline}`, fontSize: 14
        }}>
            <span style={{ color: T.dim }}>{label}</span>
            <span style={{ color: T.fg }}>{value}</span>
        </div>
    );
}

const btnSecondary: React.CSSProperties = {
    padding: '10px 20px',
    background: 'rgba(255,255,255,0.08)', color: T.fg,
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: 999, fontFamily: T.ui, fontSize: 13,
    cursor: 'pointer', fontWeight: 500
};

const btnDanger: React.CSSProperties = {
    padding: '10px 20px',
    background: 'transparent', color: '#ff6b6b',
    border: '1px solid rgba(255,80,80,0.4)',
    borderRadius: 999, fontFamily: T.ui, fontSize: 13,
    cursor: 'pointer', fontWeight: 500
};
