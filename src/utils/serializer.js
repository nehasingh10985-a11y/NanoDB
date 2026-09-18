const { PAGE_SIZE } = require("./constants");

// Format on disk:
// [4 bytes: marker] [JSON bytes if not deleted...] [padding zeros...]
// marker = 0 means "empty/unused page"
// marker = 0xFFFFFFFF means "tombstone (deleted)"
// marker = anything else means "valid JSON of that length"

const TOMBSTONE_MARKER = 0xffffffff;

function encode(key, value) {
  const json = JSON.stringify({ key, value });
  const jsonBuffer = Buffer.from(json, "utf8");

  if (jsonBuffer.length + 4 > PAGE_SIZE) {
    throw new Error("Encoded key-value pair exceeds PAGE_SIZE");
  }

  const page = Buffer.alloc(PAGE_SIZE);
  page.writeUInt32LE(jsonBuffer.length, 0);
  jsonBuffer.copy(page, 4);

  return page;
}

// Creates a tombstone page (marks a page as "deleted")
function encodeTombstone() {
  const page = Buffer.alloc(PAGE_SIZE);
  page.writeUInt32LE(TOMBSTONE_MARKER, 0);
  return page;
}

function decode(page) {
  const marker = page.readUInt32LE(0);

  if (marker === 0) {
    return null; // empty/unused page
  }

  if (marker === TOMBSTONE_MARKER) {
    return "TOMBSTONE"; // deleted page - special signal
  }

  const jsonBuffer = page.subarray(4, 4 + marker);
  const parsed = JSON.parse(jsonBuffer.toString("utf8"));

  return parsed; // { key, value }
}

module.exports = { encode, decode, encodeTombstone };
