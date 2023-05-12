import { Project, ProjectArgs, getRegistryOutput } from "@pulumiverse/harbor"

function createProject({ name }: Pick<ProjectArgs, "name">) {
  const registry = getRegistryOutput({ name: "internal" })
  return new Project("container-registry", {
    registryId: registry.registryId,
    public: "false",
    vulnerabilityScanning: true,
    name,
  })
}

export { createProject }
