import globalize from 'lib/globalize';

import { Nav } from '../components/layout/Nav';
import { usePlayer } from '../components/player/PlayerProvider';
import { QueuePanel } from '../components/queue/QueuePanel';
import { PageSection } from '../components/layout/PageSection';
import { PageTitle } from '../components/layout/Title';
import { queueVM } from '../../domain/viewModels/QueueViewModel';
import type { Navigate } from '../../app/router';

// Cola de reproducción a pantalla completa. El reproductor muestra la misma
// lista en un overlay; aquí se puede gestionar sin estar reproduciendo nada.
export function QueuePage({ navigate }: { navigate: Navigate }) {
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
                <PageTitle margin='0 0 36px'>{globalize.translate('HeaderPlayQueue')}</PageTitle>

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
