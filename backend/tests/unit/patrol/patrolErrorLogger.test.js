const log = require("../../../src/utils/patrolErrorLogger");
let previous;
beforeEach(() => { previous = process.env.NODE_ENV; jest.spyOn(console, "error").mockImplementation(() => {}); });
afterEach(() => { process.env.NODE_ENV = previous; jest.restoreAllMocks(); });
const req = { method: "POST", path: "/api/patrols" };
test("development logs the Prisma validation cause without echoed payload or credentials", () => {
  process.env.NODE_ENV = "development";
  log({ name: "PrismaClientValidationError", message: 'email: "private@example.com" password: "secret" Unknown argument `patrolType`.' }, req);
  const output = JSON.stringify(console.error.mock.calls);
  expect(output).toContain("Unknown argument");
  expect(output).toContain("patrolType");
  expect(output).not.toContain("private@example.com");
  expect(output).not.toContain("secret");
});
test("known Prisma errors retain safe code and field metadata", () => {
  process.env.NODE_ENV = "development";
  log({ name: "PrismaClientKnownRequestError", code: "P2003", message: "sensitive database details", meta: { modelName: "Patrol", field_name: "Patrol_rangerId_fkey", connectionString: "private" } }, req);
  expect(console.error).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ code: "P2003", metadata: expect.objectContaining({ field: "Patrol_rangerId_fkey" }) }));
  expect(JSON.stringify(console.error.mock.calls)).not.toContain("private");
});
test.each(["production", "test"])("logging is disabled in %s", environment => {
  process.env.NODE_ENV = environment;
  log(new Error("secret"), req);
  expect(console.error).not.toHaveBeenCalled();
});
