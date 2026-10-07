import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Users from "../../src/pages/Users/Users";
import { listUsers, reviewUser } from "../../src/services/userApi";
vi.mock("../../src/services/userApi", () => ({
  listUsers: vi.fn(),
  reviewUser: vi.fn(),
}));
const user = {
  id: "ranger",
  name: "Test Ranger",
  email: "ranger@example.test",
  phone: null,
  role: "RANGER",
  approvalStatus: "PENDING",
  createdAt: "2026-10-07T00:00:00Z",
};
beforeEach(() => {
  vi.clearAllMocks();
  listUsers.mockResolvedValue({ users: [user], total: 1 });
  reviewUser.mockResolvedValue({ success: true, notification: { sent: true } });
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
});
test("pending list shows real account details and approval confirmation", async () => {
  const events = userEvent.setup();
  render(<Users />);
  expect((await screen.findAllByText("ranger@example.test"))[0]).toBeVisible();
  await events.click(
    screen.getAllByRole("button", { name: "Approve", exact: true })[0],
  );
  expect(
    screen.getByRole("heading", { name: "Approve this account?" }),
  ).toBeVisible();
  expect(reviewUser).not.toHaveBeenCalled();
  await events.click(screen.getByRole("button", { name: "Approve Account" }));
  await waitFor(() =>
    expect(reviewUser).toHaveBeenCalledWith("ranger", "APPROVED", undefined),
  );
  expect(await screen.findByText(/Notification email submitted/)).toBeVisible();
});
test("reject keeps optional reason and warns on email failure", async () => {
  reviewUser.mockResolvedValue({
    success: true,
    notification: { sent: false },
  });
  const events = userEvent.setup();
  render(<Users />);
  await screen.findAllByText(user.email);
  await events.click(
    screen.getAllByRole("button", { name: "Reject", exact: true })[0],
  );
  await events.type(
    screen.getByLabelText("Reason for rejection"),
    "Not verified",
  );
  await events.click(screen.getByRole("button", { name: "Reject Account" }));
  await waitFor(() =>
    expect(reviewUser).toHaveBeenCalledWith(
      "ranger",
      "REJECTED",
      "Not verified",
    ),
  );
  expect(
    await screen.findByText(/Notification email could not be sent/),
  ).toBeVisible();
});
test("all users exposes search and exact filters; manager has no review buttons", async () => {
  listUsers.mockResolvedValue({
    users: [{ ...user, role: "PARK_MANAGER" }],
    total: 1,
  });
  const events = userEvent.setup();
  render(<Users />);
  await screen.findAllByText(user.email);
  expect(
    screen.queryByRole("button", { name: "Approve", exact: true }),
  ).toBeNull();
  await events.selectOptions(screen.getByLabelText("Role"), "RESEARCHER");
  await events.selectOptions(screen.getByLabelText("Status"), "REJECTED");
  await events.type(
    screen.getAllByLabelText("Search name or email")[1],
    "Jane",
  );
  await waitFor(() =>
    expect(listUsers).toHaveBeenCalledWith({
      pending: false,
      search: "Jane",
      role: "RESEARCHER",
      status: "REJECTED",
      page: 1,
    }),
  );
});
test("failed API shows retry and no fabricated users", async () => {
  listUsers.mockRejectedValue(new Error("offline"));
  render(<Users />);
  expect((await screen.findAllByText(/Unable to load users/))[0]).toBeVisible();
  expect(screen.queryByText(user.email)).toBeNull();
  expect(screen.getAllByRole("button", { name: "Retry" })[0]).toBeVisible();
});
