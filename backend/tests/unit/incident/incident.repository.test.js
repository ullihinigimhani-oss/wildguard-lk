jest.mock("../../../src/config/database", () => ({ $transaction: jest.fn() }));
const database = require("../../../src/config/database");
const repository = require("../../../src/repositories/incident.repository");
test("incident listing serializes the two queries on its single transaction client", async () => {
  let finish;
  const tx = {
    incident: {
      findMany: jest.fn(
        () =>
          new Promise((resolve) => {
            finish = resolve;
          }),
      ),
      count: jest.fn(async () => 1),
    },
  };
  database.$transaction.mockImplementation((callback) => callback(tx));
  const pending = repository.listIncidents({ reporterId: "r" }, 1);
  expect(tx.incident.findMany).toHaveBeenCalledTimes(1);
  expect(tx.incident.count).not.toHaveBeenCalled();
  finish([{ id: "i" }]);
  await expect(pending).resolves.toEqual({
    incidents: [{ id: "i" }],
    total: 1,
    page: 1,
    pageSize: 25,
  });
  expect(database.$transaction).toHaveBeenCalledWith(expect.any(Function), {
    isolationLevel: "RepeatableRead",
  });
});
