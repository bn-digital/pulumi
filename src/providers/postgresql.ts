import { Database, Grant, Role } from "@pulumi/postgresql"
import { ProjectArgs, ResourceOptions } from "../index"
import { generators } from "../services"
import { createSecret as createGithubSecret } from "./github"
import { createSecret as createVaultSecret } from "./vault"

function createDatabase({ name, environment }: ProjectArgs, args?: ResourceOptions): Database {
  const database = new Database(name, { name }, args)
  const childArgs: ResourceOptions = { parent: database }

  const password = generators.randomString("database-password", childArgs)

  const user = new Role(name, { login: true, name, password: password.result }, childArgs)
  new Grant(
    name,
    {
      database: name,
      role: user.name,
      objectType: "schema",
      privileges: [],
      schema: "public",
    },
    childArgs
  )
  createVaultSecret(
    {
      path: `/projects/${name}/${environment}/database`,
      data: {
        client: "postgres",
        username: user.name,
        database: database.name,
        host: `${name}-database`,
        port: `5432`,
        password: password.result,
      },
    },
    childArgs
  )
  createGithubSecret(
    {
      DATABASE_CLIENT: "postgres",
      DATABASE_USERNAME: user.name,
      DATABASE_NAME: database.name,
      DATABASE_HOST: `${name}-database`,
      DATABASE_PORT: `5432`,
      DATABASE_PASSWORD: password.result,
    },
    childArgs
  )
  return database
}

interface DatabaseConfig {
  password: string
  username: string
  host?: string
  port?: number
  database?: string
}

export { createDatabase, DatabaseConfig }
