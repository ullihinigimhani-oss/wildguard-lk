import {
  registerAccount,
  loginAccount,
  getSessionUser,
} from "../../src/services/authApi";
import { api } from "../../src/services/api";
jest.mock("../../src/services/api", () => ({
  api: { post: jest.fn(), get: jest.fn() },
}));
const original = process.env.EXPO_PUBLIC_API_BASE_URL;
beforeEach(() => {
  process.env.EXPO_PUBLIC_API_BASE_URL = "http://192.168.1.10:5000/api";
  api.post.mockReset();
});
afterAll(() => {
  if (original === undefined) delete process.env.EXPO_PUBLIC_API_BASE_URL;
  else process.env.EXPO_PUBLIC_API_BASE_URL = original;
});
const values = {
  name: " Test ",
  email: " TEST@Example.com ",
  phone: " ",
  password: "Test1234",
  role: "RANGER",
  confirmPassword: "Test1234",
  termsAccepted: true,
};
test("normalizes and sends only API fields", async () => {
  api.post.mockResolvedValue({ data: { success: true, user: { id: "1" } } });
  await registerAccount(values);
  expect(api.post).toHaveBeenCalledWith("/auth/register", {
    name: "Test",
    email: "test@example.com",
    phone: undefined,
    password: "Test1234",
    role: "RANGER",
  });
});
test("requires configured URL for physical devices", async () => {
  delete process.env.EXPO_PUBLIC_API_BASE_URL;
  await expect(registerAccount(values)).rejects.toThrow(
    "Public API URL is not configured",
  );
  expect(api.post).not.toHaveBeenCalled();
});
test("rejects unconfirmed response", async () => {
  api.post.mockResolvedValue({ data: { success: false } });
  await expect(registerAccount(values)).rejects.toThrow(
    "Registration was not confirmed",
  );
});
test("common login sends credentials without a role", async () => {
  api.post.mockResolvedValue({
    data: {
      success: true,
      user: { id: "1" },
      token: "token",
      expiresAt: Date.now() + 3600000,
    },
  });
  await loginAccount({ ...values, role: "RANGER" });
  expect(api.post).toHaveBeenCalledWith("/auth/login", {
    email: "test@example.com",
    password: "Test1234",
  });
});
test("session role comes from the authenticated me endpoint", async () => {
  const user = { id: "1", role: "COMMUNITY_USER" };
  api.get.mockResolvedValue({ data: { success: true, user } });
  await expect(getSessionUser("token")).resolves.toEqual(user);
  expect(api.get).toHaveBeenCalledWith("/auth/me", {
    headers: { Authorization: "Bearer token" },
  });
});
test("unknown backend roles fail closed", async () => {
  api.get.mockResolvedValue({
    data: { success: true, user: { id: "1", role: "ADMIN" } },
  });
  await expect(getSessionUser("token")).rejects.toThrow(
    "Account role is not supported",
  );
});
