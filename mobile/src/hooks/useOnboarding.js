import React, { createContext, useContext, useEffect, useState } from "react";
import { readOnboardingCompletion, saveOnboardingCompletion } from "../storage/onboardingStorage";
const Context = createContext(null);
export function OnboardingProvider({ children }) {
  const [hasCompletedOnboarding, setCompleted] = useState(false);
  const [isReady, setReady] = useState(false);
  useEffect(() => {
    let active = true;
    readOnboardingCompletion().then(value => { if (active) setCompleted(value); })
      .catch(() => { /* Unavailable storage falls back to the initial introduction. */ })
      .finally(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, []);
  async function completeOnboarding() {
    try { await saveOnboardingCompletion(); }
    catch { console.warn("Onboarding completion could not be saved; keeping it for this app session."); }
    setCompleted(true);
  }
  return <Context.Provider value={{ hasCompletedOnboarding, isReady, completeOnboarding }}>{children}</Context.Provider>;
}
export const useOnboarding = () => useContext(Context);
