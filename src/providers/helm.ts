import { helm, yaml } from "@pulumi/kubernetes"
import { Deployment, ProjectArgs, ProjectConfig, providers } from ".."
import { InfrastructureConfig } from "../stacks"
import { RegistryConfig } from "./harbor"
import { DatabaseConfig } from "./postgresql"

enum Releases {
  INGRESS_NGINX = "ingress-nginx@infrastructure",
  CERT_MANAGER = "cert-manager@infrastructure",
}

enum Charts {
  INGRESS_NGINX = "https://kubernetes.github.io/ingress-nginx@ingress-nginx:4.6.1",
  CERT_MANAGER = "https://charts.jetstack.io@cert-manager:v1.11.2",
  NODEJS = "https://bn-digital.github.io/helm@app:2.0.1",
}

function chartMetadata(charts: Charts): Pick<helm.v3.ReleaseArgs, "repositoryOpts" | "chart" | "version"> {
  const [repo, pinnedChart] = charts.split("@")
  const [chart, version] = pinnedChart.split(":")
  return { repositoryOpts: { repo }, chart, version }
}

const defaultHelmReleaseOptions: Partial<helm.v3.ReleaseArgs> = {
  cleanupOnFail: true,
  lint: true,
  dependencyUpdate: true,
  timeout: 300,
  maxHistory: 3,
  waitForJobs: false,
  skipAwait: true,
  createNamespace: true,
}

type Release = helm.v3.Release

export type AppConfig = {
  image?: {
    registry?: RegistryConfig
    repository?: string
  }
  vcs?: {
    repository?: string
    ref?: string
    commit?: string
  }
  database?: {
    enabled?: boolean
    auth?: DatabaseConfig & {
      postgresPassword?: string
    }
    volumeSizeGb?: number
  }
  env?: NodeJS.ProcessEnv
}

type PriorityClass = "system-cluster-critical" | "system-node-critical"

type IngressControllerConfig = {
  defaultBackend: { enabled: boolean }
  controller: {
    priorityClassName: PriorityClass
    ingressClassResource: {
      default: boolean
    }
    config: { [key: string]: string | boolean | number }
    service: {
      omitClusterIP: boolean
      annotations: { [key: string]: string }
    }
  }
}

type WebAppConfig = InfrastructureConfig & AppConfig

const INGRESS_CLASS_NAME = "nginx" as const
const TLS_ISSUER_NAME = "letsencrypt" as const
const TLS_ISSUER_KIND = "ClusterIssuer" as const

class WebAppDeployment implements Deployment {
  private readonly config: ProjectConfig<WebAppConfig>

  constructor(config: ProjectConfig<WebAppConfig>) {
    this.config = {
      ...config,
      spec: {
        ...config.spec,
        database: {
          ...config.spec.database,
          auth: {
            password: process.env.DATABASE_ROOT_PASSWORD,
            postgresPassword: process.env.DATABASE_ROOT_PASSWORD,
            username: process.env.DATABASE_USERNAME ?? config.metadata.name,
            database: process.env.DATABASE_NAME ?? config.metadata.name,
            host: process.env.DATABASE_HOST ?? [config.metadata.name, "database"].join("-"),
            port: process.env.DATABASE_PORT ?? 5432,
            ...config.spec.database?.auth,
          },
        },
      },
    }
  }

  private get domain(): string {
    return this.config.spec.domain ?? `${this.config.metadata.name}.bndigital.dev`
  }

