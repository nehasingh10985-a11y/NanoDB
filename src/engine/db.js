const DiskManager = require("../storage/diskManager");
const WalWriter = require("../wal/walWriter");
const WalReplay = require("../wal/walReplay");
const BPlusTree = require("../index/bplustree");

const { encode, decode, encodeTombstone } = require("../utils/serializer");
class NanoDB {
  constructor(dbPath, walPath) {
    this.disk = new DiskManager(dbPath);
    this.walWriter = new WalWriter(walPath);
    this.walReplayPath = walPath;
    this.tree = new BPlusTree(); // key -> pageNumber (in-memory index)
  }

  open() {
    this.disk.open();
    this.walWriter.open();

    // Step 1: Replay any uncommitted WAL entries (crash recovery)
    const replay = new WalReplay(this.walReplayPath);
    replay.replay(this.disk);
    this.walWriter.truncate(); // WAL fully applied, safe to clear

    // Step 2: Rebuild the in-memory index by scanning all pages
    this._rebuildIndex();
  }

  close() {
    this.disk.close();
    this.walWriter.close();
  }

  _rebuildIndex() {
    const pageCount = this.disk.getPageCount();

    for (let p = 0; p < pageCount; p++) {
      const pageData = this.disk.readPage(p);
      const decoded = decode(pageData);

      if (decoded !== null && decoded !== "TOMBSTONE") {
        this.tree.insert(decoded.key, p);
      }
    }
  }

  put(key, value) {
    const pageBuffer = encode(key, value);

    // Check if key already exists -> reuse its page (update in place)
    const existingPageNum = this.tree.search(key);
    const pageNumber =
      existingPageNum !== null ? existingPageNum : this.disk.allocatePage();

    // Write-ahead: log BEFORE touching the real data file
    this.walWriter.appendEntry(pageNumber, pageBuffer);

    // Now apply to the actual database file
    this.disk.writePage(pageNumber, pageBuffer);
    this.disk.sync();

    // WAL entry is now safely applied - clear it
    this.walWriter.truncate();

    // Update in-memory index
    this.tree.insert(key, pageNumber);
  }

  get(key) {
    const pageNumber = this.tree.search(key);
    if (pageNumber === null) return null;

    const pageData = this.disk.readPage(pageNumber);
    const decoded = decode(pageData);

    if (decoded === null || decoded === "TOMBSTONE") return null;

    return decoded.value;
  }

  delete(key) {
    const pageNumber = this.tree.search(key);
    if (pageNumber === null) return false; // key doesn't exist

    const tombstonePage = encodeTombstone();

    // Write-ahead: log the tombstone before applying it
    this.walWriter.appendEntry(pageNumber, tombstonePage);

    this.disk.writePage(pageNumber, tombstonePage);
    this.disk.sync();

    this.walWriter.truncate();

    this.tree.delete(key);
    return true;
  }

  range(startKey, endKey) {
    const entries = this.tree.range(startKey, endKey);
    const results = [];

    for (const entry of entries) {
      const pageData = this.disk.readPage(entry.value); // entry.value = pageNumber
      const decoded = decode(pageData);

      // Skip tombstoned (deleted) pages
      if (decoded !== null && decoded !== "TOMBSTONE") {
        results.push({ key: decoded.key, value: decoded.value });
      }
    }

    return results;
  }
}

module.exports = NanoDB;
