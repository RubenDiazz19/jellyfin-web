// Hook puente de sesión: expone el SessionViewModel a React con la misma
// forma ({ session, logout }) que tenía el antiguo SessionProvider.

import { useEffect } from 'react';
import type { Session } from '../../data/api/ApiService';
import { sessionVM } from '../viewModels/SessionViewModel';
import { useViewModel } from './useViewModel';

export function useSession(): { session: Session | null; logout: () => void } {
    // Hidrata el signal en el primer render (no en un effect): evita pintar
    // LoginPage un frame cuando ya hay sesión persistida. Idempotente.
    sessionVM.hydrate();
    useViewModel(sessionVM);
    useEffect(() => sessionVM.start(), []);
    return { session: sessionVM.session.value, logout: sessionVM.logout };
}
