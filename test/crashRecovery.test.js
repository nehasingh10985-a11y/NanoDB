const fs = require("fs");
const DiskManager = require("../src/storage/diskManager");
const WalWriter = require("../src/wal/walWriter");
const WalReplay = require("../src/wal/walReplay");
const { PAGE_SIZE } = require("../src/utils/constants");

const TEST_DB_PATH = "./data/test-crash-db.dat";
const TEST_WAL_PATH = "./data/test-crash-wal.log";

describe("Crash Recovery", () => {
  beforeEach(() => {
    // Clean slate before every test
    [TEST_DB_PATH, TEST_WAL_PATH].forEach((p) => {
      if (fs.existsSync(p)) fs.unlinkSync(p);
    });
  });

  afterEach(() => {
    [TEST_DB_PATH, TEST_WAL_PATH].forEach((p) => {
      if (fs.existsSync(p)) fs.unlinkSync(p);
    });
  });

  test("should recover data from WAL after simulated crash", () => {
    // --- STEP 1: Simulate normal operation ---
    const disk = new DiskManager(TEST_DB_PATH);
    disk.open();

    const wal = new WalWriter(TEST_WAL_PATH);
    wal.open();

    const pageNum = disk.allocatePage(); // allocate page 0

    const pageData = Buffer.alloc(PAGE_SIZE);
    pageData.write("Important Data", 0);

    // Write to WAL FIRST (this succeeds)
    wal.appendEntry(pageNum, pageData);

    // --- STEP 2: Simulate crash BEFORE writing to actual DB file ---
    // Notice: we deliberately do NOT call disk.writePage() here.
    // We just close everything abruptly, like a crash would.
    disk.close();
    wal.close();

    // At this point, the DB file has an empty page (crash happened
    // before the real write), but the WAL has the record of the change.

    // --- STEP 3: Simulate restart ---
    const diskAfterRestart = new DiskManager(TEST_DB_PATH);
    diskAfterRestart.open();

    // Verify data is NOT there yet (proves crash was "real")
    const beforeReplay = diskAfterRestart.readPage(pageNum);
    const beforeString = beforeReplay.toString("utf8", 0, 14); // 15 → 14
    expect(beforeString).not.toBe("Important Data");

    // --- STEP 4: Replay WAL to recover ---
    const replay = new WalReplay(TEST_WAL_PATH);
    const replayedCount = replay.replay(diskAfterRestart);

    expect(replayedCount).toBe(1);

    // --- STEP 5: Verify data IS recovered now ---
    const afterReplay = diskAfterRestart.readPage(pageNum);
    const afterString = afterReplay.toString("utf8", 0, 14); // 15 → 14
    expect(afterString).toBe("Important Data");

    diskAfterRestart.close();
  });

  test("should return 0 entries when WAL is empty", () => {
    const disk = new DiskManager(TEST_DB_PATH);
    disk.open();

    const replay = new WalReplay(TEST_WAL_PATH); // no WAL file exists
    const count = replay.replay(disk);

    expect(count).toBe(0);
    disk.close();
  });
});
