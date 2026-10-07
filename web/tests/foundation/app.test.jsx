import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import App from "../../src/App";
import { api } from "../../src/services/api";
vi.mock("../../src/services/api", () => ({
  api: {
    post: vi.fn(),
    get: vi.fn(),
    defaults: { headers: { common: {} } },
    interceptors: { response: { use: vi.fn(), eject: vi.fn() } },
  },
}));
const profile = {
  id: "1",
  name: "Test Ranger",
  email: "test@example.test",
  role: "RANGER",
};
beforeEach(() => {
  sessionStorage.clear();
  vi.clearAllMocks();
  api.get.mockResolvedValue({ data: { success: true, user: profile } });
  api.post.mockResolvedValue({
    data: { success: true, user: profile, token: "session-token" },
  });
});
function mount(path = "/login") {
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
  return userEvent.setup();
}
async function submit(user) {
  await user.type(screen.getByLabelText("Email address"), "test@example.test");
  await user.type(
    screen.getByLabelText("Password", { exact: true }),
    "Testing123!",
  );
  await user.click(screen.getByRole("button", { name: "Log in" }));
}
test("login validates required fields and toggles password visibility", async () => {
  const user = mount();
  await user.click(screen.getByRole("button", { name: "Log in" }));
  expect(screen.getByText("Enter your password.")).toBeVisible();
  expect(api.post).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Show password" }));
  expect(screen.getByLabelText("Password", { exact: true })).toHaveAttribute(
    "type",
    "text",
  );
});
test("invalid credentials remain on login", async () => {
  api.post.mockRejectedValue({ response: { status: 401 } });
  const user = mount();
  await submit(user);
  expect(await screen.findByText("Invalid email or password.")).toBeVisible();
  expect(sessionStorage.length).toBe(0);
});
test("network failure is recoverable", async () => {
  api.post.mockRejectedValue(new Error("network"));
  const user = mount();
  await submit(user);
  expect(await screen.findByText(/check your connection/)).toBeVisible();
  expect(screen.getByRole("button", { name: "Log in" })).toBeEnabled();
});
test("successful login opens personalized dashboard, profile and logout", async () => {
  const user = mount();
  await submit(user);
  expect(await screen.findByText("Welcome back, Test Ranger")).toBeVisible();
  expect(sessionStorage.getItem("wildguard.session")).toBe("session-token");
  await user.click(screen.getByRole("link", { name: "Profile: Test Ranger" }));
  expect(screen.getByText(profile.email, { selector: "dd" })).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Logout" }));
  expect(
    await screen.findByRole("heading", { name: "Welcome back" }),
  ).toBeVisible();
  expect(sessionStorage.length).toBe(0);
  expect(api.defaults.headers.common.Authorization).toBeUndefined();
});
test.each(["/dashboard", "/patrols", "/incidents", "/profile", "/map"])(
  "protects %s",
  async (path) => {
    mount(path);
    expect(
      await screen.findByRole("heading", { name: "Welcome back" }),
    ).toBeVisible();
  },
);
test("refresh waits for server session verification", async () => {
  sessionStorage.setItem("wildguard.session", "saved-token");
  let resolve;
  api.get.mockReturnValue(new Promise((r) => (resolve = r)));
  mount("/dashboard");
  expect(screen.getByText("Restoring your session…")).toBeVisible();
  expect(screen.queryByText("Welcome back, Test Ranger")).toBeNull();
  resolve({ data: { user: profile } });
  expect(await screen.findByText("Welcome back, Test Ranger")).toBeVisible();
  expect(api.get).toHaveBeenCalledWith("/auth/me");
});
test("invalid saved session returns to login", async () => {
  sessionStorage.setItem("wildguard.session", "expired");
  api.get.mockRejectedValue({ response: { status: 401 } });
  mount("/dashboard");
  expect(
    await screen.findByRole("heading", { name: "Welcome back" }),
  ).toBeVisible();
  expect(sessionStorage.length).toBe(0);
});
test("submitting disables duplicate submissions", async () => {
  let resolve;
  api.post.mockReturnValue(new Promise((r) => (resolve = r)));
  const user = mount();
  await submit(user);
  expect(screen.getByRole("button", { name: "Logging in..." })).toBeDisabled();
  expect(api.post).toHaveBeenCalledTimes(1);
  resolve({ data: { success: true, user: profile, token: "session-token" } });
  await screen.findByText("Welcome back, Test Ranger");
});
test("unknown page remains a 404", () => {
  mount("/missing");
  expect(screen.getByRole("heading", { name: "Page not found" })).toBeVisible();
});

