// A stand-in for the design canvas's support.js: renders a docs/design/**/*.dc.html artboard on its own page, in its default state.
// Implements only the subset the artboards use: {{path}} holes, sc-for, sc-if, helmet, dc-import and `class Component extends DCLogic`.
// A classic script, loaded by `<script src="./support.js">` in a browser and by require() in Node (the tests).
// Expansion works on the source text, not the DOM: the HTML parser would foster-parent an <sc-for> out of a <table>.
(function () {
  /** The value at a dotted path. A first segment missing from `scope` throws (a hole outside its sc-for); a null deeper down is undefined. */
  function lookup(scope, path) {
    const [root, ...rest] = path.trim().split(".");
    if (!(root in scope)) throw new Error(`{{${path}}}: "${root}" is not in scope`);
    return rest.reduce((v, k) => (v == null ? undefined : v[k]), scope[root]);
  }

  /** Whether an sc-if shows its content. The artboards build 'true'/'false' strings, so the string "false" is false. */
  function truthy(v) {
    return !(v === false || v == null || v === "" || v === 0 || v === "false");
  }

  const escape = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const attrs = (tag) => Object.fromEntries([...tag.matchAll(/([\w:-]+)="([^"]*)"/g)].map((m) => [m[1], m[2]]));
  const hole = /^\{\{\s*([\w.]+)\s*\}\}$/;

  /** Fills the holes of a stretch of markup with no structural tags in it. */
  function fill(text, scope) {
    return text
      .replace(/\s+([\w:-]+)="\{\{\s*([\w.]+)\s*\}\}"/g, (_, name, path) => {
        const v = lookup(scope, path);
        return v == null || v === false || typeof v === "function" ? "" : ` ${name}="${escape(v)}"`;
      })
      .replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, path) => escape(lookup(scope, path) ?? ""));
  }

  /** The index just past the close tag that matches the open tag ending at `from`. */
  function closeOf(text, name, from) {
    const tags = new RegExp(`<(/?)${name}\\b`, "g");
    tags.lastIndex = from;
    let depth = 1;
    for (let m; (m = tags.exec(text)); ) {
      depth += m[1] ? -1 : 1;
      if (!depth) return { start: m.index, end: text.indexOf(">", m.index) + 1 };
    }
    throw new Error(`<${name}> is never closed`);
  }

  /** Expands sc-for, sc-if and dc-import in `text`; `render(name, props)` gives an imported component's HTML. */
  function expand(text, scope, render) {
    const structural = /<(sc-for|sc-if|dc-import)\b[^>]*>/;
    let out = "";
    for (let rest = text; rest; ) {
      const open = structural.exec(rest);
      if (!open) return out + fill(rest, scope);
      out += fill(rest.slice(0, open.index), scope);
      const [, name] = open;
      const bodyAt = open.index + open[0].length;
      const close = closeOf(rest, name, bodyAt);
      const body = rest.slice(bodyAt, close.start);
      const a = attrs(open[0]);
      const value = (v) => (hole.test(v) ? lookup(scope, v.match(hole)[1]) : fill(v, scope));
      if (name === "sc-for") {
        for (const item of value(a.list) ?? []) out += expand(body, { ...scope, [a.as]: item }, render);
      } else if (name === "sc-if") {
        if (truthy(value(a.value))) out += expand(body, scope, render);
      } else {
        const props = {};
        for (const [k, v] of Object.entries(a)) if (k !== "name" && !k.startsWith("hint-")) props[k] = value(v);
        out += render(a.name, props);
      }
      rest = rest.slice(close.end);
    }
    return out;
  }

  class DCLogic {
    constructor(props) {
      this.props = props;
      this.state = {};
    }
    setState(patch) {
      this.state = { ...this.state, ...patch };
    }
  }

  /** The pieces of a .dc.html file: the template, the component source, the default props and the helmet's markup. */
  function parts(source) {
    const template = source.match(/<x-dc>([\s\S]*)<\/x-dc>/)?.[1];
    const script = source.match(/<script[^>]*data-dc-script[^>]*>([\s\S]*?)<\/script>/);
    if (!template || !script) throw new Error("not an artboard: no <x-dc> block or data-dc-script");
    const declared = JSON.parse(script[0].match(/data-props='([^']*)'/)?.[1] ?? "{}");
    const defaults = Object.fromEntries(Object.entries(declared).filter(([k]) => k !== "$preview").map(([k, v]) => [k, v.default]));
    const helmet = template.match(/<helmet>([\s\S]*?)<\/helmet>/)?.[1] ?? "";
    return { template: template.replace(/<helmet>[\s\S]*?<\/helmet>/, ""), code: script[1], defaults, helmet };
  }

  /** Names of the components a source imports, directly. */
  const importsOf = (source) => [...source.matchAll(/<dc-import\b[^>]*\bname="([^"]+)"/g)].map((m) => m[1]);

  /** The HTML of an artboard in its default state. `read(name)` returns the source of `<name>.dc.html` (null for the page itself). */
  function renderSource(source, read, overrides = {}) {
    const { template, code, defaults, helmet } = parts(source);
    const Component = new Function("DCLogic", `${code}\nreturn Component;`)(DCLogic);
    const props = { ...defaults, ...overrides };
    const scope = new Component(props).renderVals();
    const html = expand(template.replace(/\shint-[\w-]+="[^"]*"/g, ""), scope, (name, p) => renderSource(read(name), read, p).html);
    return { html, helmet };
  }

  /** Browser: replaces the page with its expanded artboard and flags the result on <html data-dc>. */
  async function run() {
    const root = document.documentElement;
    try {
      const fetchText = async (url) => {
        const r = await fetch(url);
        if (!r.ok) throw new Error(`${url}: ${r.status}`);
        return r.text();
      };
      const page = await fetchText(location.href);
      const sources = {};
      const queue = importsOf(parts(page).template);
      for (const name of queue) {
        if (sources[name]) continue;
        sources[name] = await fetchText(new URL(`${name}.dc.html`, location.href));
        queue.push(...importsOf(parts(sources[name]).template));
      }
      const { html, helmet } = renderSource(page, (name) => sources[name]);
      document.head.insertAdjacentHTML("beforeend", helmet);
      // Wait for the helmet's stylesheets so document.fonts.ready sees their @font-face rules.
      await Promise.all([...document.head.querySelectorAll("link[rel=stylesheet]")].filter((l) => !l.sheet)
        .map((l) => new Promise((r) => { l.onload = l.onerror = r; })));
      document.body.innerHTML = html;
      root.dataset.dc = "done";
    } catch (error) {
      root.dataset.dc = "error";
      root.dataset.dcError = String(error?.message ?? error);
    }
  }

  const api = { lookup, truthy, expand, parts, importsOf, renderSource, DCLogic };
  if (typeof module === "object" && module.exports) module.exports = api;
  if (typeof document !== "undefined") document.addEventListener("DOMContentLoaded", run);
})();
