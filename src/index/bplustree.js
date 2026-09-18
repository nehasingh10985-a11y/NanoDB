const BPlusTreeNode = require("./node");

const MAX_KEYS = 3; // max keys per node before split

class BPlusTree {
  constructor() {
    this.root = new BPlusTreeNode(true); // starts as a single leaf
  }

  // ---------- SEARCH ----------
  search(key) {
    let node = this.root;

    // Traverse down until we hit a leaf
    while (!node.isLeaf) {
      let i = 0;
      while (i < node.keys.length && key >= node.keys[i]) {
        i++;
      }
      node = node.children[i];
    }

    // Now node is a leaf - look for the key
    const idx = node.keys.indexOf(key);
    if (idx === -1) return null;
    return node.values[idx];
  }

  // ---------- INSERT ----------
  insert(key, value) {
    const result = this._insertRecursive(this.root, key, value);

    // If the root split, result will contain a new root info
    if (result) {
      const newRoot = new BPlusTreeNode(false); // internal node
      newRoot.keys = [result.splitKey];
      newRoot.children = [result.left, result.right];
      this.root = newRoot;
    }
  }

  // Returns null if no split happened.
  // Returns { splitKey, left, right } if this node split.
  _insertRecursive(node, key, value) {
    if (node.isLeaf) {
      return this._insertIntoLeaf(node, key, value);
    }

    // Find correct child to descend into
    let i = 0;
    while (i < node.keys.length && key >= node.keys[i]) {
      i++;
    }

    const result = this._insertRecursive(node.children[i], key, value);

    if (!result) return null; // child didn't split, nothing to do here

    // Child split - insert the splitKey and new right child into THIS node
    node.keys.splice(i, 0, result.splitKey);
    node.children.splice(i + 1, 0, result.right);
    // (result.left replaces the old child in-place already, since we split it directly)

    if (node.keys.length > MAX_KEYS) {
      return this._splitInternal(node);
    }

    return null;
  }

  _insertIntoLeaf(leaf, key, value) {
    // Find insert position (keep keys sorted)
    let i = 0;
    while (i < leaf.keys.length && leaf.keys[i] < key) {
      i++;
    }

    // If key already exists, just update value (no split needed)
    if (leaf.keys[i] === key) {
      leaf.values[i] = value;
      return null;
    }

    leaf.keys.splice(i, 0, key);
    leaf.values.splice(i, 0, value);

    if (leaf.keys.length > MAX_KEYS) {
      return this._splitLeaf(leaf);
    }

    return null;
  }

  _splitLeaf(leaf) {
    const mid = Math.ceil(leaf.keys.length / 2);

    const newLeaf = new BPlusTreeNode(true);
    newLeaf.keys = leaf.keys.splice(mid);
    newLeaf.values = leaf.values.splice(mid);

    // Maintain the leaf linked-list
    newLeaf.next = leaf.next;
    leaf.next = newLeaf;

    // In a B+Tree, the split key (for the parent) is the FIRST key
    // of the new right leaf - it still stays in the right leaf too.
    return { splitKey: newLeaf.keys[0], left: leaf, right: newLeaf };
  }

  _splitInternal(node) {
    const mid = Math.floor(node.keys.length / 2);
    const splitKey = node.keys[mid];

    const newNode = new BPlusTreeNode(false);
    newNode.keys = node.keys.splice(mid + 1);
    newNode.children = node.children.splice(mid + 1);

    node.keys.splice(mid); // remove the splitKey itself from left node (it moves up)

    return { splitKey, left: node, right: newNode };
  }

  // ---------- DELETE ----------
  // Simple version: removes the key from its leaf.
  // (We skip node-merging/rebalancing for simplicity - the tree
  // stays correct, just not perfectly compact after deletes.)
  delete(key) {
    let node = this.root;

    while (!node.isLeaf) {
      let i = 0;
      while (i < node.keys.length && key >= node.keys[i]) {
        i++;
      }
      node = node.children[i];
    }

    const idx = node.keys.indexOf(key);
    if (idx === -1) return false; // key not found

    node.keys.splice(idx, 1);
    node.values.splice(idx, 1);
    return true;
  }

  // ---------- RANGE QUERY ----------
  // Returns all [key, value] pairs where startKey <= key <= endKey
  range(startKey, endKey) {
    const results = [];

    // Step 1: descend to the leaf where startKey would be
    let node = this.root;
    while (!node.isLeaf) {
      let i = 0;
      while (i < node.keys.length && startKey >= node.keys[i]) {
        i++;
      }
      node = node.children[i];
    }

    // Step 2: walk forward through leaves using the linked list
    while (node !== null) {
      for (let i = 0; i < node.keys.length; i++) {
        const key = node.keys[i];

        if (key >= startKey && key <= endKey) {
          results.push({ key, value: node.values[i] });
        }

        if (key > endKey) {
          return results; // we've gone past the range, stop early
        }
      }

      node = node.next; // move to next leaf via linked list
    }

    return results;
  }
}

module.exports = BPlusTree;
