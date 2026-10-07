const {
  buildDecisionEmail,
  sendDecisionEmail,
} = require("../../../src/services/email.service");
const user = {
  name: "Test Ranger",
  email: "registered@example.test",
  role: "RANGER",
  approvalStatus: "APPROVED",
};
const originalFetch = global.fetch;
afterEach(() => {
  delete process.env.RESEND_API_KEY;
  delete process.env.EMAIL_FROM;
  global.fetch = originalFetch;
  jest.restoreAllMocks();
});
test("approval uses registered email, friendly role, exact subject and no credentials", () => {
  const mail = buildDecisionEmail(user);
  expect(mail.to).toBe(user.email);
  expect(mail.subject).toBe("Your WildGuard LK Account Has Been Approved");
  expect(mail.text).toContain("Park Ranger");
  expect(mail.text).toContain("password you provided during registration");
  expect(mail).not.toHaveProperty("password");
});
test("rejection includes optional reason only when present", () => {
  const rejected = { ...user, approvalStatus: "REJECTED" };
  expect(buildDecisionEmail(rejected).text).not.toContain("Reason:");
  expect(
    buildDecisionEmail({ ...rejected, rejectionReason: "Not verified" }).text,
  ).toContain("Reason:\nNot verified");
  expect(buildDecisionEmail(rejected).subject).toBe(
    "Update on Your WildGuard LK Account",
  );
});
test("unconfigured provider reports warning without network", async () => {
  global.fetch = jest.fn();
  expect(await sendDecisionEmail(user)).toEqual({
    sent: false,
    reason: "not_configured",
  });
  expect(global.fetch).not.toHaveBeenCalled();
});
test("configured adapter submits notification", async () => {
  process.env.RESEND_API_KEY = "isolated-test-key";
  process.env.EMAIL_FROM = "WildGuard LK <no-reply@example.test>";
  global.fetch = jest.fn().mockResolvedValue({ ok: true });
  expect(await sendDecisionEmail(user)).toEqual({ sent: true });
  const request = JSON.parse(global.fetch.mock.calls[0][1].body);
  expect(request.to).toEqual([user.email]);
  expect(request.subject).toBe(buildDecisionEmail(user).subject);
});
test("provider failure is isolated", async () => {
  process.env.RESEND_API_KEY = "isolated-test-key";
  process.env.EMAIL_FROM = "test@example.test";
  jest.spyOn(console, "warn").mockImplementation(() => {});
  global.fetch = jest.fn().mockResolvedValue({ ok: false });
  expect(await sendDecisionEmail(user)).toEqual({
    sent: false,
    reason: "delivery_failed",
  });
});
