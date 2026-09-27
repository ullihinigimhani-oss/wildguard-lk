import React, { createContext, useContext, useState } from "react";
import { demoRanger } from "../constants/demo";
const Context = createContext(null);
export function DemoAuthProvider({ children }) {
  const [user, setUser] = useState(null);
  return (
    <Context.Provider
      value={{
        user,
        enterDemo: () => setUser(demoRanger),
        leaveDemo: () => setUser(null),
      }}
    >
      {children}
    </Context.Provider>
  );
}
export const useDemoAuth = () => useContext(Context);
