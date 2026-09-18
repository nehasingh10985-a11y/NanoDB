const BPlusTree = require("../src/index/bplustree");

describe("BPlusTree", () => {
  let tree;

  beforeEach(() => {
    tree = new BPlusTree();
  });

  test("should insert and search a single key", () => {
    tree.insert(10, "value-10");
    expect(tree.search(10)).toBe("value-10");
  });

  test("should return null for a key that doesn't exist", () => {
    tree.insert(10, "value-10");
    expect(tree.search(999)).toBe(null);
  });

  test("should update value if same key is inserted again", () => {
    tree.insert(10, "first");
    tree.insert(10, "second");
    expect(tree.search(10)).toBe("second");
  });

  test("should handle multiple inserts within one leaf (no split yet)", () => {
    tree.insert(5, "a");
    tree.insert(15, "b");
    tree.insert(10, "c");

    expect(tree.search(5)).toBe("a");
    expect(tree.search(10)).toBe("c");
    expect(tree.search(15)).toBe("b");
  });

  test("should correctly search after a leaf split occurs", () => {
    // MAX_KEYS = 3, so the 4th insert forces a split
    tree.insert(10, "v10");
    tree.insert(20, "v20");
    tree.insert(30, "v30");
    tree.insert(40, "v40"); // triggers split

    expect(tree.search(10)).toBe("v10");
    expect(tree.search(20)).toBe("v20");
    expect(tree.search(30)).toBe("v30");
    expect(tree.search(40)).toBe("v40");

    // Root should now be an internal node
    expect(tree.root.isLeaf).toBe(false);
  });

  test("should handle many inserts causing multiple splits (stress test)", () => {
    const keys = [];
    for (let i = 1; i <= 50; i++) {
      tree.insert(i, `value-${i}`);
      keys.push(i);
    }

    // Verify every single key is still findable
    for (const key of keys) {
      expect(tree.search(key)).toBe(`value-${key}`);
    }
  });

  test("should handle keys inserted in random (non-sorted) order", () => {
    const keys = [50, 10, 30, 5, 45, 20, 1, 99, 60, 15];
    keys.forEach((k) => tree.insert(k, `val-${k}`));

    keys.forEach((k) => {
      expect(tree.search(k)).toBe(`val-${k}`);
    });
  });
});
