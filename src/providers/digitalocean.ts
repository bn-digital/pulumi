import {
  Certificate,
  DnsRecord,
  Domain,
  DropletSlug,
  getKubernetesClusterOutput,
  getKubernetesVersionsOutput,
  getLoadBalancerOutput,
  KubernetesCluster,
  Project,
  RecordType,
  Region,
  SpacesBucket,
  SpacesBucketPolicy,
} from "@pulumi/digitalocean"
import { output, type Output } from "@pulumi/pulumi"
import { ProjectArgs, ResourceOptions } from "../index"
import { crudPolicy } from "./s3"

const DEFAULT_REGION = "nyc3" as const
const DEFAULT_NODE_POOL_NAME = "projects" as const

function createBucketPolicy(
  { policy, bucket, region }: ConstructorParameters<typeof SpacesBucketPolicy>[1],
  args?: ResourceOptions
): SpacesBucketPolicy {
  return new SpacesBucketPolicy(
    [bucket, "crud"].join("-"),
    { policy, bucket, region },
    { ignoreChanges: ["region"], ...args }
  )
}

/**
 * Create a DigitalOcean Spaces bucket required for CMS uploads and assets
 */
function createBucket(
  { name, region = DEFAULT_REGION }: { name: string; region?: Region },
  args?: ResourceOptions
): SpacesBucket {
  const bucket = new SpacesBucket(
    name,
    {
      acl: "public-read",
      name: `${name}-cms`,
      versioning: { enabled: false },
      forceDestroy: true,
      region,
    },
    { ignoreChanges: ["region"], ...args }
  )
  bucket.name.apply(name => {
    createBucketPolicy(
      {
        policy: JSON.stringify(crudPolicy(name)),
        bucket: name,
        region,
      },
      { parent: bucket }
    )
  })
  output(bucket).apply(it => it.name)
  return bucket
}

function createDnsMxRecords(domain: Domain, args: ResourceOptions) {
  new DnsRecord(
    `google-mx-0`,
    {
      type: RecordType.MX,
      priority: 1,
      domain: domain.id,
      name: domain.name,
      value: "aspmx.l.google.com.",
    },
    args
  )

  Array.from([1, 2, 3, 4]).forEach(priority => {
    new DnsRecord(
      `fallback-google-mx-${priority}`,
      {
        type: RecordType.MX,
        priority,
        domain: domain.id,
        name: domain.name,
        value: `alt${priority}.aspmx.l.google.com.`,
      },
      args
    )
  })
}

function createDnsARecords(domain: Domain, args: ResourceOptions) {
  getLoadBalancerOutput({ name: domain.name }).apply(lb => {
    new DnsRecord(`a-primary`, { type: RecordType.A, domain: domain.id, name: domain.name, value: lb.ip }, args)
    new DnsRecord(
      `cname-www-primary`,
      { type: RecordType.CNAME, domain: domain.id, name: `www`, value: `${domain.name}.` },
      args
    )
  })
}

function createDomain(
  {
    name,
    domain,
    certificate = false,
    recordTemplates = { googleSuiteMail: false, loadBalancerIngress: false },
  }: {
    name: string
    domain: string
    recordTemplates?: { googleSuiteMail: boolean; loadBalancerIngress: boolean }
    certificate?: boolean
  },
  args?: ResourceOptions
): Domain {
  const dns = new Domain(name, { name: domain }, args)
  const childArgs = { parent: dns, deletedWith: dns }
  recordTemplates?.loadBalancerIngress && createDnsARecords(dns, childArgs)
  recordTemplates?.googleSuiteMail && createDnsMxRecords(dns, childArgs)
  certificate && new Certificate(name, { domains: [name, `www.${name}`], type: "lets_encrypt" }, childArgs)
  return dns
}

function createCluster(
  {
    name,
    region = DEFAULT_REGION,
    nodePoolName = DEFAULT_NODE_POOL_NAME,
  }: {
    name: string
    region?: Region
    nodePoolName?: string
  },
  args?: ConstructorParameters<typeof KubernetesCluster>[2]
): KubernetesCluster {
  const cluster = new KubernetesCluster(
    name,
    {
      ha: false,
      surgeUpgrade: true,
      autoUpgrade: false,
      nodePool: {
        name: nodePoolName,
        size: DropletSlug.DropletS2VCPU4GB_INTEL,
        minNodes: 1,
        maxNodes: 2,
        autoScale: true,
        tags: [`project:${name}`],
      },
      version: getKubernetesVersionsOutput().latestVersion,
      name,
      region,
      tags: [`project:${name}`],
    },
    { retainOnDelete: true, ignoreChanges: ["version", "region"], ...args }
  )
  output(cluster).apply(it => it.name)
  return cluster
}

function createProject(
  {
    name,
    environment,
    resources,
  }: ConstructorParameters<typeof Project>[1] & Pick<ProjectArgs, "name" | "environment">,
  args?: ConstructorParameters<typeof Project>[2]
): Project {
  return new Project(
    name,
    {
      environment,
      name,
      isDefault: false,
      purpose: "Web Application",
      resources,
    },
    args
  )
}

function getCluster(name: string): Cluster {
  return getKubernetesClusterOutput({ name })
}

type Cluster<
  T extends Pick<ReturnType<typeof getKubernetesClusterOutput>, "kubeConfigs"> = Pick<
    ReturnType<typeof getKubernetesClusterOutput>,
    "kubeConfigs"
  >
> = Output<T> | T

export {
  createProject,
  createDomain,
  getCluster,
  createCluster,
  createBucket,
  DEFAULT_REGION,
  DEFAULT_NODE_POOL_NAME,
  Cluster,
}
