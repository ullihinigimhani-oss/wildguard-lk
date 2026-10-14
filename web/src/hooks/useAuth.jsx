import { createContext, useContext, useEffect, useState, useRef } from "react";
import { api } from "../services/api";
import { loginAccount } from "../services/authApi";
const Context = createContext(null);
const storageKey = "wildguard.session";
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setLoading] = useState(true);
  const sessionVersion = useRef(0);
  useEffect(() => {
    let active = true;
    const version = sessionVersion.current;
    const isCurrent = () => active && version === sessionVersion.current;
    const token = sessionStorage.getItem(storageKey);
    if (!token) {
      setLoading(false);
      return;
    }
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
    api
      .get("/auth/me")
      .then(({ data }) => {
        if (isCurrent()) setUser(data.user);
      })
      .catch(() => {
        if (!isCurrent()) return;
        sessionStorage.removeItem(storageKey);
        delete api.defaults.headers.common.Authorization;
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    const id = api.interceptors.response.use(
      (response) => response,
      (error) => {
        const requestAuthorization = error.config?.headers?.get?.("Authorization") ??
          error.config?.headers?.Authorization ?? error.config?.headers?.authorization;
        const currentAuthorization = api.defaults.headers.common.Authorization;
        if (
          (error.response?.status === 401 ||
            error.response?.data?.code === "ACCOUNT_NOT_APPROVED") &&
          (!requestAuthorization || requestAuthorization === currentAuthorization)
        ) {
          logout();
        }
        return Promise.reject(error);
      },
    );
    return () => api.interceptors.response.eject(id);
  }, []);
  async function login(credentials) {
    const version = ++sessionVersion.current;
    const data = await loginAccount(credentials);
    if (version !== sessionVersion.current) return;
    sessionStorage.setItem(storageKey, data.token);
    api.defaults.headers.common.Authorization = `Bearer ${data.token}`;
    setUser(data.user);
    setLoading(false);
  }
  function logout() {
    ++sessionVersion.current;
    sessionStorage.removeItem(storageKey);
    delete api.defaults.headers.common.Authorization;
    setUser(null);
    setLoading(false);
  }
  useEffect(() => {
    if (!user) return;
    // Expiry is only a UI timer; the backend remains the authority on validity.
    let expiry;
    try {
      expiry =
        JSON.parse(
          atob(
            sessionStorage
              .getItem(storageKey)
              .split(".")[1]
              .replaceAll("-", "+")
              .replaceAll("_", "/"),
          ),
        ).exp * 1000;
    } catch {
      return;
    }
    const timer = setTimeout(logout, Math.max(0, expiry - Date.now()));
    return () => clearTimeout(timer);
  }, [user]);
  return (
    <Context.Provider
      value={{ user, isAuthenticated: !!user, isLoading, login, logout }}
    >
      {children}
    </Context.Provider>
  );
}
export const useAuth = () => useContext(Context);
