import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { loadSession, clearSession, SESSION_EVENT, wireServerConnectionsEvents, type Session } from './session';
import { clearShowCache } from '../api/jellyfin';

type SessionContextValue = {
  session: Session | null;
  logout: () => void;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(() => loadSession());

  useEffect(() => {
    wireServerConnectionsEvents();
    const update = () => setSession(loadSession());
    window.addEventListener(SESSION_EVENT, update);
    return () => window.removeEventListener(SESSION_EVENT, update);
  }, []);

  const logout = () => { clearShowCache(); clearSession(); };

  return (
    <SessionContext.Provider value={{ session, logout }}>{children}</SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside <SessionProvider>');
  return ctx;
}
