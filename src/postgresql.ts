import { Database } from "@pulumi/postgresql"
import { Config } from "@pulumi/pulumi"
const { name } = new Config()

function createDatabase() {
  return new Database(name, {
    name,
  })
}

export { createDatabase }
