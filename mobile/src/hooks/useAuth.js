import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { AppState } from "react-native";
import { demoRanger } from "../constants/demo";
import { loginAccount, getSessionUser } from "../services/authApi";
import { api } from "../services/api";
const Context = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [demo, setDemo] = useState(false);
  const [hasLoggedOut, setLoggedOut] = useState(false);
  const generation = useRef(0);
  const pending = useRef(false);
  useEffect(
    () => () => {
      generation.current += 1;
      delete api.defaults.headers.common.Authorization;
    },
    [],
  );
  function logout() {
    setLoggedOut(true);
    generation.current += 1;
    delete api.defaults.headers.common.Authorization;
    setSession(null);
    setDemo(false);
  }
  async function login(credentials) {
    if (pending.current) return;
    pending.current = true;
    const attempt = ++generation.current;
    try {
      const data = await loginAccount(credentials);
      // /me verifies the token and reloads the current role and active state from DB.
      const user = await getSessionUser(data.token);
      if (attempt !== generation.current) return;
      if (data.expiresAt <= Date.now())
        throw new Error("Session expired. Please login again.");
      api.defaults.headers.common.Authorization = `Bearer ${data.token}`;
      setDemo(false);
      setSession({ user, token: data.token, expiresAt: data.expiresAt });
    } finally {
      pending.current = false;
    }
  }
  useEffect(() => {
    const interceptor = api.interceptors.response.use(
      (response) => response,
      (error) => {
        if (
          session &&
          (error.response?.status === 401 ||
            error.response?.data?.code === "ACCOUNT_NOT_APPROVED") &&
          error.config?.headers?.Authorization === `Bearer ${session.token}`
        )
          logout();
        return Promise.reject(error);
      },
    );
    return () => api.interceptors.response.eject(interceptor);
  }, [session]);
  useEffect(() => {
    if (!session) return;
    const timer = setTimeout(
      logout,
      Math.max(0, session.expiresAt - Date.now()),
    );
    const listener = AppState.addEventListener("change", async (state) => {
      if (state !== "active") return;
      const attempt = generation.current;
      try {
        if (session.expiresAt <= Date.now()) {
          logout();
          return;
        }
        const user = await getSessionUser(session.token);
        if (attempt === generation.current)
          setSession((current) =>
            current?.token === session.token ? { ...current, user } : current,
          );
      } catch {
        // Fail closed when a resumed session cannot be verified.
        if (attempt === generation.current) logout();
      }
    });
    return () => {
      clearTimeout(timer);
      listener.remove();
    };
  }, [session]);
  return (
    <Context.Provider
      value={{
        user: demo ? demoRanger : session?.user || null,
        isDemo: demo,
        isAuthenticated: !!session && !demo,
        hasLoggedOut,
        login,
        logout,
        enterDemo: () => {
          logout();
          setDemo(true);
        },
        leaveDemo: logout,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export const useAuth = () => useContext(Context);
