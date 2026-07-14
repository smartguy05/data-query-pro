"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { QUERY_LIMIT, type DefaultQueryLimit } from "@/lib/constants"

interface DefaultLimitSelectProps {
  value: DefaultQueryLimit
  onChange: (value: DefaultQueryLimit) => void
  disabled?: boolean
}

/**
 * Dropdown for the default query row limit: presets, "No Limit", and a
 * "Custom…" option that reveals a numbers-only input. An explicit LIMIT in
 * the SQL always wins over this default.
 */
export function DefaultLimitSelect({ value, onChange, disabled }: DefaultLimitSelectProps) {
  const [customMode, setCustomMode] = useState(false)
  const [draft, setDraft] = useState("")

  const presets = QUERY_LIMIT.PRESETS as readonly number[]
  const isCustomValue = typeof value === "number" && !presets.includes(value)

  const selectValue = customMode
    ? "custom"
    : value === "none"
      ? "none"
      : isCustomValue
        ? "custom"
        : String(value)

  const triggerLabel =
    value === "none" ? "No Limit" : isCustomValue ? `Custom (${value})` : `${value} rows`

  const commitDraft = () => {
    const n = parseInt(draft, 10)
    setCustomMode(false)
    if (!Number.isInteger(n) || n < QUERY_LIMIT.MIN_CUSTOM) return // revert; previous value stands
    onChange(Math.min(n, QUERY_LIMIT.MAX_CUSTOM))
  }

  return (
    <div className="flex items-center gap-2">
      <Select
        value={selectValue}
        onValueChange={(v) => {
          if (v === "custom") {
            setDraft(typeof value === "number" ? String(value) : "")
            setCustomMode(true)
            return
          }
          setCustomMode(false)
          onChange(v === "none" ? "none" : Number(v))
        }}
        disabled={disabled}
      >
        <SelectTrigger id="default-limit" className="w-[140px]">
          <SelectValue>{customMode ? "Custom…" : triggerLabel}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {presets.map((n) => (
            <SelectItem key={n} value={String(n)}>
              {n} rows
            </SelectItem>
          ))}
          <SelectItem value="none">No Limit</SelectItem>
          <SelectItem value="custom">Custom…</SelectItem>
        </SelectContent>
      </Select>
      {customMode && (
        <Input
          aria-label="Custom row limit"
          inputMode="numeric"
          pattern="[0-9]*"
          placeholder="rows"
          className="w-24"
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value.replace(/\D/g, ""))}
          onBlur={commitDraft}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              commitDraft()
            } else if (e.key === "Escape") {
              setCustomMode(false)
            }
          }}
        />
      )}
    </div>
  )
}
