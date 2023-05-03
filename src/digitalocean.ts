import {
  Domain,
  DomainArgs,
  DropletSlug,
  KubernetesCluster,
  KubernetesClusterArgs,
  Project,
  ProjectArgs,
  SpacesBucket,
  SpacesBucketPolicy,
  SpacesBucketPolicyArgs,
  getKubernetesVersionsOutput,
  type SpacesBucketArgs,
} from "@pulumi/digitalocean"
import { crudPolicy } from "./s3"

export interface ProductionConfig {
  domain: string
  region: string
}

const DEFAULT_REGION = "nyc3" as const
function createBucketPolicy({ policy, region = DEFAULT_REGION, ...args }: SpacesBucketPolicyArgs): SpacesBucketPolicy {
  return new SpacesBucketPolicy(
    [args.bucket, "crud"].join("-"),
    { policy, region, ...args },
    { ignoreChanges: ["region"] as (keyof SpacesBucketPolicyArgs)[] }
  )
}

/**
 * Create a DigitalOcean Spaces bucket required for CMS uploads and assets
 */
function createBucket({ name, region = DEFAULT_REGION }: Pick<SpacesBucketArgs, "name" | "region">): SpacesBucket {
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

function createDomain({ name }: Pick<DomainArgs, "name">): Domain {
  return new Domain("dns", {
    name,
  })
}

function createCluster({
  name,
  region = DEFAULT_REGION,
}: Pick<KubernetesClusterArgs, "name"> & Partial<Pick<KubernetesClusterArgs, "region">>): KubernetesCluster {
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

export { createProject, createDomain, createCluster, createBucket }
