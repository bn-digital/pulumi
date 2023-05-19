import { Provider } from "@pulumi/kubernetes"
import { ProjectConfig } from ".."
import * as providers from "../providers"
import { Deployable, DeployableTarget, Environment, WebAppCloudEnvironment, WebAppConfiguration } from "../resources"

interface InfrastructureConfig extends WebAppConfiguration {
  nodePoolName?: string
}

abstract class Infrastructure<T extends WebAppConfiguration = InfrastructureConfig>
  implements WebAppCloudEnvironment<T>
{
  readonly environment: Environment<T>

  constructor(config: ProjectConfig<T>) {
    this.environment = new Environment<T>(config.metadata.name, { project: config })
  }

  public get env(): Deployable<T> {
    const cluster: providers.digitalocean.Cluster = this[this.environment.project.metadata.environment]

    const deploy = (type: DeployableTarget) => {
      const deployment = new type(this.environment.project)
      new Provider(
        this.environment.project.metadata.environment,
        {
          kubeconfig: cluster.kubeConfigs[0].rawConfig,
          namespace: this.environment.project.metadata.environment,
        },
        { ignoreChanges: ["kubeconfig"] }
      )
      return deployment
    }

    return { deploy }
  }

  protected abstract get production(): providers.digitalocean.Cluster

  protected abstract get staging(): providers.digitalocean.Cluster
}

export * as digitalocean from "./digitalocean"
export { Infrastructure, InfrastructureConfig }
