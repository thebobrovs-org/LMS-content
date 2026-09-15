// The lesson rules (hyperstack#114, ADR 0001): what an MDX lesson may hold, in one module for every
// consumer of lessons: content CI (pipeline/validate.mjs), the admin portal's preview (through the
// pinned `lms-content` dependency) and, in time, the learner app (LMS#76). A lesson is prose plus the
// documented components and prose HTML, with no JavaScript: no import or export, an expression that
// is literal data only, no attribute that injects HTML, loads a document or runs code on any element,
// and links and images that point at a same-site path, http(s) or mailto.
import { CALLOUT_TYPES, MDX_COMPONENTS } from "./content-schema.mjs";

const ALLOWED = new Set(MDX_COMPONENTS);
// The HTML a lesson may write directly: prose elements only. Nothing that scripts,
// embeds, loads or styles (script, iframe, object, embed, video, svg, style, form, …).
export const HTML_ELEMENTS = new Set([
  "a", "abbr", "b", "blockquote", "br", "code", "dd", "del", "details", "div", "dl", "dt", "em", "figcaption", "figure",
  "h1", "h2", "h3", "h4", "h5", "h6", "hr", "i", "img", "ins", "kbd", "li", "mark", "ol", "p", "pre", "s", "small", "span",
  "strong", "sub", "summary", "sup", "table", "tbody", "td", "tfoot", "th", "thead", "tr", "u", "var", "wbr",
]);
// The attributes those elements may carry, plus aria-* and data-*. Not dangerouslySetInnerHTML,
// srcDoc, style or an on* handler: an HTML string or a handler is code, whatever carries it.
export const HTML_ATTRIBUTES = new Set(["alt", "className", "colSpan", "height", "href", "id", "lang", "open", "rel", "rowSpan", "src", "start", "target", "title", "width"]);
// A URL a lesson may point at: a same-site path or fragment, http(s), or mailto. Never javascript:, data: or another scheme.
// A browser drops leading and trailing C0 controls and spaces, and any tab or newline, before it reads the scheme
// (" javascript:", "java\tscript:"), so a URL holding any of them is rejected rather than normalized: encode it.
export const SAFE_SCHEMES = new Set(["http", "https", "mailto"]);
export const UNSAFE_URL_CHARS = /[\u0000-\u0020\u007f]/;
/** Attributes no element may carry, documented components included: they inject HTML, load a document, or run code (the learner app refuses them at build, LMS#48). */
export const ACTIVE_ATTRIBUTE = /^(?:dangerouslySetInnerHTML|srcDoc|srcdoc|style|on[A-Z]|on[a-z])/;
export const urlScheme = (url) => /^([a-z][a-z0-9+.-]*):/i.exec(url)?.[1].toLowerCase();

/**
 * Whether an ESTree node is literal data: a string, number, boolean or null, a
 * template with no substitutions, a negative number, or an array or object of the
 * same. That is what `{" "}`, `height={520}` and `props={{ keys: 24 }}` carry.
 * Anything else (an identifier, a call, an operator, a function) is code.
 */
export function isLiteralData(node) {
  switch (node?.type) {
    case "Literal":
      return node.value === null || ["string", "number", "boolean"].includes(typeof node.value);
    case "TemplateLiteral":
      return node.expressions.length === 0;
    case "UnaryExpression":
      return (node.operator === "-" || node.operator === "+") && node.argument.type === "Literal" && typeof node.argument.value === "number";
    case "ArrayExpression":
      return node.elements.every((e) => e !== null && isLiteralData(e));
    case "ObjectExpression":
      return node.properties.every(
        (p) => p.type === "Property" && !p.computed && p.kind === "init" && !p.method && (p.key.type === "Identifier" || p.key.type === "Literal") && isLiteralData(p.value),
      );
    default:
      return false;
  }
}

/** The single expression of an MDX expression's program, if it is literal data; else undefined. */
export const literalOf = (estree) => (estree?.body?.length === 1 && estree.body[0].type === "ExpressionStatement" && isLiteralData(estree.body[0].expression) ? estree.body[0].expression : undefined);

/**
 * A JSX attribute's value when it is a string: `src="…"`, `src={"…"}` or a template with
 * no substitutions. Undefined for a boolean attribute (`<details open>`); null for
 * literal data of another shape (a number, an array, an object) or code.
 */
export function stringValue(attribute) {
  if (attribute.value == null) return undefined;
  if (typeof attribute.value === "string") return attribute.value;
  const literal = literalOf(attribute.value.data?.estree);
  if (literal?.type === "Literal" && typeof literal.value === "string") return literal.value;
  if (literal?.type === "TemplateLiteral") return literal.quasis[0]?.value.cooked ?? null;
  return null;
}

/** A JSX attribute's value when it is an array of string literals: `former-ids={["a", "b"]}`; undefined when absent, null for anything else. */
export function stringArrayValue(attribute) {
  if (!attribute || attribute.value == null || typeof attribute.value === "string") return attribute ? null : undefined;
  const literal = literalOf(attribute.value.data?.estree);
  if (literal?.type !== "ArrayExpression") return null;
  const out = [];
  for (const e of literal.elements) {
    if (!e || e.type !== "Literal" || typeof e.value !== "string") return null;
    out.push(e.value);
  }
  return out;
}

