import { ec2, ecr, s3 } from "@pulumi/aws"
import { Config, getStack } from "@pulumi/pulumi"
import * as path from "path"
import { generators } from "../services"
import { crudPolicy } from "./s3"

const config = new Config()
const name = config.name
const environment = getStack()
const tags: { [key: string]: string } = [
  ["Name", name],
  ["Environment", environment],
  ["Provisioner", "pulumi"],
]
  .concat(Object.entries(config.getObject<string>("tags") ?? {}))
  .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {})

async function getUbuntuLatestAmi(): Promise<ec2.GetAmiResult> {
  return await ec2.getAmi({
    mostRecent: true,
    filters: [
      {
        name: "name",
        values: ["ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*"],
      },
      {
        name: "virtualization-type",
        values: ["hvm"],
      },
    ],
    owners: ["099720109477"], // canonical
  })
}

function createSshKey() {
  const key = generators.sshKey(path.join(process.cwd(), ".secrets"))
  return new ec2.KeyPair("pulumi", {
    keyName: name,
    publicKey: key.publicKeyOpenssh,
    tags,
  })
}

function createContainerRegistry(name: string) {
  return new ecr.Repository(name, {
    name: `${name}/app`,
    imageTagMutability: "MUTABLE",
    imageScanningConfiguration: {
      scanOnPush: true,
    },
    forceDelete: true,
    tags,
  })
}

function createSecurityGroup() {
  return new ec2.SecurityGroup([name, "http"].join("-"), {
    name,
    description: "Allow SSH and HTTP access",
    ingress: [
      { protocol: "tcp", fromPort: 22, toPort: 22, cidrBlocks: ["0.0.0.0/0"] },
      { protocol: "tcp", fromPort: 80, toPort: 80, cidrBlocks: ["0.0.0.0/0"] },
      { protocol: "tcp", fromPort: 443, toPort: 443, cidrBlocks: ["0.0.0.0/0"] },
    ],
    egress: [{ protocol: "-1", fromPort: 0, toPort: 0, cidrBlocks: ["0.0.0.0/0"] }],
    tags,
  })
}

function createInstance() {
  const securityGroup = createSecurityGroup()
  const sshKey = createSshKey()
  return new ec2.Instance("instance", {
    ami: getUbuntuLatestAmi().then(ubuntu => ubuntu.id),
    instanceType: "t2.large",
    associatePublicIpAddress: true,
    keyName: sshKey.id,
    rootBlockDevice: { volumeSize: 50 },
    vpcSecurityGroupIds: [securityGroup.id],
    tags,
  })
}

function createBucket() {
  return new s3.Bucket("bucket", {
    bucket: name,
    policy: crudPolicy(name),
    tags,
  })
}

export { createBucket, createInstance, createContainerRegistry }
