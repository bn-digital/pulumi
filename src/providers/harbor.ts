import { all, output } from "@pulumi/pulumi"
import { Project, Registry, Replication, RobotAccount, getRegistryOutput } from "@pulumiverse/harbor"
import { ProjectArgs, ResourceOptions } from ".."
import { generators } from "../services"
import { createSecret as createGirthubSecret } from "./github"
import { createSecret as createVaultSecret } from "./vault"

interface RegistryConfig {
  url: string
  username: string
  password: string
  provider: string
}

/**
 * Creates project repository
 * @param {ProjectArgs} metadata
 * @param args
 */
function createProject({ name, environment }: ProjectArgs, args?: ResourceOptions) {
  const registry = getRegistryOutput({ name: "external" })
  const registryUrl = (url: string) => [url.replace("https://", ""), name].join("/")

  const project = new Project(
    name,
    {
      registryId: registry.registryId,
      public: "false",
      vulnerabilityScanning: true,
      name,
      forceDestroy: true,
    },
    { ...args, deleteBeforeReplace: true }
  )
  const childArgs = { deletedWith: project, parent: project }

  const dockerPassword = generators.randomString("docker-password", args)
  const robotAccount = new RobotAccount(
    name,
    {
      name: environment,
      level: "project",
      secret: dockerPassword.result,
      permissions: [
        {
          accesses: [
            {
              action: "create",
              resource: "tag",
            },
            {
              action: "pull",
              resource: "repository",
            },
            {
              action: "list",
              resource: "repository",
            },
            {
              action: "push",
              resource: "repository",
            },
          ],
          kind: "project",
          namespace: project.name,
        },
      ],
    },
    childArgs
  )

  all([registry.url, robotAccount.fullName, dockerPassword.result]).apply(([registryBaseUrl, username, password]) => {
    const url = registryUrl(registryBaseUrl)
    createVaultSecret(
      {
        path: `/projects/${name}/${environment}/registry`,
        data: { url, username, password },
      },
      childArgs
    )
    createGirthubSecret({ DOCKER_REGISTRY: url, DOCKER_USERNAME: username, DOCKER_PASSWORD: password }, childArgs)
  })
  output(registry.url).apply(url => registryUrl(url))

  return project
}

/**
 * Creates external registry configuration and replication rule for production releases
 */
function createExternalRegistry({
  metadata: { name },
  configuration,
}: {
  metadata: ProjectArgs
  configuration: RegistryConfig
}): Registry {
  const externalRegistry = getRegistryOutput({ name: "external" })
  const { url: endpointUrl, username, password, provider: providerName } = configuration
  const registry = new Registry(name, { endpointUrl, providerName, accessId: username, accessSecret: password })
  new Replication(
    `${name}-${providerName}`,
    {
      enabled: true,
      override: true,
      destNamespaceReplace: 1,
      action: "push",
      schedule: "event_based",
      filters: [
        {
          name: externalRegistry.url.apply(url => [url.replace("https://", ""), name, "**"].join("/")),
          tag: "*.*.*",
          resource: "artifact",
        },
      ],
      registryId: registry.registryId,
      name,
    },
    { deletedWith: registry, parent: registry }
  )

  return registry
}

export { createProject, createExternalRegistry, RegistryConfig }
