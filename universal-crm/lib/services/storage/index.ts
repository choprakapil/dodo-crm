/**
 * Storage Service Abstraction — Cloudflare R2 (S3-Compatible) Production Driver
 *
 * ADR-010: Abstract StorageService interface backed by @aws-sdk/client-s3.
 *
 * Production Invariants:
 * - When STORAGE_PROVIDER=r2, STORAGE_BUCKET, STORAGE_ACCESS_KEY, STORAGE_SECRET_KEY,
 *   and STORAGE_ENDPOINT are strictly required. Missing credentials FAIL CLOSED.
 * - Silent downgrade to local filesystem is FORBIDDEN.
 * - STORAGE_PROVIDER=local is permitted ONLY in non-production environments (dev/test/self-hosted).
 * - Attempting to perform storage operations via LocalStorageService in production strictly throws a ServiceConfigurationError.
 *
 * Tenant Storage Isolation (Namespace Isolation):
 * - Every tenant-owned storage key is structurally namespaced: {companyId}/{folder}/{filename}.
 * - The storage layer requires an authorized companyId from server context (never arbitrary client headers/body).
 * - Path traversal (../, ..\, ., slashes) is strictly sanitized and rejected.
 * - Presigned URLs are private with bounded expiration (max 24 hours).
 * - Tenant ownership validation is enforced on retrieval and deletion.
 */

import path from "path";
import crypto from "crypto";
import fs from "fs/promises";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { logger } from "@/lib/logger";

// =============================================================================
// ERRORS
// =============================================================================

export class ServiceConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ServiceConfigurationError";
  }
}

export class TenantIsolationViolationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TenantIsolationViolationError";
  }
}

// =============================================================================
// INTERFACES
// =============================================================================

export interface UploadOptions {
  buffer: Buffer;
  filename: string;
  mimeType: string;
  folder?: string;        // e.g. "leads", "logos", "avatars"
  companyId: string;      // REQUIRED: Authenticated tenant ID from server context
  customSubPath?: string; // Optional custom sub-path within tenant namespace
}

export interface UploadResult {
  key: string;    // Structurally namespaced storage key: "{companyId}/{folder}/{filename}"
  url: string;    // Presigned private access URL
  size: number;
}

export interface StorageService {
  upload(options: UploadOptions): Promise<UploadResult>;
  delete(key: string, expectedCompanyId?: string): Promise<void>;
  getUrl(key: string, options?: { expiresInSeconds?: number; expectedCompanyId?: string }): Promise<string>;
  getSignedUrl(key: string, options?: { expiresInSeconds?: number; expectedCompanyId?: string }): Promise<string>;
  getTenantSignedUrl(companyId: string, key: string, expiresInSeconds?: number): Promise<string>;
}

// =============================================================================
// ALLOWED MIME TYPES & VALIDATION
// =============================================================================

export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

export const ALLOWED_DOCUMENT_TYPES = [
  "text/csv",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/pdf",
] as const;

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

export function validateFileUpload(
  mimeType: string,
  size: number,
  allowedTypes: readonly string[] = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_DOCUMENT_TYPES]
): { valid: boolean; error?: string } {
  if (!allowedTypes.includes(mimeType)) {
    return {
      valid: false,
      error: `File type not allowed. Allowed types: ${allowedTypes.join(", ")}`,
    };
  }
  if (size <= 0) {
    return {
      valid: false,
      error: "File is empty.",
    };
  }
  if (size > MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: `File too large. Maximum size: ${MAX_FILE_SIZE_BYTES / 1024 / 1024}MB`,
    };
  }
  return { valid: true };
}

// =============================================================================
// TENANT NAMESPACE ISOLATION & SANITIZATION HELPERS
// =============================================================================

/**
 * Validates that an object key belongs to the expected tenant.
 * Throws TenantIsolationViolationError if a cross-tenant key is accessed.
 */
export function validateTenantKey(expectedCompanyId: string, key: string): string {
  if (!expectedCompanyId || typeof expectedCompanyId !== "string" || !expectedCompanyId.trim()) {
    throw new TenantIsolationViolationError("Tenant validation failed: expectedCompanyId must be a non-empty string.");
  }
  const sanitizedExpected = expectedCompanyId.trim().replace(/^\/+|\/+$/g, "");
  const cleanKey = key.trim().replace(/^\/+/, "");

  if (!cleanKey.startsWith(`${sanitizedExpected}/`)) {
    throw new TenantIsolationViolationError(
      `Access denied: Cross-tenant storage access attempted. Key '${cleanKey}' does not belong to company '${sanitizedExpected}'.`
    );
  }

  // Reject path traversal tokens
  const keyParts = cleanKey.split(/[/\\]+/);
  if (keyParts.some((part) => part === ".." || part === ".")) {
    throw new TenantIsolationViolationError(
      `Access denied: Path traversal detected in storage key '${key}'.`
    );
  }

  return cleanKey;
}

