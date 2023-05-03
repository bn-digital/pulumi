import { ActionsSecret } from "@pulumi/github"
import { Config,type Output  } from "@pulumi/pulumi"
const config = new Config()
function createSecret({ key: secretName, value: plaintextValue }: { key: string; value: string|Output <string> }) {
  return new ActionsSecret(secretName?.toString().toLowerCase().replace(/_/g, "-"), {
    secretName,
    repository: config.name,
    plaintextValue,
  })
}
export { createSecret }
