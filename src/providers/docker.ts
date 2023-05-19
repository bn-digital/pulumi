import { Image } from "@pulumi/docker"
import path from "path"

function createImage(name: string) {
  return new Image(name, {
    imageName: `${name}/app`,
    registry: { server: `dcr.bndigital.dev` },
    build: { context: process.cwd(), dockerfile: path.join(process.cwd(), "Dockerfile") },
  })
}

export { createImage }
