import { Output } from "@pulumi/pulumi"
import { kv } from "@pulumi/vault"
import fs from "fs"
import path from "path"

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

function populateFromTemplate(filePath: string): void {
  const envToVaultPathMapping = fs.readFileSync(filePath, "utf-8").split("\n")
  const secretsFromVault = envToVaultPathMapping
    .map(it => it.split("="))
    .map(([key, value]) => [key, getSecret(value)])
    .reduce((all, one) => all.concat(`${one}\n`), "")
  const userSecrets = fs
    .readFileSync(filePath, "utf-8")
    .split("\n")
    .map(value => value.split("="))
    .filter(([key]) => !envToVaultPathMapping.some(envVar => envVar.startsWith(key)))
    .reduce((all, one) => all.concat(`${one}\n`), "")
  fs.writeFileSync(path.join(path.basename(filePath), ".env"), [secretsFromVault, userSecrets].join("\n"))
}

export { getSecret, populateFromTemplate }