/**
 * Builds a structurally namespaced storage key:
 *   {companyId}/{folder}/{sanitizedBaseName}-{randomHex}{extension}
 *
 * Enforces:
 * - Non-empty companyId strictly matching [a-zA-Z0-9_-]
 * - Path traversal rejection (no '..', '.', leading/trailing slashes)
 * - Safe alphanumeric folder and filename sanitization
 */
export function buildCompanyStorageKey(
  companyId: string,
  folder: string,
  filename: string,
  customSubPath?: string
): string {
  if (!companyId || typeof companyId !== "string" || !companyId.trim()) {
    throw new TenantIsolationViolationError("Tenant isolation violation: companyId is strictly required for storage operations.");
  }

  const sanitizedCompanyId = companyId.trim().replace(/^\/+|\/+$/g, "");
  if (!/^[a-zA-Z0-9_-]+$/.test(sanitizedCompanyId)) {
    throw new TenantIsolationViolationError(
      `Tenant isolation violation: companyId contains illegal characters: '${companyId}'.`
    );
  }

  if (customSubPath) {
    // Sanitize custom subpath against directory traversal
    const cleanSubPath = customSubPath
      .split(/[/\\]+/)
      .map((part) => part.trim())
      .filter((part) => part.length > 0 && part !== "." && part !== "..")
      .join("/");

    if (!cleanSubPath) {
      throw new TenantIsolationViolationError("Tenant isolation violation: customSubPath resolved to an empty path.");
    }

    if (cleanSubPath.startsWith(`${sanitizedCompanyId}/`)) {
      return cleanSubPath;
    }
    // Structural namespace isolation
    return `${sanitizedCompanyId}/${cleanSubPath}`;
  }

  // Sanitize folder path: eliminate directory traversal and special chars
  const cleanFolder = (folder || "files")
    .split(/[/\\]+/)
    .map((part) => part.trim().replace(/[^a-zA-Z0-9_-]/g, ""))
    .filter((part) => part.length > 0 && part !== "." && part !== "..")
    .join("/") || "files";

  // Sanitize filename & extension
  const rawBaseName = path.basename(filename || "file");
  const rawExt = path.extname(rawBaseName).toLowerCase();
  const safeExt = rawExt.replace(/[^a-z0-9.]/g, "");
  const baseWithoutExt = path.basename(rawBaseName, rawExt);
  const safeBaseName = baseWithoutExt.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 50) || "file";
  const uniqueId = crypto.randomBytes(8).toString("hex");
  const finalFilename = `${safeBaseName}-${uniqueId}${safeExt}`;

  // Structural namespace isolation
  return `${sanitizedCompanyId}/${cleanFolder}/${finalFilename}`;
}

// =============================================================================
// CLOUDFLARE R2 (S3-COMPATIBLE) IMPLEMENTATION
// =============================================================================

export class R2StorageService implements StorageService {
  private client: S3Client | null = null;
  private bucket: string;
  private configError: string | null = null;

  constructor() {
    const provider = process.env.STORAGE_PROVIDER;
    const bucket = process.env.STORAGE_BUCKET;
    const accessKey = process.env.STORAGE_ACCESS_KEY;
    const secretKey = process.env.STORAGE_SECRET_KEY;
    const endpoint = process.env.STORAGE_ENDPOINT;

    const missing: string[] = [];
    if (process.env.NODE_ENV === "production" && (!provider || !provider.trim())) {
      missing.push("STORAGE_PROVIDER");
    }
    if (!bucket || !bucket.trim()) missing.push("STORAGE_BUCKET");
    if (!accessKey || !accessKey.trim()) missing.push("STORAGE_ACCESS_KEY");
    if (!secretKey || !secretKey.trim()) missing.push("STORAGE_SECRET_KEY");
    if (!endpoint || !endpoint.trim()) missing.push("STORAGE_ENDPOINT");

    if (missing.length > 0) {
      this.configError = `Missing required Cloudflare R2 environment variables: ${missing.join(", ")} must be set when STORAGE_PROVIDER=r2.`;
      this.bucket = bucket || "";
    } else {
      this.bucket = bucket!;
      this.client = new S3Client({
        region: process.env.STORAGE_REGION ?? "auto",
        endpoint: endpoint!,
        credentials: {
          accessKeyId: accessKey!,
          secretAccessKey: secretKey!,
        },
        forcePathStyle: true,
      });
    }
  }

  private ensureConfigured(): void {
    if (this.configError || !this.client) {
      const msg = `[StorageService Configuration Error] ${this.configError ?? "R2 client uninitialized."}`;
      console.error(msg);
      throw new ServiceConfigurationError(this.configError ?? "Storage service misconfigured.");
    }
  }

