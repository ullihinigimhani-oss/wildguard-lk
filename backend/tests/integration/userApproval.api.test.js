const request = require("supertest");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
jest.mock("../../src/config/database", () => ({
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    updateMany: jest.fn(),
  },
  $transaction: jest.fn(),
}));
jest.mock("../../src/services/email.service", () => ({
  sendDecisionEmail: jest.fn(),
}));
const db = require("../../src/config/database");
const mail = require("../../src/services/email.service");
const app = require("../../src/app");
let accounts;
let manager;
let hash;
const token = (id) =>
  jwt.sign({}, process.env.JWT_SECRET, {
    subject: id,
    issuer: "wildguard-lk",
    audience: "wildguard-web",
    expiresIn: "1h",
  });
beforeAll(async () => {
  hash = await bcrypt.hash("Testing123!", 12);
});
beforeEach(() => {
  process.env.JWT_SECRET = "isolated-approval-test-secret-at-least-32";
  manager = {
    id: "manager",
    name: "Existing Manager",
    email: "manager@example.test",
    role: "PARK_MANAGER",
    approvalStatus: "APPROVED",
    isActive: true,
    passwordHash: hash,
  };
  accounts = [
    manager,
    ...[
      "RANGER",
      "COMMUNITY_LIAISON",
      "RESEARCHER",
      "PARK_MANAGER",
      "COMMUNITY_USER",
    ].map((role) => ({
      id: role,
      name: "Test " + role,
      email: role.toLowerCase() + "@example.test",
      phone: null,
      role,
      approvalStatus: role === "COMMUNITY_USER" ? "APPROVED" : "PENDING",
      profileImageUrl: null,
      createdAt: new Date(),
      isActive: true,
      passwordHash: hash,
    })),
  ];
  jest.clearAllMocks();
  db.user.findUnique.mockImplementation(
    async ({ where }) =>
      accounts.find((u) =>
        where.id ? u.id === where.id : u.email === where.email,
      ) || null,
  );
  db.user.updateMany.mockImplementation(async ({ where, data }) => {
    const user = accounts.find(
      (u) =>
        u.id === where.id &&
        u.approvalStatus === where.approvalStatus &&
        where.role.in.includes(u.role),
    );
    if (!user) return { count: 0 };
    Object.assign(user, data);
    return { count: 1 };
  });
  db.$transaction.mockImplementation((fn) => fn(db));
  db.user.findMany.mockResolvedValue([]);
  db.user.count.mockResolvedValue(0);
  mail.sendDecisionEmail.mockResolvedValue({ sent: true });
});
const review = (id, status = "APPROVED", reason) =>
  request(app)
    .patch("/api/users/" + id + "/approval")
    .set("Authorization", "Bearer " + token(manager.id))
    .send({ status, reason });
const login = (user) =>
  request(app)
    .post("/api/auth/login")
    .send({ email: user.email, password: "Testing123!" });
