"use client"

import { HelpCircle } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
// Imported from the types module, NOT the '@/lib/database' barrel: the barrel
// re-exports the adapter factory, which would pull mssql and better-sqlite3 into
// the client bundle.
import { supportsDirtyRead, type DatabaseType } from "@/lib/database/types"

interface DirtyReadToggleProps {
  value: boolean
  onChange: (value: boolean) => void
  /** Current connection's type, used to say when the setting is a no-op. */
  databaseType?: DatabaseType | string
  disabled?: boolean
}

/**
 * Switch for running queries at READ UNCOMMITTED so they never wait on other
 * transactions' locks — the portable form of SQL Server's `WITH (NOLOCK)`.
 *
 * Pure controlled component: it knows nothing about storage. Enforcement happens
 * in the adapters (transaction isolation level), never by rewriting SQL.
 *
 * When the current connection's engine has no dirty-read mode the switch stays
 * enabled and reflects the stored value — the preference is global, so a user on a
 * PostgreSQL connection must still be able to pre-set it for their SQL Server one
 * — but says plainly that it does nothing here.
 */
export function DirtyReadToggle({
  value,
  onChange,
  databaseType,
  disabled,
}: DirtyReadToggleProps) {
  const supported = supportsDirtyRead(databaseType)

  return (
    <div className="flex items-center gap-1.5">
      <Switch
        id="dirty-read"
        checked={value}
        onCheckedChange={onChange}
        disabled={disabled}
      />
      {/* Radix throws without a provider in scope, and there is none in the root
          layout — the app's only TooltipProvider lives inside the sidebar. */}
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label="About dirty reads"
              className="text-muted-foreground hover:text-foreground"
            >
              <HelpCircle className="h-3.5 w-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs space-y-2">
            <p>
              Runs your query at READ UNCOMMITTED isolation so it never waits for other
              transactions&apos; locks — the equivalent of <code>WITH (NOLOCK)</code> on
              every table.
            </p>
            {supported ? (
              <p>
                <strong>The results may be wrong.</strong> You can see rows from
                transactions that are still open and may be rolled back, and a row can be
                counted twice or missed entirely if the database moves it while your query
                is scanning. Use it for exploring a busy table, not for reported numbers.
              </p>
            ) : (
              <p>
                This database has no dirty-read mode, so the setting does nothing here.
                PostgreSQL treats READ UNCOMMITTED as READ COMMITTED, and under both it
                and SQLite readers already never block writers. Your queries are
                unaffected.
              </p>
            )}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      {!supported && (
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          No effect on this database
        </span>
      )}
    </div>
  )
}
