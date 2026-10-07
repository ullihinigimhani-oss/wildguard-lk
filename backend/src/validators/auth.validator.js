function validateRegistration(body) {
  const input =
    body && typeof body === "object" && !Array.isArray(body) ? body : {};
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const email =
    typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
  const password = input.password;
  const phone = typeof input.phone === "string" ? input.phone.trim() : null;
  const fields = {};
  const role = input.role === undefined ? "COMMUNITY_USER" : input.role;
  if (
    !["RANGER", "COMMUNITY_LIAISON", "RESEARCHER", "COMMUNITY_USER"].includes(
      role,
    )
  )
    fields.role = "Select a valid role.";
  if (!name || name.length > 120)
    fields.name = "Enter your full name (up to 120 characters).";
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    fields.email = "Enter a valid email address.";
  if (
    typeof password !== "string" ||
    password.length < 8 ||
    Buffer.byteLength(password, "utf8") > 72 ||
    !/[A-Z]/.test(password) ||
    !/[a-z]/.test(password) ||
    !/[0-9]/.test(password)
  )
    fields.password =
      "Use at least 8 characters with uppercase, lowercase and a number; maximum 72 UTF-8 bytes.";
  if (
    (input.phone != null && typeof input.phone !== "string") ||
    (phone && !/^\+?[0-9 ()-]{7,25}$/.test(phone))
  )
    fields.phone = "Enter a valid phone number.";
  if (Object.keys(fields).length)
    throw Object.assign(new Error("Please check your details."), {
      status: 400,
      registrationError: true,
      fields,
    });
  return { name, email, password, phone: phone || null, role };
}
function validateLogin(body) {
  const email =
    typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = body?.password;
  if (
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    typeof password !== "string" ||
    !password ||
    Buffer.byteLength(password, "utf8") > 72
  ) {
    throw Object.assign(
      new Error("Enter a valid email address and password."),
      { status: 400, authError: true },
    );
  }
  return { email, password };
}
module.exports = { validateRegistration, validateLogin };
