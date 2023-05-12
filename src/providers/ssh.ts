import { join, basename } from 'path'
import { existsSync, mkdir,  writeFileSync } from 'fs'
import { PrivateKey } from '@pulumi/tls'

/**
 * Generates a new SSH key pair RSA 4096 bit cypher and stores it if a working directory is provided.
 * @param workingDir The path to the directory where the key pair should be stored.
 */
function generateSshKey(workingDir: string): PrivateKey {
  const key = new PrivateKey('ssh-key', { rsaBits: 4096, algorithm: 'RSA' })
  if (!existsSync(join(workingDir, 'id_rsa'))) {
    const write = (file: string) => (content: string) => writeFileSync(file, content, { mode: 400 })
    mkdir(basename(workingDir), { recursive: true }, error => console.error(error))
    key.privateKeyOpenssh.apply(write(join(workingDir, 'id_rsa')))
    key.publicKeyOpenssh.apply(write(join(workingDir, 'id_rsa.pub')))
  }
  return key
}

export { generateSshKey }