/**
 * A remark plugin that enforces what a lesson may hold (AGENTS.md: prose plus the
 * documented components, no JavaScript) and collects every URL it references:
 * - no import or export; an expression may carry literal data only;
 * - a JSX tag is a documented component or one of HTML_ELEMENTS, whose attributes
 *   come from HTML_ATTRIBUTES (so no dangerouslySetInnerHTML, srcDoc or on*);
 * - a link or image URL, Markdown or JSX, has no scheme other than http(s) or mailto,
 *   and no whitespace or control character a browser would drop before reading it;
 *   `src` and `href` are strings.
 * `urls` receives the URLs of every image, link, definition and `src`/`href`; `sims` the
 * `id` of every `<Simulation>`, however it is written.
 */
export function lessonRules(urls = [], sims = [], objectives = [], identities = []) {
  return (tree, vfile) => {
    const url = (value, node, what) => {
      if (UNSAFE_URL_CHARS.test(value)) vfile.fail(`${what} holds whitespace or a control character, which a browser drops before reading the scheme; encode it`, node);
      const scheme = urlScheme(value);
      if (scheme && !SAFE_SCHEMES.has(scheme)) vfile.fail(`${what} may point at a same-site path, http(s) or mailto, not "${scheme}:"`, node);
      urls.push(value);
    };
    const visit = (node) => {
      if (node.type === "mdxjsEsm") vfile.fail("an import or export isn't allowed in a lesson", node);
      if (node.type === "mdxFlowExpression" || node.type === "mdxTextExpression") {
        if (!literalOf(node.data?.estree)) vfile.fail(`a JavaScript expression isn't allowed in a lesson (only literal data such as {" "} or {42})`, node);
      }
      if ((node.type === "image" || node.type === "link" || node.type === "definition") && typeof node.url === "string") url(node.url, node, node.type === "link" ? "a link" : "an image");
      if (node.type === "mdxJsxFlowElement" || node.type === "mdxJsxTextElement") {
        const html = node.name != null && !ALLOWED.has(node.name);
        if (html && !HTML_ELEMENTS.has(node.name)) {
          vfile.fail(/^[a-z]/.test(node.name) ? `<${node.name}> isn't HTML a lesson may write (${[...HTML_ELEMENTS].join(", ")})` : `<${node.name}> isn't a documented component (${[...ALLOWED].join(", ")})`, node);
        }
        for (const a of node.attributes ?? []) {
          if (a.type !== "mdxJsxAttribute") vfile.fail(`a spread attribute isn't allowed on <${node.name}>`, node);
          else {
            if (ACTIVE_ATTRIBUTE.test(a.name)) vfile.fail(`<${node.name} ${a.name}>: an attribute that injects HTML, loads a document or runs code isn't allowed on any element, a documented component included`, node);
            if (html && !HTML_ATTRIBUTES.has(a.name) && !/^(aria|data)-[a-z][a-z0-9-]*$/.test(a.name)) {
              vfile.fail(`<${node.name} ${a.name}>: a lesson's HTML may carry only ${[...HTML_ATTRIBUTES].join(", ")}, aria-* and data-*`, node);
            }
            if (a.value && typeof a.value === "object" && !literalOf(a.value.data?.estree)) {
              vfile.fail(`<${node.name} ${a.name}={…}>: an attribute may carry only literal data (a string, number, boolean, array or object of those)`, node);
            }
            if (a.name === "src" || a.name === "href") {
              const value = stringValue(a);
              if (value === null) vfile.fail(`<${node.name} ${a.name}={…}> must be a string`, node);
              else if (value !== undefined) url(value, node, `<${node.name} ${a.name}>`);
            }
            if (node.name === "Callout" && a.name === "type") {
              const value = stringValue(a);
              if (typeof value !== "string" || !CALLOUT_TYPES.includes(value)) vfile.fail(`<Callout type=…> must be one of ${CALLOUT_TYPES.join(", ")}${typeof value === "string" ? `, not "${value}"` : ""}`, node);
            }
            if (node.name === "Simulation" && a.name === "id") {
              const value = stringValue(a);
              if (typeof value !== "string") vfile.fail(`<Simulation id={…}> must be a string`, node);
              else sims.push(value);
            }
            // An inline check or a step may name the objective it serves (LMS-content#83); the id is checked against the topic's list.
            if ((node.name === "Quiz" || node.name === "Flashcard" || node.name === "Step") && a.name === "objective") {
              const value = stringValue(a);
              if (typeof value !== "string") vfile.fail(`<${node.name} objective={…}> must be a string`, node);
              else objectives.push(value);
            }
          }
        }
        // A rendered check or step and its identity (ADR 0004): the prompt the app hashes, and the
        // `id` / `former-ids` it may carry. Checked against the topic's other items afterwards.
        if (node.name === "Quiz" || node.name === "Flashcard" || node.name === "Step") {
          const attr = (name) => node.attributes?.find((x) => x.type === "mdxJsxAttribute" && x.name === name);
          const promptAttr = attr(node.name === "Quiz" ? "question" : node.name === "Flashcard" ? "front" : "title");
          const prompt = promptAttr ? stringValue(promptAttr) : undefined;
          const idAttr = attr("id");
          const id = idAttr ? stringValue(idAttr) : undefined;
          if (idAttr && typeof id !== "string") vfile.fail(`<${node.name} id={…}> must be a string`, node);
          const formerIds = stringArrayValue(attr("former-ids"));
          if (formerIds === null) vfile.fail(`<${node.name} former-ids={…}> must be an array of strings`, node);
          identities.push({ tag: node.name, prompt: typeof prompt === "string" ? prompt : undefined, id: typeof id === "string" ? id : undefined, formerIds: formerIds ?? [] });
        }
      }
      for (const child of node.children ?? []) visit(child);
    };
    visit(tree);
  };
}
