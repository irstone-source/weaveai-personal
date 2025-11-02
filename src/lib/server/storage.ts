import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { writeFile, readFile, unlink, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
// Import environment variables with fallbacks for undefined vars
import { env } from '$env/dynamic/private';
const R2_ACCOUNT_ID = env.R2_ACCOUNT_ID || '';
const R2_ACCESS_KEY_ID = env.R2_ACCESS_KEY_ID || '';
const R2_SECRET_ACCESS_KEY = env.R2_SECRET_ACCESS_KEY || '';
const R2_BUCKET_NAME = env.R2_BUCKET_NAME || '';
const R2_PUBLIC_URL = env.R2_PUBLIC_URL || '';
import { getCloudStorageSettings } from './admin-settings';

export interface StorageFile {
	buffer: Buffer;
	mimeType: string;
	filename?: string;
}

export interface StorageResult {
	path: string;
	url?: string;
	storageLocation: 'local' | 'r2';
}

export interface StorageConfig {
	type: 'local' | 'r2';
	localPath?: string;
	r2Config?: {
		accountId: string;
		accessKeyId: string;
		secretAccessKey: string;
		bucketName: string;
		publicUrl?: string;
	};
}

export abstract class StorageProvider {
	abstract upload(file: StorageFile, path: string): Promise<StorageResult>;
	abstract download(path: string): Promise<Buffer>;
	abstract delete(path: string): Promise<void>;
	abstract getUrl(path: string): Promise<string>;
	abstract getPublicUrl(path: string): Promise<string>;
	abstract exists(path: string): Promise<boolean>;
}

export class LocalStorageProvider extends StorageProvider {
	private basePath: string;

	constructor(basePath: string = 'static/uploads') {
		super();
		this.basePath = basePath;
	}

	async upload(file: StorageFile, path: string): Promise<StorageResult> {
		const fullPath = join(process.cwd(), this.basePath, path);
		const dir = join(fullPath, '..');

		// Ensure directory exists
		if (!existsSync(dir)) {
			await mkdir(dir, { recursive: true });
		}

		await writeFile(fullPath, file.buffer);

		return {
			path: path,
			storageLocation: 'local'
		};
	}

	async download(path: string): Promise<Buffer> {
		const fullPath = join(process.cwd(), this.basePath, path);
		
		if (!existsSync(fullPath)) {
			throw new Error(`File not found: ${path}`);
		}

		return await readFile(fullPath);
	}

	async delete(path: string): Promise<void> {
		const fullPath = join(process.cwd(), this.basePath, path);
		
		if (existsSync(fullPath)) {
			await unlink(fullPath);
		}
	}

	async getUrl(path: string): Promise<string> {
		return `/${this.basePath}/${path}`;
	}

	async getPublicUrl(path: string): Promise<string> {
		// For local storage, public and private URLs are the same
		return this.getUrl(path);
	}

	async exists(path: string): Promise<boolean> {
		const fullPath = join(process.cwd(), this.basePath, path);
		return existsSync(fullPath);
	}
}

export class R2StorageProvider extends StorageProvider {
	private client: S3Client;
	private bucketName: string;
	private publicUrl?: string;

	constructor(config: StorageConfig['r2Config']) {
		super();
		
		if (!config) {
			throw new Error('R2 configuration is required');
		}

		this.bucketName = config.bucketName;
		this.publicUrl = config.publicUrl;

		this.client = new S3Client({
			region: 'auto',
			endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
			credentials: {
				accessKeyId: config.accessKeyId,
				secretAccessKey: config.secretAccessKey
			}
		});
	}

	async upload(file: StorageFile, path: string): Promise<StorageResult> {
		const command = new PutObjectCommand({
			Bucket: this.bucketName,
			Key: path,
			Body: file.buffer,
			ContentType: file.mimeType,
			ContentLength: file.buffer.length
		});

		await this.client.send(command);

		// Generate presigned URL for immediate access
		const url = await this.getUrl(path);

		return {
			path: path,
			url: url,
			storageLocation: 'r2'
		};
	}

	async download(path: string): Promise<Buffer> {
		const command = new GetObjectCommand({
			Bucket: this.bucketName,
			Key: path
		});

		const response = await this.client.send(command);
		
		if (!response.Body) {
			throw new Error(`File not found: ${path}`);
		}

		const chunks: Uint8Array[] = [];
		const reader = response.Body.transformToWebStream().getReader();

		try {
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				chunks.push(value);
			}
		} finally {
			reader.releaseLock();
		}

		return Buffer.concat(chunks);
	}

	async delete(path: string): Promise<void> {
		const command = new DeleteObjectCommand({
			Bucket: this.bucketName,
			Key: path
		});

		await this.client.send(command);
	}

	async getUrl(path: string, publicAccess: boolean = false): Promise<string> {
		// For branding assets (logos, favicons), return public URLs
		if (publicAccess && this.publicUrl) {
			return `${this.publicUrl}/${path}`;
		}

		// For security, return presigned URLs for authenticated access
		const command = new GetObjectCommand({
			Bucket: this.bucketName,
			Key: path
		});

		return await getSignedUrl(this.client, command, { expiresIn: 3600 }); // 1 hour
	}

	async getPublicUrl(path: string): Promise<string> {
		// Return public URL for branding assets that don't need authentication
		if (this.publicUrl) {
			return `${this.publicUrl}/${path}`;
		}

		// Fallback to presigned URL if no public URL configured
		return await this.getUrl(path, false);
	}

	async exists(path: string): Promise<boolean> {
		try {
			const command = new GetObjectCommand({
				Bucket: this.bucketName,
				Key: path
			});

			await this.client.send(command);
			return true;
		} catch (error) {
			return false;
		}
	}
}

