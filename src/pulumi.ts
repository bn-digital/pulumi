import { helm } from "@pulumi/kubernetes"
import { Config, type Output } from "@pulumi/pulumi"
import { Cluster as DigitalOceanCluster } from "./digitalocean"
import { AppSpec, WebAppDeployment } from "./helm"

export type Tuple<K extends string = string, V extends any = Output<string> | string> = [K, V]

type EnvName = AppMetadata["environment"]

export interface Deployment {
  release(spec?: AppSpec): helm.v3.Release[]
}

export interface CloudApp {
  deploy(env: Infrastructure): Deployment
}

export type Environment = {
  [key in EnvName]: DigitalOceanCluster
}

export interface Configuration {
  config: Config
  metadata: AppMetadata
}

export type Infrastructure = Environment & Configuration

export interface AppMetadata {
  name: string
  version: string
  environment: "staging" | "production"
  domain: string
}

function deploy(infra: Infrastructure): Deployment {
  const cluster = infra.metadata.environment !== "production" ? infra.staging : infra.production
  const deployment = new WebAppDeployment(infra.metadata)
  deployment.context = cluster.kubeConfigs[0].rawConfig
  return deployment
}
export { deploy }
