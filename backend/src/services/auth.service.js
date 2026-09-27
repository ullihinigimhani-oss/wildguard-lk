const bcrypt = require('bcryptjs');
const repository = require('../repositories/auth.repository');
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
