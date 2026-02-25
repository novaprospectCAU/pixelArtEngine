const test = require("node:test");
const assert = require("node:assert/strict");
const os = require("node:os");
const path = require("node:path");
const fs = require("node:fs/promises");

const { expandInputPaths } = require("../packages/core/dist/index.js");

test("expandInputPaths returns only supported assets recursively", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "pixel-scan-"));

  const nestedDir = path.join(root, "nested");
  await fs.mkdir(nestedDir, { recursive: true });

  const supportedA = path.join(root, "hero.png");
  const supportedB = path.join(nestedDir, "intro.mp4");
  const unsupported = path.join(nestedDir, "notes.txt");

  await fs.writeFile(supportedA, "a", "utf8");
  await fs.writeFile(supportedB, "b", "utf8");
  await fs.writeFile(unsupported, "c", "utf8");

  const files = await expandInputPaths([root]);

  assert.equal(files.includes(supportedA), true);
  assert.equal(files.includes(supportedB), true);
  assert.equal(files.includes(unsupported), false);
});
