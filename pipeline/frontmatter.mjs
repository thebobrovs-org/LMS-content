/**
 * The only way this repo parses frontmatter. Frontmatter must be YAML (`---`).
 * Every other gray-matter language is rejected, including the ones gray-matter
 * would run as code. Anything that reads topics or paths imports this, never
 * gray-matter directly (a test enforces that).
 */
import matter from "gray-matter";

const reject = (lang) => () => {
  throw new Error(`frontmatter must be YAML ("---"); "---${lang}" is not allowed`);
};

// Override every non-YAML engine gray-matter ships with. Unknown languages are
// already rejected by gray-matter itself ("engine is not registered").
const ENGINES = Object.fromEntries(["js", "javascript", "coffee", "coffeescript", "cson", "json", "toml"].map((l) => [l, reject(l)]));

/** Parse `src` (a whole .mdx file). Throws, naming `file`, if the frontmatter isn't YAML. */
export function parseFrontmatter(src, file = "(input)") {
  try {
    return matter(src, { language: "yaml", engines: ENGINES });
  } catch (e) {
    throw new Error(`${file}: ${e.message}`);
  }
}
