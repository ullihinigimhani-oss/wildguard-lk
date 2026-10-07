import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import AppRoutes from "../../src/routes/AppRoutes";
import { demoUser } from "../../src/constants/demo";

const session = vi.hoisted(() => ({
  user: null,
  isAuthenticated: false,
  enterDemo: vi.fn(),
  leaveDemo: vi.fn(),
}));
vi.mock("../../src/hooks/useAuth", () => ({ useAuth: () => session }));
vi.mock("../../src/services/api", () => ({
  api: { post: vi.fn() },
  getHealth: vi
    .fn()
    .mockResolvedValue({ success: true, database: "connected" }),
}));
beforeEach(() => {
  session.user = null;
  session.isAuthenticated = false;
  window.history.replaceState(null, "", "/");
});
function mount(path = "/") {
  render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>,
  );
  return userEvent.setup();
}

test("public landing renders its hero and informational sections without a session", () => {
  mount();
  expect(
    screen.getByRole("heading", {
      level: 1,
      name: "Protecting Sri Lanka's Wildlife Through Smarter Conservation",
    }),
  ).toBeVisible();
  for (const id of ["about", "features", "conservation", "contact"])
    expect(document.getElementById(id)).toBeInTheDocument();
  expect(
    screen.getAllByRole("link", { name: /Learn more about/ }),
  ).toHaveLength(4);
});
test.each([
  ["Sign In", "Welcome back"],
  ["Sign Up", "Choose Your Role"],
])("%s uses the existing auth route", async (link, heading) => {
  const user = mount();
  await user.click(
    within(
      screen.getByRole("navigation", { name: "Public navigation" }),
    ).getByRole("link", { name: new RegExp(link) }),
  );
  expect(screen.getByRole("heading", { name: heading })).toBeVisible();
});
test("Get Started opens registration", async () => {
  const user = mount();
  await user.click(screen.getByRole("link", { name: /Get Started/ }));
  expect(
    screen.getByRole("heading", { name: "Choose Your Role" }),
  ).toBeVisible();
});
test("Explore Features follows the in-page anchor without authentication", async () => {
  const user = mount();
  await user.click(screen.getByRole("link", { name: /Explore Features/ }));
  await waitFor(() => expect(window.location.hash).toBe("#features"));
  expect(document.getElementById("features")).toBeVisible();
});
test("Learn More opens the matching public conservation story", async () => {
  const user = mount();
  await user.click(
    screen.getByRole("link", { name: /Learn more about Ranger Patrol/ }),
  );
  await waitFor(() => expect(window.location.hash).toBe("#ranger-operations"));
});
test("public mobile menu supports opening and Escape focus restoration", async () => {
  const user = mount();
  await user.click(
    screen.getByRole("button", { name: "Open public navigation" }),
  );
  expect(
    screen.getByRole("button", { name: "Close public navigation" }),
  ).toHaveAttribute("aria-expanded", "true");
  await user.keyboard("{Escape}");
  expect(
    screen.getByRole("button", { name: "Open public navigation" }),
  ).toHaveFocus();
});
test.each(["/dashboard", "/patrols", "/incidents", "/wildlife", "/analytics"])(
  "unauthenticated %s redirects to login",
  (path) => {
    mount(path);
    expect(screen.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  },
);
test("a demo session is not authorization for operations", () => {
  session.user = demoUser;
  mount("/patrols");
  expect(screen.getByRole("heading", { name: "Welcome back" })).toBeVisible();
});
test("authenticated users keep the existing protected navigation", () => {
  session.user = demoUser;
  session.isAuthenticated = true;
  mount("/patrols");
  expect(screen.getByText("COMING SOON")).toBeVisible();
  expect(
    screen.queryByRole("heading", { name: "Choose Your Role" }),
  ).not.toBeInTheDocument();
});
test("authenticated Get Started opens the dashboard without registering again", async () => {
  session.user = demoUser;
  session.isAuthenticated = true;
  const user = mount();
  await user.click(screen.getByRole("link", { name: /Get Started/ }));
  expect(await screen.findByText(/Welcome back,/)).toBeVisible();
  expect(
    screen.getByRole("heading", { name: "Recent Field Activity" }),
  ).toBeVisible();
});
test("authenticated registration route returns to dashboard", async () => {
  session.user = demoUser;
  session.isAuthenticated = true;
  mount("/register");
  expect(await screen.findByText(/Welcome back,/)).toBeVisible();
});
