import { helm, Provider } from "@pulumi/kubernetes"
import { Output } from "@pulumi/pulumi"
import { AppMetadata, Deployment } from "./pulumi"

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

export interface AppSpec {
  app: {
    name: string
    component: string
    environment: string
  }
  image: {
    pullPolicy: "Always" | "IfNotPresent" | "Never"
    repository: string
    tag: string
    registry: {
      url: string
      username: string
      password: string
    }
  }
  ingress: {
    host: string
    tls: { enabled: boolean; issuer: { enabled: boolean } }
    proxy: { paths: string; regex: boolean }
  }
  vcs: {
    repository: string
    ref: string
    commit: string
  }
  database: {
    enabled: boolean
    auth: {
      password: string
      postgresPassword: string
      username: string
      database: string
    }
    persistence: { size: string }
    volumePermissions: { enabled: boolean }
  }
}

class WebAppDeployment implements Deployment {
  private readonly metadata: AppMetadata
  private spec: Partial<AppSpec> = {}

  constructor(metadata: AppMetadata) {
    this.metadata = metadata
  }

  set context(kubeconfig: Output<string> | string) {
    new Provider(this.metadata.environment, { kubeconfig })
  }

  release(spec: AppSpec): helm.v3.Release[] {
    this.spec = spec
    return this.metadata.environment === "production"
      ? [this.ingressController, this.certManager, this.app]
      : [this.app]
  }

  private get ingressController(): helm.v3.Release {
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
              ["service.beta.kubernetes.io/do-loadbalancer-name"]: this.metadata.domain,
              ["service.beta.kubernetes.io/do-loadbalancer-protocol"]: "http2",
              ["service.beta.kubernetes.io/do-loadbalancer-http2-port"]: "443",
              ["service.beta.kubernetes.io/do-loadbalancer-redirect-http-to-https"]: "true",
              ["service.beta.kubernetes.io/do-loadbalancer-tls-passthrough"]: "true",
            },
          },
        },
      },
    })
  }

  private get certManager(): helm.v3.Release {
    const [name, namespace] = Releases.CERT_MANAGER.split("@")

    return new helm.v3.Release("cert-manager", {
      ...defaultHelmReleaseOptions,
      ...chartMetadata(Charts.CERT_MANAGER),
      name,
      namespace,
      values: {
        installCRDs: true,
        global: { priorityClassName: "system-cluster-critical" },
        metrics: {
          prometheus: {
            enabled: false,
          },
        },
      },
    })
  }

  private get app(): helm.v3.Release {
    const { name, environment: namespace } = this.metadata
    const { app, image, ingress, vcs, database } = this.spec
    return new helm.v3.Release(name, {
      ...defaultHelmReleaseOptions,
      ...chartMetadata(Charts.NODEJS),
      namespace,
      name,
      values: {
        app: {
          name: this.metadata.name,
          component: "app",
          environment: this.metadata.environment,
          ...app,
        },
        image: {
          pullPolicy: "Always",
          repository: `app`,
          tag: this.metadata.version,
          registry: {
            url: `dcr.bndigital.dev/${this.metadata.name}`,
            username: process.env.DOCKER_USERNAME,
            password: process.env.DOCKER_PASSWORD,
            ...image?.registry,
          },
          ...image,
        },
        ingress: {
          host: this.metadata.domain,
          tls: {
            enabled: true,
            issuer: { enabled: this.metadata.environment === "production", ...ingress?.tls?.issuer },
            ...ingress?.tls,
          },
          proxy: { paths: "", regex: false },
          ...ingress,
        },
        vcs: {
          repository: `https://github.com/bn-digital/${this.metadata.name}`,
          ref: process.env.GITHUB_REF_NAME,
          commit: process.env.GITHUB_SHA,
          ...vcs,
        },
        database: {
          enabled: this.metadata.environment === "production",
          auth: {
            password: process.env.DATABASE_ROOT_PASSWORD,
            postgresPassword: process.env.DATABASE_ROOT_PASSWORD,
            username: this.metadata.name,
            database: this.metadata.name,
            ...database?.auth,
          },
          primary: { priorityClassName: "system-node-critical" },
          persistence: { size: "2Gi" },
          volumePermissions: { enabled: true },
          ...database,
        },
      },
    })
  }
}

export { WebAppDeployment, AppMetadata }
