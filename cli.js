const NanoDB = require("./src/engine/db");

const DB_PATH = "./data/db.dat";
const WAL_PATH = "./data/wal.log";

function printUsage() {
  console.log(`
NanoDB CLI

Usage:
  node cli.js put <key> <value>
  node cli.js get <key>
  node cli.js delete <key>
  node cli.js range <startKey> <endKey>
`);
}

function main() {
  const args = process.argv.slice(2); // skip "node" and "cli.js"
  const command = args[0];

  if (!command) {
    printUsage();
    process.exit(1);
  }

  const db = new NanoDB(DB_PATH, WAL_PATH);
  db.open();

  try {
    switch (command) {
      case "put": {
        const [, key, value] = args;
        if (key === undefined || value === undefined) {
          console.log("Usage: node cli.js put <key> <value>");
          break;
        }
        // Try to parse value as a number, otherwise keep as string
        const parsedValue = isNaN(value) ? value : Number(value);
        db.put(key, parsedValue);
        console.log(`OK - stored "${key}" = ${JSON.stringify(parsedValue)}`);
        break;
      }

      case "get": {
        const [, key] = args;
        if (key === undefined) {
          console.log("Usage: node cli.js get <key>");
          break;
        }
        const value = db.get(key);
        if (value === null) {
          console.log(`(nil) - key "${key}" not found`);
        } else {
          console.log(JSON.stringify(value));
        }
        break;
      }

      case "delete": {
        const [, key] = args;
        if (key === undefined) {
          console.log("Usage: node cli.js delete <key>");
          break;
        }
        const deleted = db.delete(key);
        console.log(deleted ? `Deleted "${key}"` : `Key "${key}" not found`);
        break;
      }

      case "range": {
        const [, startKey, endKey] = args;
        if (startKey === undefined || endKey === undefined) {
          console.log("Usage: node cli.js range <startKey> <endKey>");
          break;
        }
        // Try numeric range first, fall back to string
        const start = isNaN(startKey) ? startKey : Number(startKey);
        const end = isNaN(endKey) ? endKey : Number(endKey);

        const results = db.range(start, end);
        if (results.length === 0) {
          console.log("(empty)");
        } else {
          results.forEach((r) => {
            console.log(`${r.key} => ${JSON.stringify(r.value)}`);
          });
        }
        break;
      }

      default:
        console.log(`Unknown command: ${command}`);
        printUsage();
    }
  } finally {
    db.close();
  }
}

main();
