import { ActionsSecret, ActionsVariable } from "@pulumi/github"
import { Config, Output } from "@pulumi/pulumi"

const config = new Config()
const name = config.name

function createSecret([secretName, plaintextValue]: [string, string | Output<string>]) {
  return new ActionsSecret(secretName?.toString().toLowerCase().replace(/_/g, "-"), {
    secretName,
    repository: name,
    plaintextValue,
  })
}

function createVariable([variableName, value]: [string, string|Output<string>]) {
  return new ActionsVariable(variableName?.toString().toLowerCase().replace(/_/g, "-"), {
    variableName,
    repository: name,
    value,
  })
}

export { createSecret, createVariable }
