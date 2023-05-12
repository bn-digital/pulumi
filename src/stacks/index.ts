import { Output } from "@pulumi/pulumi"
import { CloudAppConfiguration, Deployment, ProjectMeta } from ".."
import * as digitalocean from "../providers/digitalocean"

type CloudProvider = "digitalocean"

interface ContextAware {
  context: string | Output<string>
}

interface Deployable {
  deploy: <T extends Deployment & ContextAware>(type: new (metadata: ProjectMeta) => T) => T
}

interface CloudEnvironment {
  env: Deployable
}

abstract class Infrastructure<T extends CloudProvider> implements CloudAppConfiguration<T>, CloudEnvironment {
  readonly metadata: CloudAppConfiguration<"digitalocean">["metadata"]
  readonly spec: CloudAppConfiguration<"digitalocean">["spec"]

  constructor(config: CloudAppConfiguration<"digitalocean">) {
    this.metadata = config.metadata
    this.spec = config.spec
  }

  public get env() {
    const cluster = this[this.metadata.environment]

    const deploy = <T extends Deployment & ContextAware>(type: new (metadata: ProjectMeta) => T) => {
      const deployment = new type(this.metadata)
      deployment.context = cluster.kubeConfigs[0].rawConfig
      return deployment
    }

    return { deploy }
  }

  protected abstract get production(): digitalocean.Cluster

  protected abstract get staging(): digitalocean.Cluster
}

export * as digitalocean from "./digitalocean"
export { Infrastructure, ContextAware, CloudProvider }
