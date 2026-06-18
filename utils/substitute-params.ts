import type { ReportParameter } from "@/models/saved-report.interface"

/**
 * Substitute {{parameter_name}} placeholders in a report's SQL with concrete values.
 *
 * Quoting rule (matches the original inline logic from saved-reports.tsx):
 *   - text / date / datetime values are wrapped in single quotes
 *   - number / boolean values are inserted bare
 * For each parameter the value is taken from `values[param.name]`, falling back
 * to the parameter's `defaultValue`, then to an empty string.
 *
 * Parameters with no provided value and no default leave their `{{name}}`
 * placeholder intact — callers running unattended (e.g. the dashboard) should
 * check for a remaining `{{` and skip such queries.
 */
export function substituteParams(
  sql: string,
  params?: ReportParameter[],
  values?: Record<string, any>
): string {
  if (!params || params.length === 0) return sql

  let finalSql = sql
  params.forEach((param) => {
    const value = values?.[param.name] || param.defaultValue || ""

    let formattedValue: string = String(value)
    if (param.type === "text" || param.type === "date" || param.type === "datetime") {
      formattedValue = `'${value}'`
    }

    finalSql = finalSql.replace(new RegExp(`\\{\\{${param.name}\\}\\}`, "g"), formattedValue)
  })

  return finalSql
}