class StorageService {
	private provider: StorageProvider | null = null;
	private config: StorageConfig | null = null;
	private initPromise: Promise<void> | null = null;

	constructor() {
		// Initialize async configuration
		this.initPromise = this.initialize();
	}

	private async initialize() {
		this.config = await this.getStorageConfig();
		this.provider = this.createProvider();
		console.log(`StorageService initialized: ${this.config.type} storage`);
	}

	private async ensureInitialized() {
		if (this.initPromise) {
			await this.initPromise;
			this.initPromise = null;
		}
	}

	private async getStorageConfig(): Promise<StorageConfig> {
		// 3-tier fallback logic:
		// 1. Admin dashboard settings (database)
		// 2. Environment variables (.env file)
		// 3. Local storage (fallback)

		try {
			// First, check admin dashboard settings
			const adminSettings = await getCloudStorageSettings();
			
			if (
				adminSettings.r2_account_id &&
				adminSettings.r2_access_key_id &&
				adminSettings.r2_secret_access_key &&
				adminSettings.r2_bucket_name
			) {
				console.log('✅ Using R2 configuration from admin dashboard settings');
				return {
					type: 'r2',
					r2Config: {
						accountId: adminSettings.r2_account_id,
						accessKeyId: adminSettings.r2_access_key_id,
						secretAccessKey: adminSettings.r2_secret_access_key,
						bucketName: adminSettings.r2_bucket_name,
						publicUrl: adminSettings.r2_public_url || undefined
					}
				};
			}
		} catch (error) {
			console.warn('⚠️  Failed to load admin settings for R2 configuration:', error);
		}

		// Second, check environment variables
		if (
			R2_ACCOUNT_ID &&
			R2_ACCESS_KEY_ID &&
			R2_SECRET_ACCESS_KEY &&
			R2_BUCKET_NAME
		) {
			console.log('✅ Using R2 configuration from environment variables');
			return {
				type: 'r2',
				r2Config: {
					accountId: R2_ACCOUNT_ID,
					accessKeyId: R2_ACCESS_KEY_ID,
					secretAccessKey: R2_SECRET_ACCESS_KEY,
					bucketName: R2_BUCKET_NAME,
					publicUrl: R2_PUBLIC_URL
				}
			};
		}

		// Third, fallback to local storage
		console.log('📁 Using local storage (no R2 configuration found)');
		return {
			type: 'local',
			localPath: 'static/uploads'
		};
	}