test.each(["RANGER", "COMMUNITY_LIAISON"])(
  "%s pending blocks login; approved allows login and triggers email",
  async (role) => {
    const user = accounts.find((u) => u.id === role);
    const pending = await login(user).expect(403);
    expect(pending.body.token).toBeUndefined();
    expect(pending.body.message).toMatch(/awaiting approval/);
    await review(role).expect(200);
    expect(user.approvalStatus).toBe("APPROVED");
    expect(user.reviewedById).toBe(manager.id);
    expect(mail.sendDecisionEmail).toHaveBeenCalledWith(user);
    await login(user).expect(200);
  },
);
test("researcher rejection stores reason, triggers email and blocks login", async () => {
  const user = accounts.find((u) => u.id === "RESEARCHER");
  await review(user.id, "REJECTED", "Unable to verify affiliation").expect(200);
  expect(user.rejectionReason).toBe("Unable to verify affiliation");
  expect(mail.sendDecisionEmail).toHaveBeenCalledWith(user);
  await login(user).expect(403);
});
test("email adapter failure never rolls back review", async () => {
  mail.sendDecisionEmail.mockRejectedValue(new Error("provider unavailable"));
  const { body } = await review("RANGER").expect(200);
  expect(body.notification.sent).toBe(false);
  expect(accounts.find((u) => u.id === "RANGER").approvalStatus).toBe(
    "APPROVED",
  );
  await login(accounts.find((u) => u.id === "RANGER")).expect(200);
});
test("community and existing manager can sign in", async () => {
  await login(accounts.find((u) => u.id === "COMMUNITY_USER")).expect(200);
  await login(manager).expect(200);
});
test.each(["PARK_MANAGER", "COMMUNITY_USER"])(
  "manager cannot approve %s",
  async (role) => {
    await review(role).expect(403);
    expect(mail.sendDecisionEmail).not.toHaveBeenCalled();
  },
);
test("only pending reviews allowed; repeat causes no second email", async () => {
  await review("RANGER").expect(200);
  await review("RANGER", "REJECTED").expect(409);
  expect(mail.sendDecisionEmail).toHaveBeenCalledTimes(1);
});
test.each(["RANGER", "COMMUNITY_LIAISON", "RESEARCHER", "COMMUNITY_USER"])(
  "%s cannot access user management",
  async (role) => {
    const user = accounts.find((u) => u.id === role);
    user.approvalStatus = "APPROVED";
    await request(app)
      .get("/api/users")
      .set("Authorization", "Bearer " + token(user.id))
      .expect(403);
    await request(app)
      .patch("/api/users/RANGER/approval")
      .set("Authorization", "Bearer " + token(user.id))
      .send({ status: "APPROVED" })
      .expect(403);
    expect(db.user.updateMany).not.toHaveBeenCalled();
  },
);
test("unauthenticated access denied", async () => {
  await request(app).get("/api/users").expect(401);
  await request(app)
    .patch("/api/users/RANGER/approval")
    .send({ status: "APPROVED" })
    .expect(401);
});
test("session reads current approval and role from database", async () => {
  const saved = token(manager.id);
  manager.approvalStatus = "PENDING";
  await request(app)
    .get("/api/users")
    .set("Authorization", "Bearer " + saved)
    .expect(403);
  manager.approvalStatus = "APPROVED";
  manager.role = "RANGER";
  await request(app)
    .get("/api/users")
    .set("Authorization", "Bearer " + saved)
    .expect(403);
});
test("pending list is restricted, paginated and safe", async () => {
  await request(app)
    .get("/api/users/pending?search=Test&page=2")
    .set("Authorization", "Bearer " + token(manager.id))
    .expect(200);
  const options = db.user.findMany.mock.calls[0][0];
  expect(options.where.role.in).toEqual([
    "RANGER",
    "COMMUNITY_LIAISON",
    "RESEARCHER",
  ]);
  expect(options.where.approvalStatus).toBe("PENDING");
  expect(options.skip).toBe(25);
  expect(options.select.passwordHash).toBeUndefined();
  expect(options.select.isActive).toBeUndefined();
});
test("all users supports exact role and status filters", async () => {
  await request(app)
    .get("/api/users?role=PARK_MANAGER&status=PENDING")
    .set("Authorization", "Bearer " + token(manager.id))
    .expect(200);
  expect(db.user.findMany.mock.calls[0][0].where).toEqual({
    role: "PARK_MANAGER",
    approvalStatus: "PENDING",
  });
});
test.each([
  { status: "PENDING" },
  { status: "APPROVED", reason: 42 },
  { status: "REJECTED", reason: "x".repeat(1001) },
])("invalid decision rejected", async (body) => {
  await request(app)
    .patch("/api/users/RANGER/approval")
    .set("Authorization", "Bearer " + token(manager.id))
    .send(body)
    .expect(400);
  expect(db.user.updateMany).not.toHaveBeenCalled();
});
test("missing account returns 404", async () => {
  await review("missing").expect(404);
});

test.each(["RANGER", "COMMUNITY_LIAISON", "RESEARCHER", "COMMUNITY_USER"])(
  "complete registration and review flow for %s",
  async (role) => {
    db.user.create.mockImplementation(async ({ data }) => {
      const user = {
        id: "new-user",
        ...data,
        isActive: true,
        createdAt: new Date(),
        profileImageUrl: null,
      };
      accounts.push(user);
      return user;
    });
    const { body } = await request(app)
      .post("/api/auth/register")
      .send({
        name: "New Applicant",
        email: "new-applicant@example.test",
        password: "Testing123!",
        role,
        approvalStatus: "APPROVED",
      })
      .expect(201);
    const user = accounts.find((u) => u.id === body.user.id);
    expect(user.profileImageUrl).toBeNull();
    if (role === "COMMUNITY_USER") {
      expect(user.approvalStatus).toBe("APPROVED");
      await login(user).expect(200);
      return;
    }
    expect(user.approvalStatus).toBe("PENDING");
    await login(user).expect(403);
    db.user.findMany.mockResolvedValue([
      {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        approvalStatus: user.approvalStatus,
      },
    ]);
    const pending = await request(app)
      .get("/api/users/pending")
      .set("Authorization", "Bearer " + token(manager.id))
      .expect(200);
    expect(pending.body.users[0].id).toBe(user.id);
    const rejected = role === "RESEARCHER";
    await review(
      user.id,
      rejected ? "REJECTED" : "APPROVED",
      rejected ? "Affiliation not verified" : undefined,
    ).expect(200);
    expect(mail.sendDecisionEmail).toHaveBeenCalledWith(user);
    await login(user).expect(rejected ? 403 : 200);
  },
);
