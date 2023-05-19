import { Deployment, ProjectConfig } from "../index"

type DeployableTarget<C extends WebAppConfiguration = WebAppConfiguration> = new (
  config: ProjectConfig<C>
) => Deployment

interface Deployable<C extends WebAppConfiguration = WebAppConfiguration> {
  deploy(type: DeployableTarget<C>): Deployment
}
type WebAppConfiguration = { [key: string]: unknown } & {
  domain: string
  region?: string
}
interface WebAppCloudEnvironment<T extends WebAppConfiguration> {
  get env(): Deployable<T>
}

export * from "./environment"
export { Deployable, WebAppConfiguration, DeployableTarget, WebAppCloudEnvironment }
