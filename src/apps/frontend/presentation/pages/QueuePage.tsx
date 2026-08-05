import globalize from 'lib/globalize';

import { Nav } from '../components/layout/Nav';
import { usePlayer } from '../components/player/PlayerProvider';
import { QueuePanel } from '../components/queue/QueuePanel';
import { PageSection } from '../components/layout/PageSection';
import { useResponsive } from '../theme/responsive';
import { T } from '../theme/tokens';
import { queueVM } from '../../domain/viewModels/QueueViewModel';
import type { Navigate } from '../../app/router';

// Cola de reproducción a pantalla completa. El reproductor muestra la misma
// lista en un overlay; aquí se puede gestionar sin estar reproduciendo nada.
export function QueuePage({ navigate }: { navigate: Navigate }) {
    const r = useResponsive();
    const { play } = usePlayer();

    return (
        <>
            <Nav
                navigate={navigate}
                breadcrumb={[
                    { label: globalize.translate('Home'), to: { page: 'home' } },
                    { label: globalize.translate('HeaderPlayQueue') }
                ]}
            />
            <PageSection>
                <h1 style={{
                    fontFamily: T.display, fontStyle: 'italic', fontWeight: 300,
                    fontSize: r.touch ? 32 : 52, margin: '0 0 36px', letterSpacing: -0.5
                }}>
                    {globalize.translate('HeaderPlayQueue')}
                </h1>

                <div style={{ maxWidth: 720 }}>
                    <QueuePanel
                        onPlay={(entry) => {
                            queueVM.takeFor(entry.itemId);
                            play({ itemId: entry.itemId, title: entry.title });
                        }}
                    />
                </div>
            </PageSection>
        </>
    );
}
