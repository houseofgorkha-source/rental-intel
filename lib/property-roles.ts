// The submitter-role vocabulary: what a person CLAIMS their relationship to a
// property is (`properties.submitted_as`). This is domain data, not UI, and it
// is needed on both sides of the client/server boundary — the Server Component
// at /add-property validates the `?as=` param, the "use server" createProperty
// action re-validates the submitted value, and the client RoleSelector renders
// the choice. It therefore must NOT live in a "use client" module: a Server
// Component importing a value from one receives a client reference, not the
// function, and throws at runtime.
//
// This is the single source of truth. Do not re-declare the allow-list
// anywhere else.

export const submitterRoles = ["owner", "tenant", "helper"] as const;

export type SubmitterRole = (typeof submitterRoles)[number];

// Anything unrecognised or absent is deliberately NOT an error — it becomes
// null ("legacy/unknown provenance"), which is exactly how rows created before
// this feature behave.
//
// Note this is not a privilege check. Claiming "owner" grants nothing; it only
// costs the claimer the ability to review their own property.
export function isSubmitterRole(
  value: string | undefined,
): value is SubmitterRole {
  return submitterRoles.includes(value as SubmitterRole);
}
