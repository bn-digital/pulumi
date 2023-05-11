# Pulumi

## Overview

This is bundle of reusable Pulumi Typescript components, supporting IT operations, infrastructure provisioning and project configuration.

## Usage

### Authentication

Pulumi stores metadata about your infrastructure so that it can manage your cloud resources. This metadata is called state. Each stack has its own state, and state is how Pulumi knows when and how to create, read, delete, or update cloud resources.

To store backend in S3, we need to authenticate first. Use AWS cli to create fake profile with S3 credentials from DigitalOcean spaces:

> If you don't have `aws` command, install cli with scoop: `scoop install awscli`

```shell
aws configure --profile digitalocean
```
You will be prompted with following questions:

- AWS Access Key ID [None]: **DigitalOcean Spaces access key**
- AWS Secret Access Key [None]: **DigitalOcean Spaces secret key**
- Default region name [None]: **fra1**
- Default output format [None]: **json**

After that, you can login to Pulumi backend:

```shell
pulumi login 's3://bn-digital/pulumi/<project-name>?endpoint=fra1.digitaloceanspaces.coM&disableSSL=true&s3ForcePathStyle=true&profile=digitalocean'
```
