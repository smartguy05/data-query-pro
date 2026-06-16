# design-sync NOTES — DataQuery Pro UI

Repo-specific gotchas for future syncs. Project: `DataQuery Pro UI`
(`https://claude.ai/design/p/91e99f55-b714-4087-99d2-0a07ebf0a369`).

## Setup quirks

- **This repo is a Next.js app, not a published library.** No `dist/`, no
  `main`/`module`/`exports` in `package.json`. The converter runs in
  **synth-entry mode** (package shape, `srcDir: "components"`): it `export *`s
  every `.tsx` under `components/` and bundles with esbuild.
- **`--entry` must be a NON-existent path** (e.g. `./dist/index.js`). It's only
  used to walk up to the repo's `package.json` so `PKG_DIR` = repo root; the
  soft `resolveDistEntry` returns null on the missing file, which triggers
  synth-entry. Do NOT point `--entry` at a real file (that would skip synth).
- **`node_modules/data-query-pro` does not exist** (npm won't self-install), so
  `--node-modules ./node_modules` + the non-existent `--entry` trick is required.
- **Tailwind CSS is compiled manually**, not shipped. `app/globals.css` is only
  `@tailwind` directives + `:root`/`.dark` token vars. Recompile before every
  build so `cfg.cssEntry` (`.design-sync/compiled.css`) carries all utilities:
  `npx tailwindcss -i app/globals.css -o .design-sync/compiled.css --minify`
  **After authoring previews**, add their classes to the scan or they render
  unstyled — recompile with previews included in the Tailwind `content`.
- **Skip `npm run build`** entirely: it does a destructive
  `rimraf node_modules && pnpm install` and only builds the Next.js app, which
  the converter does not need.

## Build command (re-sync)

```sh
node .ds-sync/package-build.mjs --config .design-sync/config.json \
  --node-modules ./node_modules --entry ./dist/index.js --out ./ds-bundle
node .ds-sync/package-validate.mjs ./ds-bundle
```

## Component notes & carded allowlist

- Synth-entry discovery finds **273 PascalCase exports** (shadcn compounds each
  export many named sub-parts: Card+CardHeader+CardContent+…, Sidebar+~25 parts).
  All ~265 (273 minus the 8 nulled) stay **functional on `window.DataQueryProUI`**
  and bundled — the design agent can import any of them.
- **Carded allowlist = ~54** meaningful components (`componentSrcMap: {Name: true}`):
  the ~45 shadcn primary components + chart components (ChartDisplay, the 5
  *ChartComponent wrappers) + ExecutiveMetrics, PerformanceChart, ThemeToggle.
  Sub-parts (CardHeader, TableCell, DialogContent, …) are intentionally NOT
  carded — they're shown composed inside their parent's authored preview, per
  the user's "compose parts in parent" choice. This keeps the DS pane clean
  (~54 cards, not 273 noisy ones).
- To card a currently-uncarded export later: add `"Name": true` and re-sync (cheap).
- Pure-infra exports (`AuthProvider`, `ThemeProvider`, `OpenAIApiProvider`,
  `ContentLoadingGate`, `ErrorBoundary`) are not carded (not visual DS components).

## Known render warns

- **`[TOKENS_MISSING]`** (non-blocking): `--sidebar-border`, `--sidebar-accent`
  are referenced by `components/ui/sidebar.tsx` but this app's `globals.css`
  never declares the shadcn sidebar token block, so sidebar parts fall back to
  default colors. `--radix-navigation-menu-viewport-*` and
  `--radix-accordion-content-height` are injected by Radix at runtime (expected
  absent). `--tw` is a parser fragment of `--tw-*` (false positive).
- **`[RENDER_BLANK]`/`[RENDER_THIN]`** on unauthored sub-parts (CardHeader,
  TableCell, BreadcrumbItem, Sidebar* parts, Pagination* parts, *Label/*Separator)
  is expected — they render nothing meaningful alone. Resolved by composing
  them inside their parent component's authored preview, not per-part cards.

## Exclusions (componentSrcMap null)

- `Toaster` — collision: both `components/ui/sonner.tsx` and `toaster.tsx`
  export `Toaster` → ambiguous esbuild star-export ([BUNDLE_EXPORT]). Nulling
  drops `toaster.tsx` from the synth entry; Sonner's `Toaster` stays on the
  window (orphan, harmless). Toaster is a non-visual portal host — fine to omit.
- 7 next-auth / next/navigation–coupled app-chrome files (Navigation,
  AuthProvider, ContentLoadingGate, SavedReports, QuickActions,
  DataMigrationDialog, SchemaExplorer) — they reference `process.*` at module
  scope and crashed every preview ("process is not defined"). Excluded from the
  bundle via the source-kit fork.

## Verify-loop learnings (preview authoring)

- **Overlays** (Dialog/AlertDialog/Sheet/Drawer/Popover/HoverCard/Tooltip/
  DropdownMenu/ContextMenu/Menubar/Command/Select): carded with
  `overrides.<Name>.cardMode: "single"` and authored to render the OPEN state
  (`open`/`defaultOpen`). Tooltip needs a `TooltipProvider` wrapper; ContextMenu
  Root accepts `open`; Menubar has no Root `open` (open one `MenubarMenu` via
  `defaultOpen`); Command renders inline (cmdk, no open).
  **Do NOT add `viewport` to these overrides** — the slice guard keeps `viewport`
  (not `cardMode`), so adding it after a stamped build trips `[CONFIG_STALE]` in
  `preview-rebuild.mjs`; only a full `package-build.mjs` re-stamps. cardMode-only
  overrides are stable.
- **Sidebar**: preview needs `collapsible="none"` (else the default
  `hidden md:block` desktop branch hides it) and a fixed-height wrapper.
- **ResizablePanelGroup**: `direction="vertical"` collapses to zero height in
  headless capture — use `direction="horizontal"` in previews.
- **Line/AreaChartComponent**: recharts reveal-animation is captured mid-flight
  (line/area truncates partway). Root cause: the source `line-chart.tsx` /
  `area-chart.tsx` hardcode `<Line>`/`<Area>` without `isAnimationActive={false}`,
  and `package-capture` doesn't wait for animation. Fix lives in source or a
  capture settle delay. Bar/Pie/Scatter/ChartContainer are unaffected.
- **Form**: renders truthfully only with a live `useForm()` + `FormField` render
  props; `<FormMessage>text</FormMessage>` shows destructive-red without a real
  validation trigger.
- **Calendar**: set `defaultMonth` alongside `selected` so the selected day is in view.
- **ThemeToggle**: renders without a theme provider in the capture harness.

## Re-sync risks

- `.design-sync/compiled.css` is a build artifact of the repo's Tailwind setup;
  if `tailwind.config.js` or `app/globals.css` change, recompile it.
- Synth-entry `.d.ts` prop contracts are weaker than a real build would give.
