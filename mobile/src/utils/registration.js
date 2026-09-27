export const passwordHelp = "At least 8 characters, with uppercase, lowercase and a number. Maximum 72 UTF-8 bytes.";
export function validateRegistration(values) {
  const errors = {};
  if (!values.name.trim() || values.name.trim().length > 120) errors.name = "Enter your full name (up to 120 characters).";
  if (values.email.trim().length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) errors.email = "Enter a valid email address.";
  const bytes = Array.from(values.password).reduce((n,c) => n + (c.codePointAt(0) <= 127 ? 1 : c.codePointAt(0) <= 2047 ? 2 : c.codePointAt(0) <= 65535 ? 3 : 4), 0);
  if (values.password.length < 8 || bytes > 72 || !/[A-Z]/.test(values.password) || !/[a-z]/.test(values.password) || !/[0-9]/.test(values.password)) errors.password = "Choose a password that meets all requirements.";
  if (!values.confirmPassword || values.confirmPassword !== values.password) errors.confirmPassword = "Passwords must match.";
  if (values.phone.trim() && !/^\+?[0-9 ()-]{7,25}$/.test(values.phone.trim())) errors.phone = "Enter a valid phone number.";
  if (!values.termsAccepted) errors.termsAccepted = "Accept the Terms & Privacy to continue.";
  return errors;
}
export const initialRegistration = { name: "", email: "", phone: "", password: "", confirmPassword: "", termsAccepted: false };