	private createProvider(): StorageProvider {
		if (!this.config) {
			throw new Error('Storage config not initialized');
		}

		if (this.config.type === 'r2') {
			try {
				const provider = new R2StorageProvider(this.config.r2Config);
				return provider;
			} catch (error) {
				console.error('❌ Failed to initialize R2 storage provider:', error);
				console.log('⚠️  Falling back to local storage');
				return new LocalStorageProvider(this.config.localPath);
			}
		}
		
		return new LocalStorageProvider(this.config.localPath);
	}

	generateFilePath(userId: string, fileType: 'images' | 'videos', filename: string, category: 'generated' | 'uploaded' = 'generated'): string {
		return `${userId}/${fileType}/${category}/${filename}`;
	}

	generateBrandingPath(category: string, filename: string): string {
		switch (category) {
			case 'logo-dark':
			case 'logo-light':
				return `branding/logos/${filename}`;
			case 'favicon':
				return `branding/favicon/${filename}`;
			default:
				return `branding/${filename}`;
		}
	}

	generateFilename(originalName: string): string {
		const id = randomUUID();
		const ext = originalName.split('.').pop()?.toLowerCase() || '';
		return `${id}.${ext}`;
	}

	async upload(file: StorageFile, userId: string, fileType: 'images' | 'videos', category: 'generated' | 'uploaded' = 'generated'): Promise<StorageResult> {
		await this.ensureInitialized();

		const filename = file.filename || this.generateFilename('file');
		const path = this.generateFilePath(userId, fileType, filename, category);

		console.log(`Uploading ${fileType} to ${this.config!.type} storage: ${path}`);

		try {
			const result = await this.provider!.upload(file, path);
			return result;
		} catch (error) {
			console.error(`Storage upload failed for ${fileType}:`, error);
			throw error;
		}
	}

	async uploadBrandingFile(file: StorageFile, category: string): Promise<StorageResult & { publicUrl?: string }> {
		await this.ensureInitialized();

		const filename = file.filename || this.generateFilename('branding');
		const path = this.generateBrandingPath(category, filename);

		console.log(`Uploading branding file (${category}) to ${this.config!.type} storage: ${path}`);

		try {
			const result = await this.provider!.upload(file, path);

			// For branding files, also get the public URL
			const publicUrl = await this.provider!.getPublicUrl(path);

			return {
				...result,
				publicUrl
			};
		} catch (error) {
			console.error(`Branding file upload failed for ${category}:`, error);
			throw error;
		}
	}

	async download(path: string): Promise<Buffer> {
		await this.ensureInitialized();
		return await this.provider!.download(path);
	}

	async delete(path: string): Promise<void> {
		await this.ensureInitialized();
		return await this.provider!.delete(path);
	}

	async getUrl(path: string): Promise<string> {
		await this.ensureInitialized();
		return await this.provider!.getUrl(path);
	}

	async getPublicUrl(path: string): Promise<string> {
		await this.ensureInitialized();
		return await this.provider!.getPublicUrl(path);
	}

	async exists(path: string): Promise<boolean> {
		await this.ensureInitialized();
		return await this.provider!.exists(path);
	}

	async getStorageType(): Promise<'local' | 'r2'> {
		await this.ensureInitialized();
		return this.config!.type;
	}

	// Migration helper for moving from local to R2
	async migrateFile(localPath: string, userId: string, fileType: 'images' | 'videos', filename: string, mimeType: string): Promise<StorageResult | null> {
		await this.ensureInitialized();
		
		if (this.config!.type !== 'r2') {
			return null;
		}

		const localProvider = new LocalStorageProvider();
		
		try {
			if (await localProvider.exists(localPath)) {
				const buffer = await localProvider.download(localPath);
				const result = await this.upload({ buffer, mimeType, filename }, userId, fileType);
				
				// Optionally delete local file after successful migration
				// await localProvider.delete(localPath);
				
				return result;
			}
		} catch (error) {
			console.error('Migration failed:', error);
			return null;
		}

		return null;
	}
}

// Export singleton instance
export const storageService = new StorageService();