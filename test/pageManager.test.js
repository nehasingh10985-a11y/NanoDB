const fs = require("fs");
const path = require("path");
const DiskManager = require("../src/storage/diskManager");
const { PAGE_SIZE } = require("../src/utils/constants");

const TEST_DB_PATH = "./data/test-db.dat";

describe("DiskManager", () => {
  let disk;

  beforeEach(() => {
    // Clean slate before every test
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
    disk = new DiskManager(TEST_DB_PATH);
    disk.open();
  });

  afterEach(() => {
    disk.close();
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
  });

  test("should allocate a new page and get correct page count", () => {
    const pageNum = disk.allocatePage();
    expect(pageNum).toBe(0); // first page should be page 0
    expect(disk.getPageCount()).toBe(1);
  });

  test("should write and read back the same data", () => {
    const pageNum = disk.allocatePage();

    // Create a buffer with some test data
    const writeBuffer = Buffer.alloc(PAGE_SIZE);
    writeBuffer.write("Hello NanoDB", 0); // write a string at offset 0

    disk.writePage(pageNum, writeBuffer);
    disk.sync(); // force flush to disk

    const readBuffer = disk.readPage(pageNum);
    const readString = readBuffer.toString("utf8", 0, 12); // read first 12 bytes

    expect(readString).toBe("Hello NanoDB");
  });

  test("should allocate multiple pages with increasing page numbers", () => {
    const page0 = disk.allocatePage();
    const page1 = disk.allocatePage();
    const page2 = disk.allocatePage();

    expect(page0).toBe(0);
    expect(page1).toBe(1);
    expect(page2).toBe(2);
    expect(disk.getPageCount()).toBe(3);
  });

  test("should throw error if data is not exactly PAGE_SIZE", () => {
    const pageNum = disk.allocatePage();
    const badBuffer = Buffer.alloc(100); // wrong size

    expect(() => disk.writePage(pageNum, badBuffer)).toThrow();
  });
});
