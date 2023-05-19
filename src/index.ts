import * as pulumi from "@pulumi/pulumi"
import { Config, getStack } from "@pulumi/pulumi"
import { config as readFromEnvFile } from "dotenv"
import * as providers from "./providers"
import * as resources from "./resources"
import * as services from "./services"
import * as stacks from "./stacks"

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace NodeJS {
    interface ProcessEnv {
      APP_NAME: string
      APP_ENV: "staging" | "production"
      APP_VERSION: string

      DATABASE_HOST: string
      DATABASE_PORT: number
      DATABASE_NAME: string
      DATABASE_USERNAME: string
      DATABASE_PASSWORD: string
      DATABASE_ROOT_PASSWORD: string

      TLS_ISSUER_NAME: string
      INGRESS_CLASS_NAME: string

      SMTP_HOST: string
      SMTP_PORT: number
      SMTP_USERNAME: string
      SMTP_PASSWORD: string
    }
  }
}

interface Deployment {
  release(): providers.helm.Release[]
}

type ConfigValue = string | object | boolean | number

type AppEnv = "production" | "staging"

type GenericConfiguration = {
  [key in keyof typeof this]: ConfigValue | Array<ConfigValue>
}

interface ProjectConfig<T extends GenericConfiguration = GenericConfiguration> {
  metadata: ProjectArgs
  spec: T
}

interface ProjectArgs {
  name: string
  version: string
  environment: AppEnv
}
type ResourceOptions = Pick<pulumi.CustomResourceOptions, "dependsOn" | "parent" | "deletedWith" | "ignoreChanges">
interface App<T extends stacks.InfrastructureConfig> {
  deploy(config: stacks.InfrastructureConfig): stacks.Infrastructure<T>
}

function configure<T extends stacks.InfrastructureConfig>(spec: T) {
  readFromEnvFile()

  const projectConfig: ProjectConfig<T> = {
    metadata: getMetadata(),
    spec,
  }
  return {
    cloud: (type: new (configuration: ProjectConfig<T>) => resources.WebAppCloudEnvironment<T>) => {
      const infrastructure = new type(projectConfig)
      return infrastructure.env
    },
  }
}

function getMetadata(): ProjectArgs {
  return {
    name: process.env.APP_NAME ?? new Config().name,
    version: process.env.APP_VERSION ?? "latest",
    environment: (process.env.APP_ENV ?? getStack()) as AppEnv,
  }
}

type AppConfig = providers.helm.AppConfig

export {
  stacks,
  providers,
  resources,
  services,
  configure,
  ProjectArgs,
  ProjectConfig,
  ResourceOptions,
  GenericConfiguration,
  Deployment,
  App,
  AppConfig,
}
