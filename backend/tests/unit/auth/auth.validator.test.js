const { validateRegistration: register, validateLogin: login } = require('../../../src/validators/auth.validator');
const valid = () => ({ name: ' Ranger ', email: ' USER@EXAMPLE.TEST ', password: 'Strong123' });
function field(input, key) { try { register(input); throw new Error('accepted invalid registration'); } catch (e) { expect(e).toMatchObject({ status: 400, registrationError: true, fields: { [key]: expect.any(String) } }); } }
test('B5-AUTH-01 normalization and default public role exclude client-owned fields', () => {
  expect(register({ ...valid(), id: 'injected', approvalStatus: 'APPROVED' })).toEqual({ name: 'Ranger', email: 'user@example.test', password: 'Strong123', phone: null, role: 'COMMUNITY_USER', requestedParkId: null });
});
test('B5-AUTH-02 exact 120-character name and 72-byte password accepted', () => { expect(register({ ...valid(), name: 'n'.repeat(120), password: 'Aa1' + 'é'.repeat(34) + 'x' }).name).toHaveLength(120); });
test('B5-AUTH-03 multibyte password above 72 bytes rejected', () => field({ ...valid(), password: 'Aa1' + 'é'.repeat(35) }, 'password'));
test('B5-AUTH-04 121-character name rejected', () => field({ ...valid(), name: 'n'.repeat(121) }, 'name'));
test('B5-AUTH-05 self-registration cannot assign PARK_MANAGER', () => field({ ...valid(), role: 'PARK_MANAGER' }, 'role'));
test('B5-AUTH-06 ranger park identifier accepts exact 128-character boundary', () => expect(register({ ...valid(), role: 'RANGER', requestedParkId: 'p'.repeat(128) }).requestedParkId).toHaveLength(128));
test('B5-AUTH-07 ranger park identifier rejects 129 characters', () => field({ ...valid(), role: 'RANGER', requestedParkId: 'p'.repeat(129) }, 'requestedParkId'));
test('B5-AUTH-08 non-ranger registration discards requested park', () => expect(register({ ...valid(), requestedParkId: 'other-park' }).requestedParkId).toBeNull());
test('B5-AUTH-09 numeric phone rejected without coercion', () => field({ ...valid(), phone: 123456789 }, 'phone'));
test('B5-AUTH-10 login accepts existing short passwords without registration complexity', () => expect(login({ email: ' USER@EXAMPLE.TEST ', password: 'x' })).toEqual({ email: 'user@example.test', password: 'x' }));
test('B5-AUTH-11 login preserves password whitespace', () => expect(login({ email: 'user@example.test', password: ' x ' }).password).toBe(' x '));
test('B5-AUTH-12 login rejects multibyte passwords exceeding bcrypt byte limit', () => expect(() => login({ email: 'user@example.test', password: 'é'.repeat(37) })).toThrow('Enter a valid'));
