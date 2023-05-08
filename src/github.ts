import { ActionsSecret, ActionsVariable } from "@pulumi/github"
import { Config, type Output } from "@pulumi/pulumi"

const config = new Config()
const name = config.name

function createSecret({ key: secretName, value: plaintextValue }: { key: string; value: string | Output<string> }) {
  return new ActionsSecret(secretName?.toString().toLowerCase().replace(/_/g, "-"), {
    secretName,
    repository: name,
    plaintextValue,
  })
}

function createVariable({ key: variableName, value: value }: { key: string; value: string | Output<string> }) {
  return new ActionsVariable(variableName?.toString().toLowerCase().replace(/_/g, "-"), {
    variableName,
    repository: name,
    value,
  })
}

export { createSecret, createVariable }
