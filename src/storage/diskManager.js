const fs = require("fs");
const path = require("path");
const { PAGE_SIZE, DB_FILE_PATH } = require("../utils/constants");

class DiskManager {
  constructor(filePath = DB_FILE_PATH) {
    this.filePath = filePath;
    this.fd = null; // file descriptor
  }

  // Open (or create) the database file
  open() {
    // Ensure the data directory exists
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // "r+" fails if file doesn't exist, so create it first if needed
    if (!fs.existsSync(this.filePath)) {
      fs.writeFileSync(this.filePath, Buffer.alloc(0));
    }

    // "r+" = read and write, don't truncate existing content
    this.fd = fs.openSync(this.filePath, "r+");
  }

  // Close the file
  close() {
    if (this.fd !== null) {
      fs.closeSync(this.fd);
      this.fd = null;
    }
  }

  // Read a single page (by page number) from disk
  readPage(pageNumber) {
    const buffer = Buffer.alloc(PAGE_SIZE);
    const offset = pageNumber * PAGE_SIZE;

    fs.readSync(this.fd, buffer, 0, PAGE_SIZE, offset);
    return buffer;
  }

  // Write a single page (by page number) to disk
  writePage(pageNumber, data) {
    if (data.length !== PAGE_SIZE) {
      throw new Error(`Page data must be exactly ${PAGE_SIZE} bytes`);
    }

    const offset = pageNumber * PAGE_SIZE;
    fs.writeSync(this.fd, data, 0, PAGE_SIZE, offset);
  }

  // Force OS to flush data from cache to actual disk (crash-safety)
  sync() {
    fs.fsyncSync(this.fd);
  }

  // Get total number of pages currently in the file
  getPageCount() {
    const stats = fs.fstatSync(this.fd);
    return Math.floor(stats.size / PAGE_SIZE);
  }

  // Allocate a new page at the end of the file (returns new page number)
  allocatePage() {
    const pageNumber = this.getPageCount();
    const emptyPage = Buffer.alloc(PAGE_SIZE);
    this.writePage(pageNumber, emptyPage);
    return pageNumber;
  }
}

module.exports = DiskManager;
