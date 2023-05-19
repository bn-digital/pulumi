import { ComponentResource } from "@pulumi/pulumi"
import { ProjectConfig, ResourceOptions } from ".."
import { InfrastructureConfig } from "../stacks"

interface EnvironmentArgs<T extends InfrastructureConfig = InfrastructureConfig> {
  project: ProjectConfig<T>
}

class Environment<T extends InfrastructureConfig> extends ComponentResource {
  private static readonly URN_PREFIX = "bn:index"

  readonly project: ProjectConfig<T>

  constructor(name: string, args: EnvironmentArgs<T>, opts?: ResourceOptions) {
    super([Environment.URN_PREFIX, "Environment"].join(":"), name, args, opts)
    this.project = {
      ...args.project,
      metadata: {
        environment: process.env.APP_ENV ?? args.project.metadata.environment,
        name: process.env.APP_NAME ?? args.project.metadata.name,
        version: process.env.APP_VERSION ?? args.project.metadata.version,
      },
    }
  }
}

export { Environment }
