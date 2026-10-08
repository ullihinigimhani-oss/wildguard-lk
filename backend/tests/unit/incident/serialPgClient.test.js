const { serialClient } = require("../../../src/config/serialPgClient");
test("a pg connection executes one query at a time, preserving results and callbacks", async () => {
  let finish;
  const native = jest.fn(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const Client = serialClient(
    class {
      query(...args) {
        return native(...args);
      }
    },
  );
  const client = new Client();
  const first = client.query("first");
  const callback = jest.fn();
  client.query("second", callback);
  await Promise.resolve();
  expect(native).toHaveBeenCalledTimes(1);
  finish({ rows: [1] });
  await expect(first).resolves.toEqual({ rows: [1] });
  await new Promise((resolve) => setImmediate(resolve));
  expect(native).toHaveBeenCalledTimes(2);
  finish({ rows: [2] });
  await new Promise((resolve) => setImmediate(resolve));
  expect(callback).toHaveBeenCalledWith(null, { rows: [2] });
});
test("a failed query does not poison the next connection query", async () => {
  const native = jest
    .fn()
    .mockRejectedValueOnce(new Error("failed"))
    .mockResolvedValueOnce({ rows: [] });
  const Client = serialClient(
    class {
      query(...args) {
        return native(...args);
      }
    },
  );
  const client = new Client();
  const first = client.query("first"),
    second = client.query("second");
  await expect(first).rejects.toThrow("failed");
  await expect(second).resolves.toEqual({ rows: [] });
});
