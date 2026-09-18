const fs = require("fs");
const { PAGE_SIZE, WAL_FILE_PATH } = require("../utils/constants");

const ENTRY_SIZE = 4 + PAGE_SIZE;

class WalReplay {
  constructor(filePath = WAL_FILE_PATH) {
    this.filePath = filePath;
  }

  // Reads all entries from the WAL file and returns them as a list
  readEntries() {
    if (!fs.existsSync(this.filePath)) {
      return [];
    }

    const fileBuffer = fs.readFileSync(this.filePath);
    const entries = [];

    // Only process complete entries - ignore any partial/corrupt trailing entry
    // (this can happen if a crash occurred mid-write to the WAL itself)
    const completeEntryCount = Math.floor(fileBuffer.length / ENTRY_SIZE);

    for (let i = 0; i < completeEntryCount; i++) {
      const start = i * ENTRY_SIZE;
      const pageNumber = fileBuffer.readUInt32LE(start);
      const pageData = fileBuffer.subarray(start + 4, start + ENTRY_SIZE);

      entries.push({ pageNumber, pageData: Buffer.from(pageData) });
    }

    return entries;
  }

  // Replays all WAL entries onto the actual database via DiskManager
  // Returns the number of entries replayed
  replay(diskManager) {
    const entries = this.readEntries();

    for (const entry of entries) {
      // Ensure the page exists in the DB file before writing to it
      const currentPageCount = diskManager.getPageCount();
      if (entry.pageNumber >= currentPageCount) {
        // Allocate empty pages up to this page number if needed
        for (let p = currentPageCount; p <= entry.pageNumber; p++) {
          diskManager.allocatePage();
        }
      }

      diskManager.writePage(entry.pageNumber, entry.pageData);
    }

    diskManager.sync();
    return entries.length;
  }
}

module.exports = WalReplay;
