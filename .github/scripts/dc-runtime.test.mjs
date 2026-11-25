import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import { leftoversIn } from "./artboards.mjs";

const { lookup, truthy, expand, renderSource } = createRequire(import.meta.url)("./dc-runtime.js");
const noImports = () => assert.fail("no import expected");

test("looks a path up through a nested scope", () => {
  assert.equal(lookup({ g: { name: "Reserva" } }, "g.name"), "Reserva");
});

test("an unknown first segment throws, a null deeper down is empty", () => {
  assert.throws(() => lookup({ g: {} }, "r.name"), /"r" is not in scope/);
  assert.equal(lookup({ g: { a: null } }, "g.a.b"), undefined);
  assert.equal(expand("<p>[{{g.a.b}}]</p>", { g: { a: null } }, noImports), "<p>[]</p>");
});

test("sc-if is false for false, null, undefined, '', 0 and the string 'false'; '0' stays true", () => {
  for (const v of [false, null, undefined, "", 0, "false"]) assert.equal(truthy(v), false, String(v));
  for (const v of [true, "true", "0", 1, "x"]) assert.equal(truthy(v), true, String(v));
  assert.equal(expand('<sc-if value="{{a}}">A</sc-if><sc-if value="{{b}}">B</sc-if>', { a: "false", b: "true" }, noImports), "B");
});

test("sc-for inside a table keeps one <tr> per item, and nests", () => {
  const rows = [{ n: "a" }, { n: "b" }, { n: "c" }];
  const html = expand('<table><tbody><sc-for list="{{rows}}" as="r"><tr><td>{{r.n}}</td></tr></sc-for></tbody></table>', { rows }, noImports);
  assert.equal(html.match(/<tr>/g).length, 3);
  const nested = expand('<sc-for list="{{gs}}" as="g"><sc-for list="{{g.rows}}" as="r">{{g.k}}{{r}};</sc-for></sc-for>', { gs: [{ k: "x", rows: [1, 2] }, { k: "y", rows: [3] }] }, noImports);
  assert.equal(nested, "x1;x2;y3;");
});

test("escapes values, and drops an attribute whose only value is a null, false or function hole", () => {
  const html = expand('<a aria-current="{{c}}" onClick="{{f}}" hidden="{{h}}" title="{{t}}">{{t}}</a>', { c: null, f: () => {}, h: false, t: '<"&' }, noImports);
  assert.equal(html, '<a title="&lt;&quot;&amp;">&lt;&quot;&amp;</a>');
});

test("renders an import with its defaults overridden by the attributes", () => {
  const sidebar = `<x-dc><nav data-theme="{{theme}}">{{label}}</nav></x-dc>
<script type="text/x-dc" data-dc-script data-props='{"theme":{"default":"dark"},"$preview":{"width":1}}'>
class Component extends DCLogic { renderVals() { return { theme: this.props.theme, label: this.props.active ?? "none" }; } }
</script>`;
  const page = `<x-dc><helmet><style>b{}</style></helmet><dc-import name="Sidebar" active="goals" theme="{{theme}}" hint-size="1,2"></dc-import></x-dc>
<script type="text/x-dc" data-dc-script data-props='{"theme":{"default":"light"}}'>
class Component extends DCLogic { renderVals() { return { theme: this.props.theme }; } }
</script>`;
  const { html, helmet } = renderSource(page, () => sidebar);
  assert.equal(html, '<nav data-theme="light">goals</nav>');
  assert.equal(helmet, "<style>b{}</style>");
});

test("every Revenue artboard expands with its default props and leaves nothing behind", () => {
  const dir = new URL("../../docs/design/revenue/", import.meta.url);
  const files = readdirSync(dir).filter((f) => f.endsWith(".dc.html"));
  assert.ok(files.length >= 33, `found only ${files.length} artboards`);
  const read = (name) => readFileSync(new URL(`${name}.dc.html`, dir), "utf8");
  for (const file of files) {
    const { html } = renderSource(read(file.replace(".dc.html", "")), read);
    assert.ok(html.length > 200, `${file} rendered almost nothing`);
    assert.equal(leftoversIn(html), null, file);
  }
});
