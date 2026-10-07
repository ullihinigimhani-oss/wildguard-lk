const key = "wildguard.onboarding.completed.v1";
export async function readOnboardingCompletion() {
  return typeof window !== "undefined" && window.localStorage.getItem(key) === "true";
}
export async function saveOnboardingCompletion() {
  window.localStorage.setItem(key, "true");
}
