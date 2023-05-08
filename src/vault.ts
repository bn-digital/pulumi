import { Output } from "@pulumi/pulumi"
import { kv } from "@pulumi/vault"

export interface VaultSecret {
  data: { [key: string]: string }
  metadata: unknown
}

function getSecret(path: string): Output<string> {
  const chunks = path.split("/")
  const vaultSecretKey = chunks.pop()
  const output = kv.getSecretOutput({ path: chunks.join("/") }).dataJson.apply(JSON.parse) as Output<VaultSecret>
  return output.apply(it => (vaultSecretKey ? it?.data?.[vaultSecretKey] : ""))
}

export { getSecret }
