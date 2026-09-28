"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";
import { AuthSession, initialAuth } from "./session";

const Context = createContext<AuthSession | null>(null);
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session] = useState(
    () =>
      new AuthSession(
        process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080",
      ),
  );
  useEffect(() => {
    const disconnect = session.connect();
    void session.bootstrap();
    return disconnect;
  }, [session]);
  return <Context.Provider value={session}>{children}</Context.Provider>;
}
export function useAuth() {
  const session = useContext(Context);
  if (!session) throw new Error("AuthProvider is required");
  const state = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    () => initialAuth,
  );
  return { ...state, session };
}
