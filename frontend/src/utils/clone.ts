/** Deep-clone a value via JSON round-trip. */
export function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T
}
