class BPlusTreeNode {
  constructor(isLeaf = true) {
    this.isLeaf = isLeaf;
    this.keys = []; // sorted array of keys
    this.values = []; // only used if isLeaf - same length as keys
    this.children = []; // only used if !isLeaf - length = keys.length + 1
    this.next = null; // only used if isLeaf - pointer to next leaf (for range scans)
  }
}

module.exports = BPlusTreeNode;
