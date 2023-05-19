import { Region } from "@pulumi/digitalocean"
import { Infrastructure, InfrastructureConfig } from "."
import { ResourceOptions } from ".."
import { digitalocean, github, harbor, postgresql, vault } from "../providers"

type ProviderConfig = InfrastructureConfig & {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any
}

class CloudNativeWebApp extends Infrastructure<ProviderConfig> {
  get production(): digitalocean.Cluster {
    const { domain, region, nodePoolName = digitalocean.DEFAULT_NODE_POOL_NAME } = this.environment.project.spec
    const { name } = this.environment.project.metadata
    const options: ResourceOptions = { parent: this.environment, dependsOn: [this.environment] }
    const bucket = digitalocean.createBucket({ name, region: region as Region }, options)
    const cluster = digitalocean.createCluster(
      {
        name,
        region: region as Region,
        nodePoolName,
      },
      options
    )
    const dns = digitalocean.createDomain(
      {
        name,
        domain,
        certificate: false,
        recordTemplates: { googleSuiteMail: false, loadBalancerIngress: true },
      },
      options
    )
    digitalocean.createProject(
      {
        name,
        environment: this.environment.project.metadata.environment,
        resources: [bucket.bucketUrn, cluster.clusterUrn, dns.domainUrn],
      },
      options
    )
    return cluster
  }

  get staging(): digitalocean.Cluster {
    const args: ResourceOptions = { parent: this.environment }
    harbor.createProject(this.environment.project.metadata, args)
    postgresql.createDatabase(this.environment.project.metadata, args)

    Object.entries<Record<string, string>>(this.environment.project.spec?.githubSecrets ?? {}).map(
      ([path, keyValues]) =>
        vault.getSecret(path).apply(data => {
          const githubSecrets = Object.entries(keyValues)
            .map(([key, value]) => ({ [key]: data[value] }))
            .reduce((all, one) => ({ ...all, ...one }))
          github.createSecret(githubSecrets, args)
        })
    )

    return digitalocean.getCluster("bndigital")
  }
}

export { CloudNativeWebApp }
