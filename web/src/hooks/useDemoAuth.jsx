import { createContext, useContext, useState } from "react";
import { demoUser } from "../constants/demo";
const Context = createContext(null);
export function DemoAuthProvider({ children }) {
  const [user, setUser] = useState(null);
  // No credentials, tokens, or persistent sessions. Replace with real auth later.
  const enterDemo = () => setUser(demoUser);
  const leaveDemo = () => setUser(null);
  return (
    <Context.Provider value={{ user, enterDemo, leaveDemo }}>
      {children}
    </Context.Provider>
  );
}
export const useDemoAuth = () => useContext(Context);
