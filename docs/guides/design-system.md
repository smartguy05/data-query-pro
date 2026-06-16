# Claude Design System (claude.ai/design)

DataQuery Pro's UI component library is synced to **Claude Design** (claude.ai/design)
as a design system named **DataQuery Pro UI**. This lets Claude's design agent build
new screens and prototypes using the project's *real* components — so its output is
on-brand and maps 1:1 onto shippable code, instead of generic placeholder UI.

> **Project:** DataQuery Pro UI
> **URL:** https://claude.ai/design/p/91e99f55-b714-4087-99d2-0a07ebf0a369
> **Global:** every export is on `window.DataQueryProUI` in the design runtime.

## Using it to design

1. Open the project URL above in claude.ai/design.
2. Prompt the design agent in natural language (e.g. *"Build a connection-list page
   with a card per connection, a status badge, and a 'New connection' button"*). It
   composes the real `Card`, `Badge`, `Table`, `Tabs`, chart components, etc.
3. The generated React maps directly onto components engineers already ship — a mockup
   becomes a PR, not a redraw.

The agent follows the conventions in [`.design-sync/conventions.md`](../../.design-sync/conventions.md)
(prepended to the synced README): style with the token-backed Tailwind utilities
(`bg-primary`, `text-muted-foreground`, `border-border`, `chart-1..5`), `class="dark"`
for dark mode, and compose compound parts inside their parent.

## What's synced

| | |
|---|---|
| **Carded components** | ~54 — the shadcn primitives (`Button`, `Card`, `Dialog`, `Table`, `Select`, `Tabs`, …) plus the chart components (`ChartDisplay`, `AreaChartComponent`, `BarChartComponent`, `LineChartComponent`, `PieChartComponent`, `ScatterChartComponent`), `ExecutiveMetrics`, `PerformanceChart`, `ThemeToggle`. |
| **Functional exports** | ~265 — every PascalCase export (including sub-parts like `CardHeader`, `TableCell`, `DialogContent`) is importable on the window, even though only the ~54 above show cards. Sub-parts are shown composed inside their parent's card. |
| **Not synced** | App-chrome coupled to `next-auth` / `next/navigation` (`Navigation`, `AuthProvider`, `SchemaExplorer`, `SavedReports`, etc.) — they reference `process.*` at module scope and can't run in the design runtime. |

## Where the sync config lives

All sync inputs are under [`.design-sync/`](../../.design-sync/) (committed):

| Path | Purpose |
|------|---------|
| `.design-sync/config.json` | Sync configuration: package shape, synth-entry, the carded allowlist (`componentSrcMap`), overlay overrides, conventions header path. |
| `.design-sync/conventions.md` | The "how to build with this DS" header inlined into the design agent's context. **Human-editable** — keep it true. |
| `.design-sync/previews/*.tsx` | 54 authored preview compositions (one per carded component). These define each card. |
| `.design-sync/overrides/source-kit.mjs` | A converter fork: a `componentSrcMap` `null` entry also drops that file from the bundle (keeps the `process`-polluting app-chrome out). |
| `.design-sync/NOTES.md` | Repo-specific gotchas + verify-loop learnings for the next sync. |
| `.design-sync/tw.preview.cjs` | Tailwind config that compiles the static stylesheet (scans `components/**` + previews). |

Regenerated/gitignored (not committed): `.ds-sync/` (staged skill scripts), `ds-bundle/`
(build output), `.design-sync/.cache/`, `.design-sync/compiled.css`, `.design-sync/node_modules`.

## Re-syncing after component changes

Re-run the **`/design-sync`** skill in Claude Code. It re-stages its scripts, reuses the
committed `.design-sync/` inputs, and only re-verifies components that changed — so
re-syncs are fast and mostly deterministic. The configured build command is:

```sh
node .ds-sync/package-build.mjs --config .design-sync/config.json \
  --node-modules ./node_modules --entry ./dist/index.js --out ./ds-bundle
node .ds-sync/package-validate.mjs ./ds-bundle
```

(`--entry ./dist/index.js` is intentionally a **non-existent** path — it makes the
converter resolve the repo root and synthesize an entry from `components/`. See NOTES.)

## Key facts a future change should respect

- **Shape:** `package` / **synth-entry** — this is a Next.js app, not a published library,
  so esbuild bundles `components/**` source directly (`@/*` resolved via `tsconfig.json`).
- **Styling:** Tailwind is not pre-compiled; `tw.preview.cjs` produces the static
  stylesheet used as the bundle CSS. Recompile it when `tailwind.config.js` or
  `app/globals.css` change.
- **To card a new component:** add `"<ExportName>": true` to `componentSrcMap` in
  `.design-sync/config.json`, optionally author `.design-sync/previews/<ExportName>.tsx`,
  and re-sync.
- **Known limits:** `ContextMenu` ships functional but its card only shows the trigger
  (right-click menus can't statically open in headless capture). `--sidebar-*` tokens are
  undefined in this app, so `Sidebar` renders with fallback colors.

## Related
- [Components Overview](../components/overview.md)
- [Adding New UI Components — `CLAUDE.md`](../../CLAUDE.md)
- `.design-sync/NOTES.md` (repo-specific sync gotchas)
