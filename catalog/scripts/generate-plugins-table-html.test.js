import test from "node:test";
import assert from "node:assert/strict";
import {renderPluginRow} from "./generate-plugins-table-html.js";

test("renderPluginRow escapes HTML in manifest text", () => {
  const row = renderPluginRow({
    name: "block-pin",
    description: "Adds 'completed: <today's date>' & more",
    author: "Joodo <wyattliang@gmail.com>",
    repo: "joodo/logseq-plugin-block-pin",
    repoUrl: "https://github.com/joodo/logseq-plugin-block-pin",
    readmeUrl: "https://github.com/joodo/logseq-plugin-block-pin#readme",
  });

  assert.match(row, /<td>Joodo &lt;wyattliang@gmail\.com&gt;<\/td>/);
  assert.match(row, />Adds 'completed: &lt;today's date&gt;' &amp; more<\/a>/);
  assert.doesNotMatch(row, /<wyattliang@gmail\.com>/);
  assert.doesNotMatch(row, /<today's date>/);
});
