import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const sanitizeEnvValue = (value?: string | null) =>
  value ? value.replace(/[\r\n]+/g, '').trim() : undefined;

const awsRegion = sanitizeEnvValue(process.env.AWS_REGION) || 'us-east-2';
const awsAccessKeyId = sanitizeEnvValue(process.env.AWS_ACCESS_KEY_ID) || '';
const awsSecretAccessKey = sanitizeEnvValue(process.env.AWS_SECRET_ACCESS_KEY) || '';

export const s3Client = new S3Client({
  region: awsRegion,
  credentials: {
    accessKeyId: awsAccessKeyId,
    secretAccessKey: awsSecretAccessKey,
  },
});

export async function uploadToS3(bucket: string, key: string, file: Buffer | Uint8Array, contentType?: string) {
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: file,
    ContentType: contentType,
  });

  return await s3Client.send(command);
}

export async function getPresignedUrl(bucket: string, key: string, expiresIn: number = 3600) {
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  });

  return await getSignedUrl(s3Client, command, { expiresIn });
}

export async function deleteFromS3(bucket: string, key: string) {
  const command = new DeleteObjectCommand({
    Bucket: bucket,
    Key: key,
  });

  return await s3Client.send(command);
}

export async function listS3Objects(bucket: string, prefix?: string) {
  const command = new ListObjectsV2Command({
    Bucket: bucket,
    Prefix: prefix,
  });

  return await s3Client.send(command);
}

export function createOrderFolderPath(orderNumber: string): string {
  return `orders/${orderNumber}/`;
}

export function getS3BucketName(): string {
  return process.env.S3_BUCKET_NAME || 'ac-qrdocs-prod';
}