  private get ingressController(): Release {
    const [name, namespace] = Releases.INGRESS_NGINX.split("@")
    return new helm.v3.Release(name, {
      ...defaultHelmReleaseOptions,
      ...chartMetadata(Charts.INGRESS_NGINX),
      name,
      namespace,
      values: {
        defaultBackend: { enabled: false },
        controller: {
          priorityClassName: "system-cluster-critical",
          ingressClassResource: {
            name: INGRESS_CLASS_NAME,
            default: true,
          },
          config: {
            [`allow-snippet-annotations`]: true,
            [`enable-modsecurity`]: true,
            [`use-gzip`]: true,
            [`use-http2`]: true,
          },
          service: {
            omitClusterIP: true,
            annotations: {
              ["service.beta.kubernetes.io/do-loadbalancer-name"]: this.domain,
              ["service.beta.kubernetes.io/do-loadbalancer-protocol"]: "http2",
              ["service.beta.kubernetes.io/do-loadbalancer-http2-port"]: "443",
              ["service.beta.kubernetes.io/do-loadbalancer-redirect-http-to-https"]: "true",
              ["service.beta.kubernetes.io/do-loadbalancer-tls-passthrough"]: "true",
            },
          },
        },
      } as IngressControllerConfig,
    })
  }

  private get certManager(): Release {
    const [name, namespace] = Releases.CERT_MANAGER.split("@")

    const release = new helm.v3.Release("cert-manager", {
      ...defaultHelmReleaseOptions,
      ...chartMetadata(Charts.CERT_MANAGER),
      name,
      namespace,
      values: {
        installCRDs: true,
        global: { priorityClassName: "system-cluster-critical" as PriorityClass },
        ingressShim: {
          defaultIssuerName: TLS_ISSUER_NAME,
          defaultIssuerKind: TLS_ISSUER_KIND,
        },
        metrics: {
          prometheus: {
            enabled: false,
          },
        },
      },
    })
    new yaml.ConfigGroup(
      [this.config.metadata.name, "tls-issuer"].join("-"),
      {
        objs: {
          apiVersion: "cert-manager.io/v1",
          kind: TLS_ISSUER_KIND,
          metadata: {
            name: TLS_ISSUER_NAME,
          },
          spec: {
            acme: {
              privateKeySecretRef: { name: [TLS_ISSUER_NAME, TLS_ISSUER_NAME].join("-") },
              server: "https://acme-v02.api.letsencrypt.org",
              email: `admin@${this.config.spec.domain}`,
              solvers: [{ http01: { ingress: { name: INGRESS_CLASS_NAME } } }],
            },
          },
        },
      },
      { dependsOn: [release], parent: release, deletedWith: release }
    )

    return release
  }

  private get app(): Release {
    const { spec, metadata } = this.config
    const { name, environment: namespace } = metadata
    const { env, vcs, database } = spec
    const registrySecret = providers.vault.getSecret<RegistryConfig>(`projects/${name}/${namespace}/registry`)
    const databaseSecret = providers.vault.getSecret<DatabaseConfig>(`projects/${name}/${namespace}/database`)

    return new helm.v3.Release(name, {
      ...defaultHelmReleaseOptions,
      ...chartMetadata(Charts.NODEJS),
      namespace,
      name,
      values: {
        app: {
          name: metadata.name,
          component: "app",
          environment: metadata.environment,
        },
        image: {
          pullPolicy: "Always",
          repository: `app`,
          tag: metadata.version,
          registry: registrySecret,
        },
        ingress: {
          host: this.domain,
          tls: { enabled: true },
          proxy: { paths: "", regex: false },
        },
        vcs: {
          repository: `https://github.com/bn-digital/${metadata.name}`,
          ref: process.env.GITHUB_REF_NAME,
          commit: process.env.GITHUB_SHA,
          ...vcs,
        },
        env,
        database: {
          ...database,
          enabled: metadata.environment === "production",
          auth: databaseSecret.apply(it => it as DatabaseConfig),
          primary: { priorityClassName: "system-node-critical" as PriorityClass },
          persistence: { size: `${spec.database?.volumeSizeGb ?? 2}Gi` },
          volumePermissions: { enabled: true },
        },
        nodeSelector: {
          [`doks.digitalocean.com/node-pool`]: spec.nodePoolName,
        },
      },
    })
  }

  release(spec: Partial<AppConfig> = {}): Release[] {
    this.config.spec = { ...this.config.spec, ...spec }
    return this.config.metadata.environment === "production"
      ? [this.ingressController, this.certManager, this.app]
      : [this.app]
  }
}

export { WebAppDeployment, ProjectArgs, Release }
