import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import Register from "../../src/pages/Register/Register";
import RegistrationPhoto from "../../src/components/common/RegistrationPhoto";
test("role selection is required, single choice, and editable", async () => {
  const user = userEvent.setup();
  render(
    <MemoryRouter>
      <Register />
    </MemoryRouter>,
  );
  expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
  await user.click(screen.getByRole("button", { name: /Park Ranger/ }));
  await user.click(screen.getByRole("button", { name: /Wildlife Researcher/ }));
  expect(screen.getByRole("button", { name: /Park Ranger/ })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await user.click(screen.getByRole("button", { name: "Continue" }));
  expect(screen.getByText("Wildlife Researcher")).toBeVisible();
  expect(screen.getByText(/Staff accounts require verification/)).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Change role" }));
  expect(
    screen.getByRole("heading", { name: "Choose Your Role" }),
  ).toBeVisible();
});
test("photo preview is optional, changeable, removable and explicitly not persisted", async () => {
  URL.createObjectURL = vi.fn(() => "blob:test-photo");
  URL.revokeObjectURL = vi.fn();
  const user = userEvent.setup();
  const ui = render(<RegistrationPhoto />);
  const input = ui.container.querySelector("input[type=file]");
  await user.upload(
    input,
    new File(["photo"], "photo.png", { type: "image/png" }),
  );
  expect(screen.getByAltText("Selected profile preview")).toBeVisible();
  expect(screen.getByRole("button", { name: "Change Photo" })).toBeVisible();
  expect(screen.getByText(/will not be saved/)).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Remove Photo" }));
  expect(screen.queryByAltText("Selected profile preview")).toBeNull();
  expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:test-photo");
});

test("public registration offers only the four public roles", () => {
  render(
    <MemoryRouter>
      <Register />
    </MemoryRouter>,
  );
  expect(screen.queryByRole("button", { name: /Park Manager/ })).toBeNull();
  for (const name of [
    "Park Ranger",
    "Community Liaison",
    "Wildlife Researcher",
    "Community Member",
  ])
    expect(
      screen.getByRole("button", { name: new RegExp(name) }),
    ).toBeVisible();
});
