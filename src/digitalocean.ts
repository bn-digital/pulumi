import {
  Certificate,
  DnsRecord,
  Domain,
  DropletSlug,
  KubernetesCluster,
  Project,
  RecordType,
  SpacesBucket,
  SpacesBucketPolicy,
  getKubernetesClusterOutput,
  getKubernetesVersionsOutput,
  getLoadBalancerOutput,
  type GetKubernetesClusterResult,
  type ProjectArgs,
  type SpacesBucketArgs,
  type SpacesBucketPolicyArgs,
} from "@pulumi/digitalocean"
import { type Output } from "@pulumi/pulumi"
import { crudPolicy } from "./s3"

export interface ProductionConfig {
  domain: string
  region: string
}

type DnsRecordString = `${string | "@" | "www"} ${RecordType} ${string}`

const DEFAULT_REGION = "nyc3" as const

function createBucketPolicy({ policy, ...args }: SpacesBucketPolicyArgs): SpacesBucketPolicy {
  return new SpacesBucketPolicy(
    [args.bucket, "crud"].join("-"),
    { policy, ...args },
    { ignoreChanges: ["region"] as (keyof SpacesBucketPolicyArgs)[] }
  )
}

/**
 * Create a DigitalOcean Spaces bucket required for CMS uploads and assets
 */
function createBucket({ name, region = DEFAULT_REGION }: { name: string; region?: string }): SpacesBucket {
  const bucket = new SpacesBucket(
    "storage",
    {
      acl: "public-read",
      name: `${name}-cms`,
      versioning: { enabled: false },
      forceDestroy: true,
      region,
    },
    { ignoreChanges: ["region"] as (keyof SpacesBucketArgs)[] }
  )
  bucket.name.apply(name => {
    createBucketPolicy({
      policy: JSON.stringify(crudPolicy(name)),
      bucket: name,
      region,
    })
  })

  return bucket
}

function createDomain({
  name,
  certificate = false,
  recordTemplates = { googleSuiteMail: false, loadBalancerIngress: false },
}: {
  name: string
  recordTemplates?: { googleSuiteMail: boolean; loadBalancerIngress: boolean }
  certificate?: boolean
}): Domain {
  const domain = new Domain("dns", {
    name,
  })
  if (recordTemplates.loadBalancerIngress) {
    getLoadBalancerOutput({ name: domain.name }).apply(lb => {
      new DnsRecord(`primary`, { type: RecordType.A, domain: domain.id, name, value: lb.ip })
      new DnsRecord(`alias`, { type: RecordType.CNAME, domain: domain.id, name: `www`, value: `${domain.name}.` })
    })
  }
  if (recordTemplates.googleSuiteMail) {
    new DnsRecord(`primary`, {
      type: RecordType.MX,
      priority: 1,
      domain: domain.id,
      name,
      value: "aspmx.l.google.com.",
    })

    Array.from([1, 2, 3, 4]).forEach(priority => {
      new DnsRecord(`backup-${priority}`, {
        type: RecordType.MX,
        priority,
        domain: domain.id,
        name,
        value: `alt${priority}.aspmx.l.google.com.`,
      })
    })
  }
  if (certificate) {
    new Certificate(name, { domains: [name, `www.${name}`], type: "lets_encrypt" })
  }
  return domain
}

function createCluster({ name, region = DEFAULT_REGION }: { name: string; region?: string }): KubernetesCluster {
  return new KubernetesCluster(
    "cluster",
    {
      ha: false,
      surgeUpgrade: true,
      autoUpgrade: false,
      nodePool: {
        name: "projects",
        size: DropletSlug.DropletS2VCPU4GB_INTEL,
        minNodes: 1,
        maxNodes: 2,
        autoScale: true,
      },
      version: getKubernetesVersionsOutput().latestVersion,
      name,
      region,
    },
    { retainOnDelete: true, ignoreChanges: ["version", "region"] }
  )
}

function createProject({ name, resources, ...args }: Pick<ProjectArgs, "name" | "environment" | "resources">): Project {
  return new Project("project", {
    environment: "Production",
    name,
    isDefault: false,
    purpose: "Web Application",
    resources,
    ...args,
  })
}

function getCluster({ name }: { name: string }): Output<GetKubernetesClusterResult> {
  return getKubernetesClusterOutput({ name })
}

type Cluster = Output<GetKubernetesClusterResult> | KubernetesCluster

export {
  createProject,
  createDomain,
  getCluster,
  createCluster,
  createBucket,
  DEFAULT_REGION,
  Cluster,
  DnsRecordString,
}
