import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { adminSettingsService, getCloudStorageSettings } from './admin-settings';
import { storageService } from './storage';

const UPLOAD_DIR = 'static/uploads';
const BRANDING_DIR = join(UPLOAD_DIR, 'branding');

// Check if R2 cloud storage is available and configured
async function isCloudStorageEnabled(): Promise<boolean> {
  try {
    const settings = await getCloudStorageSettings();

    return !!(
      settings.r2_account_id &&
      settings.r2_access_key_id &&
      settings.r2_secret_access_key &&
      settings.r2_bucket_name
    );
  } catch (error) {
    console.error('Failed to check cloud storage settings:', error);
    return false;
  }
}


// Ensure upload directories exist
async function ensureUploadDirs() {
  if (!existsSync(UPLOAD_DIR)) {
    await mkdir(UPLOAD_DIR, { recursive: true });
  }
  if (!existsSync(BRANDING_DIR)) {
    await mkdir(BRANDING_DIR, { recursive: true });
  }
}

// Generate safe filename
function generateSafeFilename(originalName: string): string {
  const id = randomUUID();
  const ext = originalName.split('.').pop()?.toLowerCase() || '';
  return `${id}.${ext}`;
}

// Get file extension and validate
function validateImageFile(file: File): { valid: boolean; error?: string } {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
  const maxSize = 2 * 1024 * 1024; // 2MB
  
  if (!allowedTypes.includes(file.type)) {
    return { 
      valid: false, 
      error: 'Invalid file type. Please upload JPG, PNG, GIF, WebP, or SVG files.' 
    };
  }
  
  if (file.size > maxSize) {
    return { 
      valid: false, 
      error: 'File size must be less than 2MB.' 
    };
  }
  
  return { valid: true };
}

export interface UploadedFile {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  category: string;
  path: string;
  url: string;
}

export async function uploadBrandingFile(file: File, category: string = 'logo'): Promise<UploadedFile> {
  // Validate file
  const validation = validateImageFile(file);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // Generate safe filename
  const filename = generateSafeFilename(file.name);

  // Check if cloud storage is available
  const useCloudStorage = await isCloudStorageEnabled();

  if (useCloudStorage) {
    try {
      // Upload to R2 cloud storage
      console.log(`Uploading ${category} to R2 cloud storage`);

      const buffer = Buffer.from(await file.arrayBuffer());
      const storageFile = { buffer, mimeType: file.type, filename };

      // Upload using the StorageService branding-specific method
      const result = await storageService.uploadBrandingFile(storageFile, category);

      // Save file info to database
      const fileRecord = await adminSettingsService.saveFile({
        filename,
        originalName: file.name,
        mimeType: file.type,
        size: file.size,
        category,
        path: result.path,
        url: result.publicUrl || result.url,
        storageLocation: result.storageLocation
      });

      console.log(`Successfully uploaded ${category} to R2: ${result.publicUrl || result.url}`);

      return {
        id: fileRecord.id,
        filename: fileRecord.filename,
        originalName: fileRecord.originalName,
        mimeType: fileRecord.mimeType,
        size: fileRecord.size,
        category: fileRecord.category,
        path: fileRecord.path,
        url: fileRecord.url || result.publicUrl || result.url || '',
      };
    } catch (cloudError) {
      console.error(`Failed to upload ${category} to R2, falling back to local storage:`, cloudError);
      // Fall through to local storage
    }
  }

  // Fallback to local storage (or primary method if cloud storage disabled)
  console.log(`Uploading ${category} to local storage`);

  // Ensure directories exist
  await ensureUploadDirs();

  const filePath = join(BRANDING_DIR, filename);
  const publicUrl = `/uploads/branding/${filename}`;

  // Convert File to Buffer
  const buffer = Buffer.from(await file.arrayBuffer());

  // Write file to disk
  await writeFile(filePath, buffer);

  // Save file info to database
  const fileRecord = await adminSettingsService.saveFile({
    filename,
    originalName: file.name,
    mimeType: file.type,
    size: file.size,
    category,
    path: filePath,
    url: publicUrl,
    storageLocation: 'local'
  });

  return {
    id: fileRecord.id,
    filename: fileRecord.filename,
    originalName: fileRecord.originalName,
    mimeType: fileRecord.mimeType,
    size: fileRecord.size,
    category: fileRecord.category,
    path: fileRecord.path,
    url: fileRecord.url || publicUrl,
  };
}

export async function deleteBrandingFile(category: string): Promise<void> {
  // Get existing file
  const existingFile = await adminSettingsService.getFile(category);

  if (existingFile) {
    // Delete from storage based on storage location
    if (existingFile.storageLocation === 'r2') {
      try {
        console.log(`Deleting ${category} from R2 cloud storage: ${existingFile.path}`);
        await storageService.delete(existingFile.path);
        console.log(`Successfully deleted ${category} from R2`);
      } catch (error) {
        console.error(`Failed to delete ${category} from R2:`, error);
        // Continue with database cleanup even if cloud deletion fails
      }
    } else {
      // For local files, we'll leave them on disk to avoid breaking references
      // In production, you might want to implement a cleanup job
      console.log(`Skipping physical deletion of local file: ${existingFile.path}`);
    }

    // Delete from database
    await adminSettingsService.deleteFile(existingFile.id);
  }
}

// Helper function to get current branding file
export async function getCurrentBrandingFile(category: string): Promise<UploadedFile | null> {
  const file = await adminSettingsService.getFile(category);
  if (!file) return null;
  
  return {
    id: file.id,
    filename: file.filename,
    originalName: file.originalName,
    mimeType: file.mimeType,
    size: file.size,
    category: file.category,
    path: file.path,
    url: file.url || `/uploads/branding/${file.filename}`,
  };
}