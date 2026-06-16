# DataQuery Pro UI — how to build with this design system

This is a **shadcn/ui**-based React design system (Radix primitives + Tailwind CSS
+ class-variance-authority + lucide-react icons). Every component is a real
compiled export on `window.DataQueryProUI`. Build with the components below and
style your own layout with the Tailwind idiom described here.

## Setup & theming

- **Styling is Tailwind utility classes driven by CSS custom-property tokens.**
  The tokens live in `:root` (light) and `.dark` (dark) in the shipped
  stylesheet. Components already consume them — you do not redefine them.
- **Dark mode is class-based.** Put `class="dark"` on a wrapping element (e.g.
  `<html>` or a container) to switch the whole subtree to the dark token set.
  Light is the default; no provider is required to render styled components.
- Compose components directly — no global provider wrapper is needed for the
  primitives. (A few overlay components — Dialog, Sheet, Drawer, Popover,
  DropdownMenu, ContextMenu, Tooltip, HoverCard, Select, Menubar — use a Radix
  trigger + portal; render them with their `Trigger` and `Content` sub-parts.)

## The styling idiom — use these token-backed utility classes

Style your own layout/glue with Tailwind utilities. Color utilities resolve to
the brand tokens (always pair a surface with its `-foreground`):

| Utility | Use |
|---|---|
| `bg-background` / `text-foreground` | page surface + body text |
| `bg-card` / `text-card-foreground` | card/panel surface |
| `bg-popover` / `text-popover-foreground` | floating surfaces (menus, popovers) |
| `bg-primary` / `text-primary-foreground` | primary actions, emphasis |
| `bg-secondary` / `text-secondary-foreground` | secondary actions |
| `bg-muted` / `text-muted-foreground` | subdued fills + secondary text |
| `bg-accent` / `text-accent-foreground` | hover/selected states |
| `bg-destructive` / `text-destructive-foreground` | dangerous actions, errors |
| `border-border` / `border-input` | dividers / control borders |
| `ring-ring` | focus rings |
| `rounded-lg` / `rounded-md` / `rounded-sm` | radii (from `--radius`) |
| `bg-chart-1` … `bg-chart-5` / `var(--chart-1..5)` | chart series colors |

Prefer these semantic tokens over hard-coded colors (`bg-blue-500`) so output
follows the theme in both light and dark mode.

## Where the truth lives

- The bound stylesheet `styles.css` (it `@import`s the compiled Tailwind layer
  and `_ds_bundle.css`) — read it to see every available token and utility.
- Per-component API: each component's `<Name>.d.ts` (its props contract) and
  `<Name>.prompt.md` (usage). Compound components (Card, Table, Dialog, Select,
  DropdownMenu, Sidebar, …) are used by composing their sub-parts
  (`Card`+`CardHeader`+`CardTitle`+`CardContent`+`CardFooter`, etc.) — all
  sub-parts are exports on `window.DataQueryProUI` even when not shown as
  separate cards.

## One idiomatic example

```tsx
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter,
         Button, Badge } from "data-query-pro";

export function RevenueCard() {
  return (
    <Card className="w-[360px]">
      <CardHeader>
        <CardTitle>Total Revenue</CardTitle>
        <CardDescription>Last 30 days across all connections</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold">$48,320.55</div>
        <p className="mt-1 text-sm text-muted-foreground">+12.5% vs prior period</p>
      </CardContent>
      <CardFooter className="flex justify-between">
        <Badge variant="secondary">cloudmetrics</Badge>
        <Button size="sm" variant="outline">View report</Button>
      </CardFooter>
    </Card>
  );
}
```

The library component carries the design; your own glue (`flex`, `justify-between`,
`text-muted-foreground`, spacing) uses the token-backed utilities above.
