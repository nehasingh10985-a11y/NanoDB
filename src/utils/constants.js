// Fixed page size - standard DB page size (4KB)
const PAGE_SIZE = 4096;

// File path for main database file
const DB_FILE_PATH = "./data/db.dat";

// File path for write-ahead log
const WAL_FILE_PATH = "./data/wal.log";

module.exports = {
  PAGE_SIZE,
  DB_FILE_PATH,
  WAL_FILE_PATH,
};