test("pending account message is displayed without a session", async () => {
  api.post.mockRejectedValue({
    response: {
      status: 403,
      data: {
        message:
          "Your account is awaiting approval. Your account must be verified before you can access WildGuard LK.",
        code: "ACCOUNT_NOT_APPROVED",
        approvalStatus: "PENDING",
      },
    },
  });
  const user = mount();
  await submit(user);
  expect(await screen.findByText("Account Pending Approval")).toBeVisible();
  expect(sessionStorage.length).toBe(0);
});
test("ranger cannot open manager users route", async () => {
  sessionStorage.setItem("wildguard.session", "saved-token");
  mount("/users");
  expect(
    await screen.findByText(profile.email, { selector: "dd" }),
  ).toBeVisible();
  expect(
    screen.queryByRole("heading", { name: "Pending Approvals" }),
  ).toBeNull();
});

test("approved manager /users renders inside existing dashboard layout", async () => {
  sessionStorage.setItem("wildguard.session", "saved-token");
  const manager = {
    ...profile,
    role: "PARK_MANAGER",
    approvalStatus: "APPROVED",
  };
  api.get.mockImplementation(async (path) => ({
    data: path === "/auth/me" ? { user: manager } : { users: [], total: 0 },
  }));
  mount("/users");
  expect(
    await screen.findByRole("heading", { name: "Pending Approvals" }),
  ).toBeVisible();
  expect(screen.getByRole("heading", { name: "All Users" })).toBeVisible();
  expect(
    screen.getByRole("link", { name: "Profile: Test Ranger" }),
  ).toBeVisible();
  expect(screen.getByText("Park Manager", { selector: "small" })).toBeVisible();
  expect(screen.queryByText("COMING SOON")).toBeNull();
  expect(await screen.findAllByText("No matching users.")).toHaveLength(2);
});

test("rejected account shows backend rejection message without a session", async () => {
  api.post.mockRejectedValue({
    response: {
      status: 403,
      data: {
        message: "Your account request was not approved.",
        code: "ACCOUNT_NOT_APPROVED",
        approvalStatus: "REJECTED",
      },
    },
  });
  const user = mount();
  await submit(user);
  expect(await screen.findByText("Account Not Approved")).toBeVisible();
  expect(sessionStorage.length).toBe(0);
});

test("a new failed login clears the previous approval notice and preserves credential errors", async () => {
  api.post
    .mockRejectedValueOnce({
      response: {
        status: 403,
        data: { code: "ACCOUNT_NOT_APPROVED", approvalStatus: "PENDING" },
      },
    })
    .mockRejectedValueOnce({ response: { status: 401 } });
  const user = mount();
  await submit(user);
  await screen.findByText("Account Pending Approval");
  await user.type(
    screen.getByLabelText("Password", { exact: true }),
    "Testing123!",
  );
  await user.click(screen.getByRole("button", { name: "Log in" }));
  expect(await screen.findByText("Invalid email or password.")).toBeVisible();
  expect(screen.queryByText("Account Pending Approval")).toBeNull();
});

test("an authenticated non-manager cannot open patrol management", async () => {
  sessionStorage.setItem("wildguard.session", "saved-token");
  mount("/patrols");
  expect(await screen.findByRole("heading", { name: "Test Ranger" })).toBeVisible();
  expect(
    screen.queryByRole("heading", { name: "Patrol Management" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("heading", { name: "Create Patrol" }),
  ).not.toBeInTheDocument();
});
