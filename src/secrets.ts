import { kv } from '@pulumi/vault'
import { Output } from '@pulumi/pulumi'

declare type SecretsProvider = 'vault' | 'github'

declare type SecretsMap<K = string, V extends any = string> = Partial<{ [key in keyof K]: V }>

export abstract class SecretManager<V = string> {
  public static create<T extends SecretManager>(provider: SecretsProvider): T {
    switch (provider) {
      default:
        throw new Error(`Unsupported provider: ${provider}`)
    }
  }

  public abstract getSecret<K extends string>(name?: string): SecretsMap<K, V>

  public abstract setSecret<K extends string>(values: SecretsMap<K, string | Output<string>>): SecretsMap<K, V>
}

export class VaultSecretManager extends SecretManager<kv.Secret> {
  getSecret() {
    return {}
  }

  setSecret<K>(values: SecretsMap<K, string | Output<string>>) {
    return {}
  }
}
