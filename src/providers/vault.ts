import { type Output } from "@pulumi/pulumi"
import { kv } from "@pulumi/vault"

const DSN_PREFIX = "hashivault://" as const
/**
 * Represents Vault secret entity
 */
interface Secret {
  /**
   * Contains JSON with key-value entries of latest secret version
   */
  data: { [key: string]: string | Output<string> }
  /**
   * Contains hash map with all versions of this entity
   */
  metadata?: unknown
}

/**
 * Sanitizes dsn string, removing hashivault:// prefix, adding `data` into path and extracting JSON key with secret required
 * @param {string} dsn
 */
function getPathAndKeyFromDsn(dsn: string): { mount: string; name: string; path: string } {
  if (dsn.startsWith(DSN_PREFIX)) dsn = dsn.replace(DSN_PREFIX, "")
  if (dsn.match(/\/data\//)) dsn = dsn.replace(/\/data\//, "/")
  if (dsn.startsWith("/")) dsn = dsn.slice(1)
  const chunks = dsn.split("/")
  const mount = chunks.shift() as string
  const name = chunks.pop() as string
  // Assembling path with all modifications applied
  const path = chunks.join("/")
  return { mount, path, name }
}

/**
 * Read secret value from Vault by path.
 * @example:
 * `getSecret("hashivault://projects/acme-marketplace/production/database/password")`
 * `getSecret("/projects/acme-marketplace/production/database/password")`
 * @param dsn
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getSecret<T extends { [key: string]: any } = { [key: string]: any }>(dsn: string): Output<T> {
  const { mount, name, path } = getPathAndKeyFromDsn(dsn)
  return kv
    .getSecretV2Output({ mount, name: [path, name].join("/") })
    .dataJson.apply(it => JSON.parse(it) satisfies T) as Output<T>
}
/**
 * Creates secret in Vault from key-value object entry
 */
function createSecret(
  { data, path }: Secret & { path: string },
  args?: ConstructorParameters<typeof kv.Secret>[2]
): kv.Secret {
  const chunks = (path.startsWith("/") ? path.slice(1) : path).split("/")
  const name = chunks.pop() as string
  const mount = chunks.shift() ?? path
  return new kv.SecretV2(
    name,
    {
      dataJson: JSON.stringify(data),
      name: chunks.concat(name).join("/"),
      mount,
    },
    args
  )
}

export { getSecret, createSecret, getPathAndKeyFromDsn, DSN_PREFIX }
