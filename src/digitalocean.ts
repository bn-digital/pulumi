import {
  Domain,
  DropletSlug,
  KubernetesCluster,
  Project,
  SpacesBucket,
  SpacesBucketPolicy,
  SpacesBucketPolicyArgs,
  getKubernetesVersionsOutput,
  type KubernetesClusterArgs,
  type SpacesBucketArgs,
} from "@pulumi/digitalocean"
import { Config, Output, getStack } from "@pulumi/pulumi"
import { crudPolicy } from "./s3"

const config = new Config()
const name = config.name
const region = config.require("cloud:region")
const tags = [`environment:${getStack()}`]
  .concat(...Object.entries(config.getObject("cloud:tags") ?? {}).map(([key, value]) => [key, value].join(":")))
  .filter((it, i, self) => self.indexOf(it) === i)

function createBucketPolicy(policy: string): SpacesBucketPolicy {
  return new SpacesBucketPolicy(
    [name, "cms", "crud"].join("-"),
    { policy, region, bucket: `cms` },
    { ignoreChanges: ["region"] as (keyof SpacesBucketPolicyArgs)[] }
  )
}

/**
 * Create a DigitalOcean Spaces bucket required for CMS uploads and assets
 */
function createBucket(): SpacesBucket {
  const bucket = new SpacesBucket(
    [name, "cms"].join("-"),
    {
      acl: "public-read",
      name: `${name}-cms`,
      versioning: { enabled: false },
      forceDestroy: true,
    },
    { ignoreChanges: ["region"] as (keyof SpacesBucketArgs)[] }
  )
  bucket.name.apply(crudPolicy).apply(JSON.stringify).apply(createBucketPolicy)

  return bucket
}

function createDomain(name: string): Domain {
  return new Domain("domain", {
    name,
  })
}

function createCluster(): KubernetesCluster {
  return new KubernetesCluster(
    name,
    {
      ha: false,
      surgeUpgrade: true,
      autoUpgrade: false,
      name,
      nodePool: {
        name: "default",
        size: DropletSlug.DropletS2VCPU4GB_INTEL,
        minNodes: 1,
        maxNodes: 2,
        autoScale: true,
      },
      region,
      version: getKubernetesVersionsOutput().latestVersion,
      tags,
    },
    { ignoreChanges: ["name", "version", "region"] as (keyof KubernetesClusterArgs)[] }
  )
}

function createProject(resources: Output<string>[]): Project {
  return new Project(name, {
    environment: "Production",
    name,
    isDefault: false,
    purpose: "Web Application",
    resources,
  })
}

export { createProject, createDomain, createCluster, createBucket }
