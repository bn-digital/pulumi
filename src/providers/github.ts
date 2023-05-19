import { ActionsSecret, ActionsVariable } from "@pulumi/github"
import { Config, Output } from "@pulumi/pulumi"
import { ResourceOptions } from "../index"

const config = new Config()
const name = config.name

type SecretVarMapping = { secrets?: Record<string, Record<string, string>> }

function createSecret(values: Record<string, string | Output<string>>, args?: ResourceOptions) {
  Object.entries(values).forEach(
    ([secretName, plaintextValue]) =>
      new ActionsSecret(
        secretName?.toString().toLowerCase().replace(/_/g, "-"),
        {
          secretName,
          repository: name,
          plaintextValue,
        },
        { ...args }
      )
  )
}

function createVariable(values: Record<string, string | Output<string>>, args?: ResourceOptions) {
  Object.entries(values).forEach(
    ([variableName, value]) =>
      new ActionsVariable(
        variableName?.toString().toLowerCase().replace(/_/g, "-"),
        {
          variableName,
          repository: name,
          value,
        },
        { ...args, deleteBeforeReplace: true }
      )
  )
}

export { createSecret, createVariable, SecretVarMapping }
