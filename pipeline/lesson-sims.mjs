// The simulations a lesson embeds, as the validator sees them (LMS-content#110): a
// `<Simulation id="…">` in the compiled MDX, never a mention in prose or a code block. The
// index carries the map simulation → published topics that embed it, so retrieval by topic
// reaches a record that touches a lesson only through `sim:` or `checkpoint:` references.
import fs from "node:fs";
import path from "node:path";
import { compile } from "@mdx-js/mdx";
import { parseFrontmatter } from "./frontmatter.mjs";

/** The ids of the simulations a body embeds, in order of appearance, each once; a body that does not compile embeds none (the validator reports it). */
export async function simsIn(content) {
  const sims = [];
  const visit = (node) => {
    if ((node.type === "mdxJsxFlowElement" || node.type === "mdxJsxTextElement") && node.name === "Simulation") {
      const id = node.attributes?.find((a) => a.type === "mdxJsxAttribute" && a.name === "id");
      if (typeof id?.value === "string") sims.push(id.value);
    }
    for (const child of node.children ?? []) visit(child);
  };
  try {
    await compile(content, { development: false, remarkPlugins: [() => visit] });
  } catch {
    return [];
  }
  return [...new Set(sims)];
}

/** Every published lesson (`topics/`, not a draft, never `staging/`) by id, with the simulations it embeds. */
export async function publishedLessons(root) {
  const dir = path.join(root, "topics");
  if (!fs.existsSync(dir)) return [];
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : e.name.endsWith(".mdx") ? [path.join(d, e.name)] : []));
  const lessons = [];
  for (const file of walk(dir).sort()) {
    const id = path.relative(dir, file).replace(/\.mdx$/, "").split(path.sep).join("/");
    let fm;
    try {
      fm = parseFrontmatter(fs.readFileSync(file, "utf8"), path.relative(root, file));
    } catch {
      continue; // the validator reports it
    }
    if (fm.data?.status === "draft") continue;
    lessons.push({ id, sims: await simsIn(fm.content) });
  }
  return lessons;
}

/** The map the index carries: each simulation id → the published topics that embed it, both sorted. */
export async function simulationTopics(root) {
  const map = new Map();
  for (const { id, sims } of await publishedLessons(root)) for (const sim of sims) (map.get(sim) ?? map.set(sim, []).get(sim)).push(id);
  return Object.fromEntries([...map.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([sim, topics]) => [sim, [...new Set(topics)].sort()]));
}
