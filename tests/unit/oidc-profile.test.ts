import { describe, it, expect } from "vitest"
import {
  resolveEmail,
  resolveName,
  extractClaimIdentities,
  hasGroupsOverage,
  matchesAdmin,
} from "@/lib/auth/oidc-profile"

// Representative claim sets. Authentik sends group names in `groups`; Entra sends
// group GUIDs in `groups` and App Roles in `roles`, and often omits `email`.
const authentikProfile = {
  sub: "hashed-user-id",
  email: "testadmin@example.com",
  name: "Test Admin",
  preferred_username: "testadmin",
  groups: ["dataquery-admins", "everyone"],
}

const entraProfile = {
  sub: "AAAAAA-BBBB",
  preferred_username: "person@contoso.com",
  name: "A Person",
  groups: ["8f4c1d2e-0000-4a1b-9c3d-111122223333"],
  roles: ["DataQuery.Admin"],
}

describe("resolveEmail", () => {
  it("prefers the email claim", () => {
    expect(resolveEmail(authentikProfile)).toBe("testadmin@example.com")
  })

  it("falls back to preferred_username when email is absent (Entra)", () => {
    expect(resolveEmail(entraProfile)).toBe("person@contoso.com")
  })

  it("falls back to upn when email and preferred_username are absent", () => {
    expect(resolveEmail({ upn: "someone@contoso.com" })).toBe("someone@contoso.com")
  })

  it("treats blank and non-string claims as absent", () => {
    expect(resolveEmail({ email: "   ", preferred_username: "fallback@x.com" })).toBe("fallback@x.com")
    expect(resolveEmail({ email: 42, upn: "u@x.com" })).toBe("u@x.com")
  })

  it("returns empty string when the provider sends nothing usable", () => {
    // The caller must treat this as fatal: users.email is NOT NULL.
    expect(resolveEmail({ sub: "only-a-sub" })).toBe("")
  })

  it("trims surrounding whitespace", () => {
    expect(resolveEmail({ email: "  spaced@x.com  " })).toBe("spaced@x.com")
  })
})

describe("resolveName", () => {
  it("prefers the name claim", () => {
    expect(resolveName(authentikProfile)).toBe("Test Admin")
  })

  it("falls back to preferred_username", () => {
    expect(resolveName({ preferred_username: "jdoe" })).toBe("jdoe")
  })

  it("returns null when neither is present", () => {
    expect(resolveName({ sub: "x" })).toBeNull()
  })
})

describe("extractClaimIdentities", () => {
  it("reads Authentik group names", () => {
    expect(extractClaimIdentities(authentikProfile)).toEqual(["dataquery-admins", "everyone"])
  })

  it("merges Entra group GUIDs with App Roles", () => {
    expect(extractClaimIdentities(entraProfile)).toEqual([
      "8f4c1d2e-0000-4a1b-9c3d-111122223333",
      "DataQuery.Admin",
    ])
  })

  it("handles a roles claim with no groups claim", () => {
    expect(extractClaimIdentities({ roles: ["Admin"] })).toEqual(["Admin"])
  })

  it("accepts a bare string claim as a single entry", () => {
    expect(extractClaimIdentities({ groups: "solo-group" })).toEqual(["solo-group"])
  })

  it("de-duplicates across the two claims", () => {
    expect(extractClaimIdentities({ groups: ["Admin"], roles: ["Admin"] })).toEqual(["Admin"])
  })

  it("drops non-string and blank entries", () => {
    expect(extractClaimIdentities({ groups: ["ok", 7, null, "  ", "  padded  "] })).toEqual([
      "ok",
      "padded",
    ])
  })

  it("returns an empty array when there are no claims", () => {
    expect(extractClaimIdentities({})).toEqual([])
  })
})

describe("hasGroupsOverage", () => {
  it("is false when a groups claim is present", () => {
    expect(hasGroupsOverage(authentikProfile)).toBe(false)
  })

  it("is false for a profile with no group information at all", () => {
    expect(hasGroupsOverage({ sub: "x" })).toBe(false)
  })

  it("detects _claim_names pointing at groups", () => {
    expect(hasGroupsOverage({ _claim_names: { groups: "src1" } })).toBe(true)
  })

  it("detects _claim_sources", () => {
    expect(
      hasGroupsOverage({ _claim_sources: { src1: { endpoint: "https://graph.microsoft.com/..." } } })
    ).toBe(true)
  })

  it("is false when groups survived alongside the overage markers", () => {
    expect(hasGroupsOverage({ groups: ["a"], _claim_names: { groups: "src1" } })).toBe(false)
  })
})

describe("matchesAdmin", () => {
  it("matches an Authentik group name", () => {
    expect(matchesAdmin(extractClaimIdentities(authentikProfile), "dataquery-admins")).toBe(true)
  })

  it("matches an Entra group GUID", () => {
    expect(
      matchesAdmin(extractClaimIdentities(entraProfile), "8f4c1d2e-0000-4a1b-9c3d-111122223333")
    ).toBe(true)
  })

  it("matches an Entra App Role from the roles claim", () => {
    expect(matchesAdmin(extractClaimIdentities(entraProfile), "DataQuery.Admin")).toBe(true)
  })

  it("accepts a comma-separated list so one config serves both providers", () => {
    const spec = "dataquery-admins, DataQuery.Admin"
    expect(matchesAdmin(extractClaimIdentities(authentikProfile), spec)).toBe(true)
    expect(matchesAdmin(extractClaimIdentities(entraProfile), spec)).toBe(true)
  })

  it("is case-insensitive, which also makes GUID casing irrelevant", () => {
    expect(matchesAdmin(["8F4C1D2E-0000-4A1B-9C3D-111122223333"], "8f4c1d2e-0000-4a1b-9c3d-111122223333")).toBe(true)
    expect(matchesAdmin(["DataQuery-Admins"], "dataquery-admins")).toBe(true)
  })

  it("does not match when the user holds no listed identity", () => {
    expect(matchesAdmin(["everyone"], "dataquery-admins")).toBe(false)
  })

  it("does not grant admin when the spec is empty or undefined", () => {
    expect(matchesAdmin(["dataquery-admins"], "")).toBe(false)
    expect(matchesAdmin(["dataquery-admins"], undefined)).toBe(false)
    expect(matchesAdmin(["dataquery-admins"], "  ,  ")).toBe(false)
  })

  it("does not match on a substring", () => {
    expect(matchesAdmin(["dataquery-admins-readonly"], "dataquery-admins")).toBe(false)
  })
})
