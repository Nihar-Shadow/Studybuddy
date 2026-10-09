// ─────────────────────────────────────────────────────────────
// Trie — prefix tree for O(k) topic lookup where k = prefix length
// Much faster than Array.filter() for large topic lists
// ─────────────────────────────────────────────────────────────
class Trie {
  constructor() {
    this.root  = {};
    this.count = 0;
  }

  // Insert a topic string into the trie
  insert(topic) {
    let node = this.root;
    for (const ch of topic.toLowerCase()) {
      if (!node[ch]) node[ch] = {};
      node = node[ch];
    }
    node['_end']  = topic;   // store original casing at leaf
    this.count++;
  }

  // Find all topics that start with prefix — returns array of matching topics
  // O(k + m) where k = prefix length, m = number of matches
  search(prefix) {
    if (!prefix) return [];
    let node = this.root;
    for (const ch of prefix.toLowerCase()) {
      if (!node[ch]) return [];
      node = node[ch];
    }
    const results = [];
    this._collectAll(node, results);
    return results;
  }

  // Check if exact topic exists
  has(topic) {
    let node = this.root;
    for (const ch of topic.toLowerCase()) {
      if (!node[ch]) return false;
      node = node[ch];
    }
    return !!node['_end'];
  }

  // Recursively collect all topics from a node
  _collectAll(node, results) {
    if (node['_end']) results.push(node['_end']);
    for (const key of Object.keys(node)) {
      if (key !== '_end') this._collectAll(node[key], results);
    }
  }

  // Get all inserted topics
  getAllTopics() {
    const results = [];
    this._collectAll(this.root, results);
    return results;
  }
}

module.exports = { Trie };
