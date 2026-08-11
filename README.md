# OrgGraph 3D

An interactive 3D visualizer for org charts: people, projects, and strategic themes rendered as a navigable force-directed graph in the browser.

Built with React Three Fiber, Three.js, and d3-force-3d. No server, no backend — paste in JSON (or drag & drop a file) and it renders entirely client-side.

## Features

- **3D force-directed layout** of people, projects, and themes, with themes rendered as glowing nebula clouds
- **Four relationship types**: `reports-to` (org chart), `oversees` (ownership), `works-on` (contribution), `belongs-to` (project/theme classification)
- **Layer toggles** to show/hide reporting lines, oversight, work links, themes, or projects
- **Focus mode** — double-click any node to dim everything outside its immediate neighborhood
- **Validation** — malformed JSON is reported with specific, actionable errors before anything renders
- **Copyable agent prompt** — generate a ready-to-use prompt for an AI agent with access to your internal org resources (HRIS, directory, etc.) to produce the JSON for you

## Getting started

```bash
npm install
npm run dev
```

Open the local dev URL, then paste in JSON matching the data format below (or drag & drop a `.json` file). Sample data is available in `src/data/sample.json` and `src/data/big-sample.json`.

To build a single self-contained HTML file that runs with no server:

```bash
npm run build
```

The output in `dist/` can be opened directly in a browser.

## Data format

See [`docs/orggraph-data-spec.md`](docs/orggraph-data-spec.md) for the full schema, validation rules, and a walkthrough of converting a prose org description into valid JSON.

Quick shape:

```json
{
  "meta": { "title": "My Org" },
  "nodes": [
    { "id": "person-alice", "type": "person", "label": "Alice", "department": "Engineering" },
    { "id": "project-rewrite", "type": "project", "label": "Platform Rewrite" },
    { "id": "theme-platform", "type": "theme", "label": "Platform", "parent": null }
  ],
  "edges": [
    { "source": "person-alice", "target": "theme-platform", "type": "oversees" }
  ]
}
```

## Keyboard shortcuts

| key | action |
|---|---|
| `H` | toggle the HUD |
| `Escape` | exit focus mode, or clear selection |

## Testing

```bash
npm test
```

## License

MIT — see [LICENSE](LICENSE).
