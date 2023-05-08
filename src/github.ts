import { ActionsSecret, ActionsVariable } from "@pulumi/github"
import { Config } from "@pulumi/pulumi"

import { Tuple } from "./pulumi"

const config = new Config()
const name = config.name

function createSecret([secretName, plaintextValue]: Tuple) {
  return new ActionsSecret(secretName?.toString().toLowerCase().replace(/_/g, "-"), {
    secretName,
    repository: name,
    plaintextValue,
  })
}

function createVariable([variableName, value]: Tuple) {
  return new ActionsVariable(variableName?.toString().toLowerCase().replace(/_/g, "-"), {
    variableName,
    repository: name,
    value,
  })
}

export { createSecret, createVariable }
