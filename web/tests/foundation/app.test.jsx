import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import App from "../../src/App";
vi.mock("../../src/services/api", () => ({
  getHealth: vi
    .fn()
    .mockResolvedValue({ success: true, database: "connected" }),
}));
function mount(path = "/login") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}
test("login is labeled and validates required fields", async () => {
  mount();
  const user = userEvent.setup();
  expect(screen.getByLabelText("Email address")).toBeInTheDocument();
  expect(screen.getByLabelText("Password", { exact: true })).toHaveAttribute(
    "type",
    "password",
  );
  await user.click(screen.getByRole("button", { name: "Log in" }));
  expect(screen.getByText("Enter a valid email address.")).toBeVisible();
  expect(screen.getByText("Enter your password.")).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Show password" }));
  expect(screen.getByLabelText("Password", { exact: true })).toHaveAttribute(
    "type",
    "text",
  );
});
test("login never creates a session from supplied credentials", async () => {
  mount("/login");
  const user = userEvent.setup();
  await user.type(
    screen.getByLabelText("Email address"),
    "person@example.test",
  );
  await user.type(
    screen.getByLabelText("Password", { exact: true }),
    "sample-only",
  );
  await user.click(screen.getByRole("button", { name: "Log in" }));
  expect(
    await screen.findByText(/Staff sign-in is not available yet/),
  ).toBeVisible();
  expect(screen.getByLabelText("Password", { exact: true })).toHaveValue("");
});
test("explicit demo entry supports the read-only dashboard, profile and logout", async () => {
  mount();
  const user = userEvent.setup();
  await user.click(
    screen.getByRole("button", { name: /Explore demo workspace/ }),
  );
  expect(
    await screen.findByText("API connected", { exact: false }),
  ).toBeVisible();
  expect(
    screen.getByRole("heading", { name: "Recent incidents" }),
  ).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Toggle navigation" }));
  expect(screen.getByRole("button", { name: "Close menu ×" })).toHaveFocus();
  await user.keyboard("{Escape}");
  expect(
    screen.getByRole("button", { name: "Toggle navigation" }),
  ).toHaveFocus();
  await user.click(screen.getByRole("link", { name: /Nimali Perera/ }));
  expect(screen.getByText("manager@example.test")).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Exit demo" }));
  expect(
    screen.getByRole("heading", { name: "Create your account" }),
  ).toBeVisible();
});
test("unknown paths render 404", () => {
  mount("/missing");
  expect(screen.getByRole("heading", { name: "Page not found" })).toBeVisible();
});
