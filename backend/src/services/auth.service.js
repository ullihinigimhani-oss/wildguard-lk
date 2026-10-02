const bcrypt = require('bcryptjs');
const repository = require('../repositories/auth.repository');
const jwt = require('jsonwebtoken');
const unauthorized = () => Object.assign(new Error('Invalid email or password.'), { status: 401, authError: true });
const safeUser = ({ id, name, email, phone, role }) => ({ id, name, email, phone, role });
function secret() {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) throw new Error('JWT_SECRET must contain at least 32 characters');
  return process.env.JWT_SECRET;
}
// A fixed bcrypt hash keeps unknown-account comparisons on the same expensive path.
const dummyHash = bcrypt.hashSync('unused-account-password', 12);
exports.login = async ({ email, password }) => {
  const user = await repository.findForLogin(email);
  const matches = await bcrypt.compare(password, user?.passwordHash || dummyHash);
  if (!user || !matches || !user.isActive) throw unauthorized();
  const token = jwt.sign({}, secret(), { subject: user.id, expiresIn: '1h', algorithm: 'HS256', issuer: 'wildguard-lk', audience: 'wildguard-web' });
  return { user: safeUser(user), token, expiresAt: jwt.decode(token).exp * 1000 };
};
exports.authenticate = async token => {
  const key = secret();
  let payload;
  try { payload = jwt.verify(token, key, { algorithms: ['HS256'], issuer: 'wildguard-lk', audience: 'wildguard-web' }); }
  catch { throw unauthorized(); }
  if (typeof payload.sub !== 'string') throw unauthorized();
  const user = await repository.findSessionUser(payload.sub);
  if (!user?.isActive) throw unauthorized();
  return safeUser(user);
};
const duplicate = () => Object.assign(new Error('An account with this email already exists.'), {
  status: 409, registrationError: true, fields: { email: 'An account with this email already exists.' },
});
exports.register = async ({ name, email, phone, password }) => {
  if (await repository.findByEmail(email)) throw duplicate();
  const passwordHash = await bcrypt.hash(password, 12);
  try {
    const user = await repository.create({ name, email, phone, passwordHash, role: 'COMMUNITY_USER' });
    return { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role };
  } catch (error) {
    if (error.code === 'P2002') throw duplicate();
    throw error;
  }
};
