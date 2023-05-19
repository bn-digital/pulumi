import { vault } from "../../src/providers"

describe("vault path resolution", () => {
  const expectedPath = "acme-marketplace/production" as const
  const expectedName = "database" as const
  const expectedMount = "projects" as const
  it("from DSN", () => {
    const { path, name, mount } = vault.getPathAndKeyFromDsn(
      "hashivault://projects/acme-marketplace/production/database"
    )
    expect(path).toBe(expectedPath)
    expect(name).toBe(expectedName)
    expect(mount).toBe(expectedMount)
  })
  it("from DSN with leading slash", () => {
    const { path, name, mount } = vault.getPathAndKeyFromDsn(
      "hashivault:///projects/acme-marketplace/production/database"
    )
    expect(path).toBe(expectedPath)
    expect(name).toBe(expectedName)
    expect(mount).toBe(expectedMount)
  })
  it("from full path", () => {
    const { path, name, mount } = vault.getPathAndKeyFromDsn("/projects/acme-marketplace/production/database")
    expect(path).toBe(expectedPath)
    expect(name).toBe(expectedName)
    expect(mount).toBe(expectedMount)
  })
  it("from path without leading slash", () => {
    const { path, name, mount } = vault.getPathAndKeyFromDsn("projects/acme-marketplace/production/database")
    expect(path).toBe(expectedPath)
    expect(name).toBe(expectedName)
    expect(mount).toBe(expectedMount)
  })
  it("from path with data affix", () => {
    const { path, name, mount } = vault.getPathAndKeyFromDsn("/projects/data/acme-marketplace/production/database")
    expect(path).toBe(expectedPath)
    expect(name).toBe(expectedName)
    expect(mount).toBe(expectedMount)
  })
})
