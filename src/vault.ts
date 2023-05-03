import { Output } from "@pulumi/pulumi"
import { kv } from "@pulumi/vault"
import { createSecret } from "./github"

function getSecret(path: string): Output<string> {
  const vaultSecretKey = path.split("/").pop() as string
  return kv.getSecretOutput({ path }).dataJson.apply(json => `${JSON.parse(json)?.[vaultSecretKey]}`)
}

/**
 * @param key GitHub secret name
 * @param path Vault secret path
 */
function copyToGithubSecrets(key: string, path: string) {
  return createSecret({ key, value: getSecret(path) })
}

export { copyToGithubSecrets, getSecret }
