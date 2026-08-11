export const AGENT_PROMPT = `You have visibility into our internal org chart resources (HRIS, directory, Slack, project trackers, etc.). Produce a single JSON document describing our organization in the exact format below, for import into OrgGraph 3D.

TOP-LEVEL STRUCTURE
{
  "meta": { "title": "My Org", "version": "1.0" },
  "nodes": [ ... ],
  "edges": [ ... ]
}
"meta" is optional. "nodes" and "edges" are required arrays.

NODE TYPES
Every node needs "id" (unique string) and "type". "label" is optional everywhere and falls back to "id".

- person: { "id": "person-alice", "type": "person", "label": "Alice", "department": "Engineering" }
  "department" is required (freeform string, drives color grouping).

- project: { "id": "project-rewrite", "type": "project", "label": "Platform Rewrite" }

- theme (a strategic area or programme that organizes projects):
  { "id": "theme-platform", "type": "theme", "label": "Platform", "parent": null }
  "parent" is required (the id of a parent theme, or null for root themes).

EDGE TYPES
Every edge needs "source", "target", "type".

- reports-to (person -> person): { "source": "person-bob", "target": "person-alice", "type": "reports-to" }
  Reads as "Bob reports to Alice."

- oversees (person -> theme|project): { "source": "person-alice", "target": "theme-platform", "type": "oversees" }
  A person takes responsibility for a theme or project.

- works-on (person -> project): { "source": "person-bob", "target": "project-rewrite", "type": "works-on" }
  A person is an active contributor to a project.

- belongs-to (project -> theme): { "source": "project-rewrite", "target": "theme-platform", "type": "belongs-to" }
  A project is classified under a theme. A project can belong to more than one theme.

INSTRUCTIONS
1. Enumerate every person, project, and theme you can find in our internal resources. Use stable kebab-case ids (e.g. "person-alice", "project-billing-v2", "theme-data-quality").
2. Give every person a "department".
3. Wire up "reports-to" edges from each person to their direct manager.
4. Add "oversees" edges from a person to any theme or project they lead/own/are responsible for.
5. Nest themes under their parent theme via "parent"; use "parent": null for root themes.
6. Add "belongs-to" edges connecting each project to the theme(s) it falls under.
7. Add "works-on" edges connecting each person to every project they actively contribute to.
8. Do not invent people, projects, or relationships that aren't supported by the source data. If a field is genuinely unknown, omit it rather than guessing (except "department" and theme "parent", which are required).

Output only the final JSON document, valid and complete, with no surrounding commentary.`;
