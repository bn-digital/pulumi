import { Config } from "@pulumi/pulumi"
import { Infrastructure } from "."
import { digitalocean, github, harbor, postgresql, vault } from ".."

class Provider extends Infrastructure<"digitalocean"> {
  get production(): digitalocean.Cluster {
    const { region, domain: dns, nodePoolName } = this.spec
    const { name, environment } = this.metadata
    const bucket = digitalocean.createBucket({ name, region })
    const cluster = digitalocean.createCluster({ name, region, nodePoolName })
    const domain = digitalocean.createDomain({
      name: dns,
      certificate: false,
      recordTemplates: { googleSuiteMail: false, loadBalancerIngress: true },
    })
    digitalocean.createProject({
      name,
      environment,
      resources: [bucket.bucketUrn, cluster.clusterUrn, domain.domainUrn],
    })
    return cluster
  }

  get staging(): digitalocean.Cluster {
    const { name } = this.metadata

    harbor.createProject({ name })
    postgresql.createDatabase({ name })
    const secrets = this.spec["github-vault"].secrets ?? {}
    const vars = this.spec["github-vault"].vars ?? {}
    Object.entries(secrets).forEach(([name, path]) => github.createSecret([name, vault.getSecret(path)]))
    Object.entries(vars).forEach(([name, value]) => github.createVariable([name, value]))
    return digitalocean.getCluster({ name: "bndigital" })
  }
}

export { Provider }
