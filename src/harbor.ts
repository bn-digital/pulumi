import { Config } from "@pulumi/pulumi"
import { getRegistryOutput, Project } from "@pulumiverse/harbor"

const { name } = new Config()

function createHarborProject() {
  const registry = getRegistryOutput({ name: "internal" })
  return new Project(name, {
    name,
    registryId: registry.registryId,
    public: "false",
    vulnerabilityScanning: true,
  })
}

export { createHarborProject }
