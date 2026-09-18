# NanoDB

A small embedded key-value database engine built from scratch in Node.js — implementing the same core concepts used by real databases like SQLite and RocksDB: paged storage, write-ahead logging, B+Tree indexing, crash recovery, and range scans.

Built as a learning project to understand what actually happens inside a database engine.

## Features

- **Paged storage** — raw disk I/O in fixed 4KB pages, like real database engines
- **Write-Ahead Logging (WAL)** — every write is logged before being applied, enabling crash recovery
- **Crash recovery** — verified via simulated crash tests; uncommitted writes are replayed on restart
- **B+Tree index** — O(log n) insert/search with automatic node splitting
- **Tombstone deletes** — crash-safe deletion (soft-delete markers instead of destructive writes)
- **Range queries** — efficient key-range scans using a linked leaf-node structure
- **Full persistence** — all data and structure survive process restarts

## Architecture

┌────────────────────────┐
│ NanoDB Client │
│ (engine/db.js) │
│ │
│ put / get / delete │
│ range │
└───────────┬────────────┘
│
▼
┌────────────────────────┐
│ WalWriter │
│ │
│ Appends operations to │
│ write-ahead log first │
└───────────┬────────────┘
│
▼
┌────────────────────────┐
│ B+Tree Index │
│ │
│ In-memory index & │
│ page cache operations │
└───────────┬────────────┘
│
▼
┌────────────────────────┐
│ DiskManager │
│ │
│ Handles raw, fixed- │
│ size 4KB page I/O │
└────────────────────────┘

## How it works

**Write path (`put`)**

1. Encode the key-value pair into a fixed 4KB page
2. Append the write to the WAL and `fsync` (guarantees durability)
3. Apply the write to the actual database file
4. Clear the WAL entry (write is now safely committed)
5. Update the in-memory B+Tree index (`key → pageNumber`)

**Crash recovery (`open`)**

1. Read any leftover WAL entries (writes that didn't finish before a crash)
2. Replay them onto the database file
3. Scan all pages to rebuild the B+Tree index in memory

**Delete (`delete`)**
Instead of destructively erasing a page, the page is overwritten with a **tombstone marker**. This keeps deletes crash-safe — a delete either fully happens or fully doesn't, with no undefined in-between state.

**Range queries (`range`)**
B+Tree leaf nodes are linked together (like a linked list). A range query descends to the starting leaf, then walks forward through the linked leaves, collecting matching keys — without needing to re-traverse the tree.

## Usage

```javascript
const NanoDB = require("./src/engine/db");

const db = new NanoDB("./data/db.dat", "./data/wal.log");
db.open();

db.put("user:1", { name: "Aman", age: 25 });
console.log(db.get("user:1")); // { name: "Aman", age: 25 }

db.delete("user:1");
console.log(db.get("user:1")); // null

for (let i = 1; i <= 10; i++) {
  db.put(i, `item-${i}`);
}
console.log(db.range(3, 7));
// [{key:3,...}, {key:4,...}, {key:5,...}, {key:6,...}, {key:7,...}]

db.close();
```

## Running tests

```bash
npm install
npm test
```

Includes 28+ tests covering storage, WAL replay, B+Tree correctness under stress/random insert order, crash recovery simulation, tombstone deletes, and multi-leaf range queries.

## Known limitations (by design — this is a learning project, not production software)

- Index is rebuilt from disk on every startup (not persisted separately)
- No concurrent access support (single-threaded)
- No node merging/rebalancing after deletes
- No query language — direct API only

## What I learned building this

- How write-ahead logging provides crash-safety, and why `fsync` matters
- How B+Trees split and stay balanced during inserts
- Why deletes in real databases use tombstones instead of destructive writes
- Debugging platform-specific issues (Windows `ftruncateSync` behaves differently than Linux/Mac)
- How range queries use linked leaf nodes to avoid re-traversing the tree

## Tech stack

Node.js, `fs` (raw file I/O), Jest (testing)

## CLI Usage

```bash
node cli.js put <key> <value>
node cli.js get <key>
node cli.js delete <key>
node cli.js range <startKey> <endKey>
```

Example:

```bash
node cli.js put name "NanoDB"
node cli.js get name
# => "NanoDB"
```
