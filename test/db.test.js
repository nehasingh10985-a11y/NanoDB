const fs = require("fs");
const NanoDB = require("../src/engine/db");

const TEST_DB_PATH = "./data/test-engine-db.dat";
const TEST_WAL_PATH = "./data/test-engine-wal.log";

function cleanup() {
  [TEST_DB_PATH, TEST_WAL_PATH].forEach((p) => {
    if (fs.existsSync(p)) fs.unlinkSync(p);
  });
}

describe("NanoDB Engine", () => {
  beforeEach(cleanup);
  afterEach(cleanup);

  test("should put and get a value", () => {
    const db = new NanoDB(TEST_DB_PATH, TEST_WAL_PATH);
    db.open();

    db.put("name", "NanoDB");
    expect(db.get("name")).toBe("NanoDB");

    db.close();
  });

  test("should return null for missing key", () => {
    const db = new NanoDB(TEST_DB_PATH, TEST_WAL_PATH);
    db.open();

    expect(db.get("doesNotExist")).toBe(null);

    db.close();
  });

  test("should update value for existing key", () => {
    const db = new NanoDB(TEST_DB_PATH, TEST_WAL_PATH);
    db.open();

    db.put("counter", 1);
    db.put("counter", 2);

    expect(db.get("counter")).toBe(2);

    db.close();
  });

  test("should persist data across restarts (close + reopen)", () => {
    const db1 = new NanoDB(TEST_DB_PATH, TEST_WAL_PATH);
    db1.open();
    db1.put("user_1", { name: "Aman", age: 25 });
    db1.close();

    // Simulate a fresh restart with a brand new instance
    const db2 = new NanoDB(TEST_DB_PATH, TEST_WAL_PATH);
    db2.open();

    expect(db2.get("user_1")).toEqual({ name: "Aman", age: 25 });

    db2.close();
  });

  test("should handle many key-value pairs correctly", () => {
    const db = new NanoDB(TEST_DB_PATH, TEST_WAL_PATH);
    db.open();

    for (let i = 0; i < 30; i++) {
      db.put(`key_${i}`, `value_${i}`);
    }

    for (let i = 0; i < 30; i++) {
      expect(db.get(`key_${i}`)).toBe(`value_${i}`);
    }

    db.close();
  });

  test("should rebuild index correctly after restart with many keys", () => {
    const db1 = new NanoDB(TEST_DB_PATH, TEST_WAL_PATH);
    db1.open();

    for (let i = 0; i < 20; i++) {
      db1.put(`item_${i}`, i * 10);
    }
    db1.close();

    const db2 = new NanoDB(TEST_DB_PATH, TEST_WAL_PATH);
    db2.open();

    for (let i = 0; i < 20; i++) {
      expect(db2.get(`item_${i}`)).toBe(i * 10);
    }

    db2.close();
  });
  test("should delete a key successfully", () => {
    const db = new NanoDB(TEST_DB_PATH, TEST_WAL_PATH);
    db.open();

    db.put("temp", "will be deleted");
    expect(db.get("temp")).toBe("will be deleted");

    const deleted = db.delete("temp");
    expect(deleted).toBe(true);
    expect(db.get("temp")).toBe(null);

    db.close();
  });

  test("should return false when deleting a non-existent key", () => {
    const db = new NanoDB(TEST_DB_PATH, TEST_WAL_PATH);
    db.open();

    const deleted = db.delete("neverExisted");
    expect(deleted).toBe(false);

    db.close();
  });

  test("should keep deleted key deleted after restart (tombstone persists)", () => {
    const db1 = new NanoDB(TEST_DB_PATH, TEST_WAL_PATH);
    db1.open();

    db1.put("keepMe", "alive");
    db1.put("deleteMe", "temporary");
    db1.delete("deleteMe");

    db1.close();

    // Fresh restart
    const db2 = new NanoDB(TEST_DB_PATH, TEST_WAL_PATH);
    db2.open();

    expect(db2.get("keepMe")).toBe("alive"); // untouched key still there
    expect(db2.get("deleteMe")).toBe(null); // deleted key stays deleted

    db2.close();
  });

  test("should allow re-inserting a key after it was deleted", () => {
    const db = new NanoDB(TEST_DB_PATH, TEST_WAL_PATH);
    db.open();

    db.put("reused", "first value");
    db.delete("reused");
    expect(db.get("reused")).toBe(null);

    db.put("reused", "second value");
    expect(db.get("reused")).toBe("second value");

    db.close();
  });

  test("should return all keys within a range", () => {
    const db = new NanoDB(TEST_DB_PATH, TEST_WAL_PATH);
    db.open();

    for (let i = 1; i <= 10; i++) {
      db.put(i, `value-${i}`);
    }

    const results = db.range(3, 7);
    const keys = results.map((r) => r.key);

    expect(keys).toEqual([3, 4, 5, 6, 7]);

    db.close();
  });

  test("should return empty array if no keys are in range", () => {
    const db = new NanoDB(TEST_DB_PATH, TEST_WAL_PATH);
    db.open();

    db.put(1, "a");
    db.put(2, "b");
    db.put(3, "c");

    const results = db.range(100, 200);
    expect(results).toEqual([]);

    db.close();
  });

  test("should exclude deleted keys from range results", () => {
    const db = new NanoDB(TEST_DB_PATH, TEST_WAL_PATH);
    db.open();

    for (let i = 1; i <= 5; i++) {
      db.put(i, `value-${i}`);
    }

    db.delete(3); // delete middle key

    const results = db.range(1, 5);
    const keys = results.map((r) => r.key);

    expect(keys).toEqual([1, 2, 4, 5]); // 3 should be missing

    db.close();
  });

  test("should return correct values in range, not just keys", () => {
    const db = new NanoDB(TEST_DB_PATH, TEST_WAL_PATH);
    db.open();

    db.put(10, "ten");
    db.put(20, "twenty");
    db.put(30, "thirty");

    const results = db.range(10, 20);

    expect(results).toEqual([
      { key: 10, value: "ten" },
      { key: 20, value: "twenty" },
    ]);

    db.close();
  });

  test("should handle range query across multiple leaf splits", () => {
    const db = new NanoDB(TEST_DB_PATH, TEST_WAL_PATH);
    db.open();

    // insert enough keys to force many leaf splits
    for (let i = 1; i <= 50; i++) {
      db.put(i, i * 100);
    }

    const results = db.range(20, 30);
    const keys = results.map((r) => r.key);

    expect(keys).toEqual([20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30]);

    db.close();
  });
});
