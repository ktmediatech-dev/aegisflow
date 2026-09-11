// A user with a station assigned (req.auth.stationId, set at login — see
// auth.routes.js) only sees that one station's data in station-scoped
// modules. A user with no station assigned (the default) sees everything
// in their company, unchanged from before this existed.
//
// Filtering happens in JS after the normal query runs, rather than adding
// a conditional WHERE clause to the SQL — that keeps behavior identical
// between real Postgres and the in-memory dev fallback, which can't parse
// an extra clause it wasn't written to expect.

export function stationScopeFilterById(req, rows, idKey) {
  if (!req.auth.stationId) return rows
  return rows.filter((r) => r[idKey] != null && String(r[idKey]) === String(req.auth.stationId))
}

export function stationScopeFilterByName(req, rows, nameKey) {
  if (!req.auth.stationId) return rows
  return rows.filter((r) => r[nameKey] === req.auth.stationName)
}
