import enDict from "../i18n/en.json"

type Dict = Record<string, unknown>

function get(obj: Dict, key: string): unknown {
  return key.split(".").reduce<unknown>((acc, part) => {
    if (acc && typeof acc === "object" && part in acc) return (acc as Dict)[part]
    return undefined
  }, obj)
}

function format(value: string, vars?: Record<string, string | number>): string {
  if (!vars) return value
  return value.replace(/\{(\w+)\}/g, (_, key) => (key in vars ? String(vars[key]) : `{${key}}`))
}

export function t(_locale: string, key: string, vars?: Record<string, string | number>): string {
  const value = get(enDict as Dict, key)
  if (typeof value === "string") return format(value, vars)
  return key
}
