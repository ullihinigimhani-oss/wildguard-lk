# Registration API

POST /api/auth/register accepts JSON: name, email, optional phone, password.
Example: { "name": "Test User", "email": "test@example.com", "phone": "0771234567", "password": "Test1234" }.

Both clients use the same Express API. Configure VITE_API_BASE_URL and EXPO_PUBLIC_API_BASE_URL including the /api suffix. Never configure database credentials in clients.

201: { success: true, message: "Account created successfully", user: { id, name, email, phone, role: "COMMUNITY_USER" } }.
400: { success: false, message: "Please check your details.", errors: { field: "Validation message" } }.
409: { success: false, message: "An account with this email already exists.", errors: { email: "An account with this email already exists." } }.
500: { success: false, message: "Internal server error" }.
Malformed JSON uses the existing safe 400 response.

Name is trimmed and required (maximum 120 characters). Email is trimmed, lowercased and validated (maximum 254 characters). Optional phone is trimmed, accepts international + prefix, digits, spaces, parentheses and hyphens (7–25 characters). Empty phone becomes null.
Passwords require at least eight characters, uppercase, lowercase and a digit. Maximum length is 72 UTF-8 bytes to avoid bcrypt truncation. Passwords are hashed server-side with bcrypt cost 12; never returned or logged.

Public registration always assigns COMMUNITY_USER. Role, parkId, isActive and other unrecognized fields are excluded from persistence. All existing staff enum values remain unchanged. Duplicate checks are backed by the existing unique email constraint, including concurrent creation conflicts.
Confirm password and Terms & Privacy acceptance are client validation only and are not persisted. Both clients show the prototype terms/privacy notice inline. Success redirects to Login with account-created feedback; login authentication remains outside this feature.

GET /api/health remains unchanged.

## Development database verification

From backend: node scripts/verify-registration.js

This opt-in command uses the configured development database, creates a uniquely named temporary user through the HTTP handler and complete Prisma flow, verifies hashing/normalization/role/safe output/duplicates and health, then deletes only its own generated account. It never prints credentials or password hashes. Do not run against a production database.
