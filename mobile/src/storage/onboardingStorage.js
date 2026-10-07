import { File, Paths } from "expo-file-system";
const file = () => new File(Paths.document, "wildguard-onboarding-v1.txt");
export async function readOnboardingCompletion() {
  const saved = file();
  return saved.exists && (await saved.text()) === "true";
}
export async function saveOnboardingCompletion() {
  const saved = file();
  if (!saved.exists) saved.create();
  saved.write("true");
}
