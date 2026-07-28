import globalize from 'lib/globalize';

import React from 'react';
import { T } from '../../theme/tokens';

type Props = { children: React.ReactNode };
type State = { error: Error | null };

// Barrera de errores por página: un throw en el render de una ruta ya no
// tira la app entera — se ofrece recargar o volver al inicio. App.tsx la
// monta con key por ruta, así navegar resetea el estado de error.
export class ErrorBoundary extends React.Component<Props, State> {
    state: State = { error: null };

    static getDerivedStateFromError(error: Error): State {
        return { error };
    }

    componentDidCatch(error: Error, info: React.ErrorInfo) {
        console.error('[ErrorBoundary]', error, info.componentStack);
    }

    // eslint-disable-next-line sonarjs/function-return-type -- children (ReactNode) o el fallback (JSX): ambos son renderizables
    render() {
        if (!this.state.error) return this.props.children;
        return (
            <section style={{
                minHeight: '100vh', background: '#000', color: '#fff',
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', gap: 18, padding: 24, fontFamily: T.ui,
                textAlign: 'center'
            }}>
                <div style={{
                    fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', color: T.dim
                }}>
                    {globalize.translate('HeaderSomethingWentWrong')}
                </div>
                <div style={{ fontSize: 15, color: 'rgba(255,255,255,0.85)', maxWidth: 560 }}>
                    {this.state.error.message || globalize.translate('MessageUnexpectedRenderError')}
                </div>
                <div style={{ display: 'flex', gap: 12, marginTop: 10 }}>
                    <button
                        onClick={() => window.location.reload()}
                        style={{
                            padding: '10px 22px', borderRadius: 999, border: 'none',
                            background: '#fff', color: '#000', fontFamily: T.ui,
                            fontSize: 13, fontWeight: 600, cursor: 'pointer'
                        }}
                    >
                        {globalize.translate('ButtonReload')}
                    </button>
                    <button
                        onClick={() => {
                            window.location.hash = '#/';
                            this.setState({ error: null });
                        }}
                        style={{
                            padding: '10px 22px', borderRadius: 999,
                            border: '1px solid rgba(255,255,255,0.3)',
                            background: 'transparent', color: '#fff', fontFamily: T.ui,
                            fontSize: 13, fontWeight: 500, cursor: 'pointer'
                        }}
                    >
                        {globalize.translate('ButtonBackToHome')}
                    </button>
                </div>
            </section>
        );
    }
}
