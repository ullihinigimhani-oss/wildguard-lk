const bcrypt = require("bcryptjs");
const repository = require("../repositories/auth.repository");
const jwt = require("jsonwebtoken");
const unauthorized = () =>
  Object.assign(new Error("Invalid email or password."), {
    status: 401,
    authError: true,
  });
const safeUser = ({
  id,
  name,
  email,
  phone,
  role,
  approvalStatus,
  profileImageUrl,
  parkId,
  park,
  requestedParkId,
  requestedPark,
}) => ({
  id,
  name,
  email,
  phone,
  role,
  approvalStatus,
  profileImageUrl,
  parkId,
  park,
  requestedParkId,
  requestedPark,
});
function requireApproved(user) {
  if (user.approvalStatus === "APPROVED") return;
  const message =
    user.approvalStatus === "PENDING"
      ? "Your account is awaiting approval. Your account must be verified before you can access WildGuard LK."
      : "Your account request was not approved.";
  throw Object.assign(new Error(message), {
    status: 403,
    authError: true,
    code: "ACCOUNT_NOT_APPROVED",
    approvalStatus: user.approvalStatus,
  });
}
function secret() {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)
    throw new Error("JWT_SECRET must contain at least 32 characters");
  return process.env.JWT_SECRET;
}
// A fixed bcrypt hash keeps unknown-account comparisons on the same expensive path.
const dummyHash = bcrypt.hashSync("unused-account-password", 12);
exports.login = async ({ email, password }) => {
  const user = await repository.findForLogin(email);
  const matches = await bcrypt.compare(
    password,
    user?.passwordHash || dummyHash,
  );
  if (!user || !matches || !user.isActive) throw unauthorized();
  requireApproved(user);
  const token = jwt.sign({}, secret(), {
    subject: user.id,
    expiresIn: "1h",
    algorithm: "HS256",
    issuer: "wildguard-lk",
    audience: "wildguard-web",
  });
  return {
    user: safeUser(user),
    token,
    expiresAt: jwt.decode(token).exp * 1000,
  };
};
exports.authenticate = async (token) => {
  const key = secret();
  let payload;
  try {
    payload = jwt.verify(token, key, {
      algorithms: ["HS256"],
      issuer: "wildguard-lk",
      audience: "wildguard-web",
    });
  } catch {
    throw unauthorized();
  }
  if (typeof payload.sub !== "string") throw unauthorized();
  const user = await repository.findSessionUser(payload.sub);
  if (!user?.isActive) throw unauthorized();
  requireApproved(user);
  return safeUser(user);
};
const duplicate = () =>
  Object.assign(new Error("An account with this email already exists."), {
    status: 409,
    registrationError: true,
    fields: { email: "An account with this email already exists." },
  });
exports.register = async ({
  name,
  email,
  phone,
  password,
  role = "COMMUNITY_USER",
  requestedParkId,
}) => {
  if (
    role === "RANGER" &&
    (!requestedParkId || !(await repository.findPark(requestedParkId)))
  )
    throw Object.assign(new Error("Select a valid park or ranger area."), {
      status: 400,
      registrationError: true,
      fields: { requestedParkId: "Select a valid park or ranger area." },
    });
  if (await repository.findByEmail(email)) throw duplicate();
  const passwordHash = await bcrypt.hash(password, 12);
  try {
    const user = await repository.create({
      name,
      email,
      phone,
      passwordHash,
      role,
      approvalStatus: role === "COMMUNITY_USER" ? "APPROVED" : "PENDING",
      ...(role === "RANGER" && { requestedParkId }),
    });
    return safeUser(user);
  } catch (error) {
    if (error.code === "P2002") throw duplicate();
    throw error;
  }
};
