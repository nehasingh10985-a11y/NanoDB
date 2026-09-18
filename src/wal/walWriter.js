const fs = require("fs");
const path = require("path");
const { PAGE_SIZE, WAL_FILE_PATH } = require("../utils/constants");

const ENTRY_SIZE = 4 + PAGE_SIZE;

class WalWriter {
  constructor(filePath = WAL_FILE_PATH) {
    this.filePath = filePath;
    this.fd = null;
  }

  open() {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    if (!fs.existsSync(this.filePath)) {
      fs.writeFileSync(this.filePath, Buffer.alloc(0));
    }

    // "r+" instead of "a+" - avoids Windows EPERM on ftruncateSync
    this.fd = fs.openSync(this.filePath, "r+");
  }

  close() {
    if (this.fd !== null) {
      fs.closeSync(this.fd);
      this.fd = null;
    }
  }

  // Append a log entry: pageNumber + the new page data
  appendEntry(pageNumber, pageData) {
    if (pageData.length !== PAGE_SIZE) {
      throw new Error(`Page data must be exactly ${PAGE_SIZE} bytes`);
    }

    const entry = Buffer.alloc(ENTRY_SIZE);
    entry.writeUInt32LE(pageNumber, 0);
    pageData.copy(entry, 4);

    // Manually find current end-of-file, since we're not in "a" mode anymore
    const stats = fs.fstatSync(this.fd);
    const writePosition = stats.size;

    fs.writeSync(this.fd, entry, 0, ENTRY_SIZE, writePosition);
    fs.fsyncSync(this.fd);
  }

  truncate() {
    fs.ftruncateSync(this.fd, 0);
  }
}

module.exports = WalWriter;
