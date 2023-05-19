import { KubernetesCluster, getVpcOutput } from "@pulumi/digitalocean"
import { PolicyPack, StackValidationPolicy } from "@pulumi/policy"
import { runtime } from "@pulumi/pulumi"

const stackPolicy: StackValidationPolicy = {
  name: "test",
  description: "DO integration tests.",
  enforcementLevel: "mandatory",
  validateStack: async (args, reportViolation) => {
    const clusterResources = args.resources.filter(r => r.isType(KubernetesCluster))
    if (clusterResources.length !== 1) {
      reportViolation(`Expected one K8s cluster but found ${clusterResources.length}`)
      return
    }

    const cluster = clusterResources[0].asType(KubernetesCluster)
    if (cluster.version.match(/(1.2)[5-9].*/)) {
      reportViolation(`Expected K8s cluster '${cluster.name}' version to be '1.25+' but found '${cluster.version}'`)
    }

    const vpcId = cluster.vpcUuid
    if (!vpcId) {
      // 'isDryRun==true' means the test are running in preview.
      // If so, the VPC might not exist yet even though it's defined in the program.
      // We shouldn't fail the test then to avoid false negatives.
      if (!runtime.isDryRun()) {
        reportViolation(`K8s cluster '${cluster.name}' has unknown VPC`)
      } else {
        getVpcOutput({ id: vpcId }).default.apply(isDefault => isDefault ?? reportViolation("Default VPC not found"))
      }
      return
    }
  },
}

new PolicyPack("tests-pack", {
  policies: [stackPolicy],
})
