import { useEffect, useState } from 'react';

import globalize from 'lib/globalize';

import { getUsers, type UserListEntry } from '../../../domain/api';
import { T } from '../../theme/tokens';
import type { GoDashboard } from './types';
import { SectionStatus, SectionTitle, btnSecondary } from './ui';

export function UsersSection({ goDashboard }: { goDashboard: GoDashboard }) {
    const [users, setUsers] = useState<UserListEntry[] | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        getUsers().then(setUsers).catch((e) => setError((e as Error).message));
    }, []);

    return (
        <div>
            <SectionTitle>{globalize.translate('HeaderUsers')}</SectionTitle>
            <SectionStatus error={error} loaded={!!users} />
            {users && (
                <div style={{ marginBottom: 32 }}>
                    {users.map((u) => (
                        <div key={u.id} style={{
                            display: 'flex', alignItems: 'center', gap: 14,
                            padding: '14px 0', borderBottom: `1px solid ${T.hairline}`, fontSize: 14
                        }}>
                            <div style={{
                                width: 34, height: 34, borderRadius: '50%',
                                background: 'linear-gradient(135deg,#d9a566,#3a1f10)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 14, fontWeight: 600, flexShrink: 0
                            }}>
                                {u.name.slice(0, 1).toUpperCase()}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <span>{u.name}</span>
                                {u.isAdmin && (
                                    <span style={{
                                        marginLeft: 10, fontSize: 10, letterSpacing: 1.5,
                                        textTransform: 'uppercase', color: '#d9a566',
                                        border: '1px solid rgba(217,165,102,0.4)',
                                        borderRadius: 999, padding: '2px 8px'
                                    }}>
                                        {globalize.translate('Administrator')}
                                    </span>
                                )}
                                {u.isDisabled && (
                                    <span style={{ marginLeft: 10, fontSize: 12, color: '#ff6b6b' }}>
                                        {globalize.translate('Disabled')}
                                    </span>
                                )}
                            </div>
                            <span style={{ color: T.dim, fontSize: 12 }}>
                                {u.lastActivity ?
                                    globalize.translate(
                                        'LastSeen',
                                        new Date(u.lastActivity).toLocaleString(globalize.getCurrentDateTimeLocale())
                                    ) :
                                    globalize.translate('MessageNoActivity')}
                            </span>
                        </div>
                    ))}
                </div>
            )}
            <div style={{ color: T.dim, fontSize: 13, marginBottom: 16 }}>
                {globalize.translate('MessageManageUsersInDashboard')}
            </div>
            <button style={btnSecondary} onClick={() => goDashboard('/users')}>
                {globalize.translate('HeaderManageUsers')}
            </button>
        </div>
    );
}
