// PostgREST returns an embedded relationship as an OBJECT when it is
// many-to-one (a review's property, a verification's review, a review's
// author) and as an ARRAY only when it is one-to-many. Several queries in
// this project were written assuming an array in both cases and then read
// `.properties[0]` / `.author[0]`, which is always `undefined` for a
// many-to-one embed — so the code silently fell through to its fallback:
// property links disappeared from the account pages, and every named
// reviewer was rendered as "RentalIntel member".
//
// It fails quietly rather than loudly, which is why it survived. This helper
// accepts either shape so the reading code cannot get it wrong again.
export function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}
