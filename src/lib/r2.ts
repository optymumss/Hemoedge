import { S3Client } from "@aws-sdk/client-s3";

export const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME!;
export const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL!;

export const r2Client = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

/** Public R2 objects are addressed by URL directly (no signing needed for
 * reads); Storage-key-based legacy Supabase files aren't. Callers branch on
 * this to tell a slide's file_path apart from the pre-migration convention. */
export function isR2Url(filePath: string): boolean {
  return filePath.startsWith("http://") || filePath.startsWith("https://");
}

export function r2PublicUrl(key: string): string {
  return `${R2_PUBLIC_URL}/${key}`;
}

export function r2KeyFromPublicUrl(url: string): string {
  return url.slice(`${R2_PUBLIC_URL}/`.length);
}
