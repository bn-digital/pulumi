import { Database, DatabaseArgs } from "@pulumi/postgresql"

function createDatabase({ name }: Pick<DatabaseArgs, "name">) {
  return new Database("database", {
    name,
  })
}

export { createDatabase }
