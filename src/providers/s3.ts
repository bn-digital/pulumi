import { iam } from '@pulumi/aws'

function crudPolicy(bucket: string): iam.PolicyDocument {
  return {
    Version: '2012-10-17',
    Statement: [
      {
        Sid: 'CRUD',
        Effect: 'Allow',
        Principal: '*',
        Action: ['s3:PutObject', 's3:GetObject', 's3:ListBucket', 's3:DeleteObject', 's3:PutObjectAcl'],
        Resource: [`arn:aws:s3:::${bucket}`, `arn:aws:s3:::${bucket}/*`],
      },
    ],
  }
}

export { crudPolicy }
