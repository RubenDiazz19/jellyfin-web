import { useEffect, useState } from 'react';

import globalize from 'lib/globalize';

import { getSystemInfo, type SystemInfo } from '../../../domain/api';
import type { GoDashboard } from './types';
import { InfoRow, SectionStatus, SectionTitle, btnSecondary } from './ui';

export function ServerSection({ isAdmin, goDashboard }: { isAdmin: boolean; goDashboard: GoDashboard }) {
    const [info, setInfo] = useState<SystemInfo | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        getSystemInfo().then(setInfo).catch((e) => setError((e as Error).message));
    }, []);

    return (
        <div>
            <SectionTitle>{globalize.translate('TabServer')}</SectionTitle>
            <SectionStatus error={error} loaded={!!info} />
            {info && (
                <>
                    <InfoRow label={globalize.translate('LabelName')} value={info.serverName} />
                    <InfoRow label={globalize.translate('LabelVersion')} value={info.version} />
                    <InfoRow
                        label={globalize.translate('LabelOperatingSystem')}
                        value={info.operatingSystem || '—'}
                    />
                    <InfoRow label={globalize.translate('LabelServerId')} value={info.id} />
                </>
            )}
            {isAdmin && (
                <div style={{ marginTop: 32 }}>
                    <button style={btnSecondary} onClick={() => goDashboard()}>
                        {globalize.translate('HeaderAdvancedServerSettings')}
                    </button>
                </div>
            )}
        </div>
    );
}
