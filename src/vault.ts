import { ActionsSecret } from "@pulumi/github"
import { Output } from "@pulumi/pulumi"
import { kv } from "@pulumi/vault"
import { createSecret } from "./github"

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

/**
 * @param key GitHub secret name
 * @param path Vault secret path
 */
function copyToGithubSecrets(key: string, path: string): Output<ActionsSecret> {
  return getSecret(path).apply(value => createSecret({ key, value }))
}

export { copyToGithubSecrets, getSecret }