  async upload(options: UploadOptions): Promise<UploadResult> {
    this.ensureConfigured();

    const validation = validateFileUpload(options.mimeType, options.buffer.length);
    if (!validation.valid) {
      throw new Error(`File upload validation failed: ${validation.error}`);
    }

    // 1. Build structurally namespaced key: {companyId}/{folder}/{filename}
    const key = buildCompanyStorageKey(
      options.companyId,
      options.folder ?? "files",
      options.filename,
      options.customSubPath
    );

    // 2. PutObject to Cloudflare R2 / S3
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: options.buffer,
      ContentType: options.mimeType,
    });

    await this.client!.send(command);

    // 3. Generate presigned URL for private access (default 1 hour = 3600s)
    const url = await this.getTenantSignedUrl(options.companyId, key, 3600);

    return {
      key,
      url,
      size: options.buffer.length,
    };
  }

  async delete(key: string, expectedCompanyId?: string): Promise<void> {
    this.ensureConfigured();

    if (expectedCompanyId) {
      validateTenantKey(expectedCompanyId, key);
    }

    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    try {
      await this.client!.send(command);
    } catch (err: any) {
      logger.warn("Storage object deletion failed", {
        service: "StorageService",
        provider: "r2",
        operation: "delete",
        key,
        errorMessage: err?.message,
      });
    }
  }

  async getSignedUrl(
    key: string,
    options?: { expiresInSeconds?: number; expectedCompanyId?: string }
  ): Promise<string> {
    this.ensureConfigured();

    if (options?.expectedCompanyId) {
      validateTenantKey(options.expectedCompanyId, key);
    }

    // Bound expiration to safe limits (between 1 second and 86400 seconds / 24 hours)
    const rawExpiry = options?.expiresInSeconds ?? 3600;
    const boundedExpiry = Math.min(Math.max(1, rawExpiry), 86400);

    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    return getSignedUrl(this.client!, command, { expiresIn: boundedExpiry });
  }

  async getUrl(
    key: string,
    options?: { expiresInSeconds?: number; expectedCompanyId?: string }
  ): Promise<string> {
    return this.getSignedUrl(key, options);
  }

  async getTenantSignedUrl(
    companyId: string,
    key: string,
    expiresInSeconds: number = 3600
  ): Promise<string> {
    return this.getSignedUrl(key, { expiresInSeconds, expectedCompanyId: companyId });
  }
}

// =============================================================================
// LOCAL FILESYSTEM IMPLEMENTATION (Dev/Test Fallback — Forbidden in Production)
// =============================================================================

export class LocalStorageService implements StorageService {
  private basePath: string;
  private baseUrl: string;

  constructor() {
    this.basePath = path.resolve(
      process.cwd(),
      process.env.STORAGE_LOCAL_PATH ?? "./uploads"
    );
    this.baseUrl = process.env.APP_URL ?? "http://localhost:3000";
  }

  private assertNotProduction(): void {
    if (process.env.NODE_ENV === "production") {
      throw new ServiceConfigurationError(
        "CRITICAL: STORAGE_PROVIDER='local' cannot be executed in production. Production must use STORAGE_PROVIDER='r2'."
      );
    }
  }

  private async ensureDir(dir: string): Promise<void> {
    await fs.mkdir(dir, { recursive: true });
  }

  async upload(options: UploadOptions): Promise<UploadResult> {
    this.assertNotProduction();

    const validation = validateFileUpload(options.mimeType, options.buffer.length);
    if (!validation.valid) {
      throw new Error(`File upload validation failed: ${validation.error}`);
    }

    // Enforce tenant key isolation locally as well
    const key = buildCompanyStorageKey(
      options.companyId,
      options.folder ?? "files",
      options.filename,
      options.customSubPath
    );
    const filePath = path.join(this.basePath, key);

    await this.ensureDir(path.dirname(filePath));
    await fs.writeFile(filePath, options.buffer);

    return {
      key,
      url: `${this.baseUrl}/uploads/${key}`,
      size: options.buffer.length,
    };
  }

  async delete(key: string, expectedCompanyId?: string): Promise<void> {
    this.assertNotProduction();

    if (expectedCompanyId) {
      validateTenantKey(expectedCompanyId, key);
    }

    const filePath = path.join(this.basePath, key);
    try {
      await fs.unlink(filePath);
    } catch {
      // Ignore if file doesn't exist
    }
  }

  async getSignedUrl(
    key: string,
    options?: { expiresInSeconds?: number; expectedCompanyId?: string }
  ): Promise<string> {
    this.assertNotProduction();

    if (options?.expectedCompanyId) {
      validateTenantKey(options.expectedCompanyId, key);
    }
    return `${this.baseUrl}/uploads/${key}`;
  }

  async getUrl(
    key: string,
    options?: { expiresInSeconds?: number; expectedCompanyId?: string }
  ): Promise<string> {
    return this.getSignedUrl(key, options);
  }

  async getTenantSignedUrl(
    companyId: string,
    key: string,
    expiresInSeconds: number = 3600
  ): Promise<string> {
    return this.getSignedUrl(key, { expiresInSeconds, expectedCompanyId: companyId });
  }
}

// =============================================================================
// FACTORY
// =============================================================================

export function createStorageService(): StorageService {
  const provider = (process.env.STORAGE_PROVIDER ?? "r2").toLowerCase().trim();

  if (provider === "local") {
    return new LocalStorageService();
  }

  if (provider === "r2" || provider === "s3") {
    return new R2StorageService();
  }

  throw new ServiceConfigurationError(
    `Unsupported STORAGE_PROVIDER='${provider}'. Valid options: 'r2' (production) or 'local' (dev/test only).`
  );
}

export const storageService = createStorageService();
