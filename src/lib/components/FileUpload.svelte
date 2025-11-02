<script lang="ts">
  import {
    FileIcon,
    FileTextIcon,
    ImageIcon,
    XIcon,
  } from "$lib/icons/index.js";
  import { toast } from "svelte-sonner";

  // Props
  interface FileUploadProps {
    onFilesSelected?: (files: UploadedFile[]) => void;
    acceptedTypes?: string[];
    maxFileSize?: number; // in bytes
    maxFiles?: number;
    showPreviews?: boolean;
    class?: string;
  }

  let {
    onFilesSelected = () => {},
    acceptedTypes = [
      "image/png",
      "image/jpeg",
      "image/jpg",
      "image/gif",
      "image/webp",
      "text/plain",
      "text/markdown",
      "text/csv",
      "application/json",
    ],
    maxFileSize = 10 * 1024 * 1024, // 10MB default
    maxFiles = 5,
    showPreviews = true,
    class: className = "",
  }: FileUploadProps = $props();

  // State
  let isDragOver = $state(false);
  let fileInput = $state<HTMLInputElement>();
  let uploadedFiles = $state<UploadedFile[]>([]);

  // Types
  interface UploadedFile {
    id: string;
    file: File;
    name: string;
    size: number;
    type: string;
    dataUrl?: string;
    content?: string; // For text files
    isLoading?: boolean;
  }

  // File validation
  function validateFile(file: File): boolean {
    // Check file type
    if (!acceptedTypes.includes(file.type)) {
      toast.error(`File type ${file.type} is not supported`);
      return false;
    }

    // Check file size
    if (file.size > maxFileSize) {
      toast.error(
        `File size exceeds ${Math.round(maxFileSize / (1024 * 1024))}MB limit`
      );
      return false;
    }

    return true;
  }

  // Process files
  async function processFiles(files: FileList) {
    const validFiles = Array.from(files).filter(validateFile);

    // Check max files limit
    if (uploadedFiles.length + validFiles.length > maxFiles) {
      toast.error(`Maximum ${maxFiles} files allowed`);
      return;
    }

    for (const file of validFiles) {
      const uploadedFile: UploadedFile = {
        id: crypto.randomUUID(),
        file,
        name: file.name,
        size: file.size,
        type: file.type,
        isLoading: true,
      };

      uploadedFiles = [...uploadedFiles, uploadedFile];

      try {
        if (file.type.startsWith("image/")) {
          // For images, create data URL for preview
          const reader = new FileReader();
          reader.onload = (e) => {
            const index = uploadedFiles.findIndex(
              (f) => f.id === uploadedFile.id
            );
            if (index !== -1) {
              uploadedFiles[index] = {
                ...uploadedFiles[index],
                dataUrl: e.target?.result as string,
                isLoading: false,
              };
              uploadedFiles = [...uploadedFiles];
              // Notify parent when file processing is complete
              if (uploadedFiles.every((f) => !f.isLoading)) {
                notifyFilesChanged();
              }
            }
          };
          reader.readAsDataURL(file);
        } else if (
          file.type.startsWith("text/") ||
          file.type === "application/json"
        ) {
          // For text files, read content
          const reader = new FileReader();
          reader.onload = (e) => {
            const index = uploadedFiles.findIndex(
              (f) => f.id === uploadedFile.id
            );
            if (index !== -1) {
              uploadedFiles[index] = {
                ...uploadedFiles[index],
                content: e.target?.result as string,
                isLoading: false,
              };
              uploadedFiles = [...uploadedFiles];
              // Notify parent when file processing is complete
              if (uploadedFiles.every((f) => !f.isLoading)) {
                notifyFilesChanged();
              }
            }
          };
          reader.readAsText(file);
        } else {
          // For other file types, just mark as loaded
          const index = uploadedFiles.findIndex(
            (f) => f.id === uploadedFile.id
          );
          if (index !== -1) {
            uploadedFiles[index] = {
              ...uploadedFiles[index],
              isLoading: false,
            };
            uploadedFiles = [...uploadedFiles];
            // Notify parent when file processing is complete
            if (uploadedFiles.every((f) => !f.isLoading)) {
              notifyFilesChanged();
            }
          }
        }
      } catch (error) {
        console.error("Error processing file:", error);
        removeFile(uploadedFile.id);
        toast.error(`Failed to process ${file.name}`);
      }
    }
  }

  // Remove file
  function removeFile(fileId: string) {
    uploadedFiles = uploadedFiles.filter((f) => f.id !== fileId);
    // Don't auto-notify when removing files, only when user explicitly removes
    // The parent will handle removal from global state
  }

  // Notify parent of file changes and clear local state
  function notifyFilesChanged() {
    const completedFiles = uploadedFiles.filter((f) => !f.isLoading);
    onFilesSelected(completedFiles);
    // Clear local state after notifying parent to prevent duplication
    uploadedFiles = [];
  }

  // Export function to allow parent to clear files if needed
  export function clearFiles() {
    uploadedFiles = [];
  }

  // No reactive effect - we'll call notifyFilesChanged directly when needed

  // Handle drag and drop
  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    isDragOver = true;
  }

  function handleDragLeave(e: DragEvent) {
    e.preventDefault();
    isDragOver = false;
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    isDragOver = false;

    if (e.dataTransfer?.files) {
      processFiles(e.dataTransfer.files);
    }
  }

  // Handle file input change
  function handleFileInputChange(e: Event) {
    const target = e.target as HTMLInputElement;
    if (target.files) {
      processFiles(target.files);
    }
  }

  // Trigger file input
  function triggerFileInput() {
    fileInput?.click();
  }

  // Get file icon
  function getFileIcon(fileType: string) {
    if (fileType.startsWith("image/")) {
      return ImageIcon;
    } else if (
      fileType.startsWith("text/") ||
      fileType === "application/json"
    ) {
      return FileTextIcon;
    } else {
      return FileIcon;
    }
  }

  // Format file size
  function formatFileSize(bytes: number): string {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }
</script>

<!-- Hidden file input -->
<input
  bind:this={fileInput}
  type="file"
  multiple
  accept={acceptedTypes.join(",")}
  onchange={handleFileInputChange}
  class="hidden"
/>

<!-- File upload area -->
<div class={`file-upload-container ${className}`}>
  <!-- Drag and drop zone -->
  <div
    class="cursor-pointer border-2 border-dashed rounded-lg p-4 transition-colors {isDragOver
      ? 'border-primary bg-primary/5'
      : 'border-muted-foreground/25 hover:border-muted-foreground/50'}"
    ondragover={handleDragOver}
    ondrop={handleDrop}
    ondragleave={handleDragLeave}
    role="button"
    tabindex="0"
    onclick={triggerFileInput}
    onkeydown={(e) => e.key === "Enter" && triggerFileInput()}
  >
    <div class="text-center">
      <div class="text-muted-foreground text-sm">
        Drop files here or click to browse
      </div>
      <div class="text-xs text-muted-foreground/75 mt-1">
        Images, text files (max {Math.round(maxFileSize / (1024 * 1024))}MB
        each)
      </div>
    </div>
  </div>

  <!-- File previews - only show while processing -->
  {#if showPreviews && uploadedFiles.length > 0}
    <div class="mt-3 space-y-2">
      {#each uploadedFiles as file (file.id)}
        <div class="flex items-center gap-3 p-2 bg-muted/50 rounded-lg">
          <!-- File icon or image preview -->
          <div class="flex-shrink-0">
            {#if file.type.startsWith("image/") && file.dataUrl && !file.isLoading}
              <img
                src={file.dataUrl}
                alt={file.name}
                class="w-10 h-10 object-cover rounded"
              />
            {:else}
              {@const IconComponent = getFileIcon(file.type)}
              <div
                class="w-10 h-10 flex items-center justify-center bg-background rounded"
              >
                <IconComponent class="w-5 h-5 text-muted-foreground" />
              </div>
            {/if}
          </div>

          <!-- File info -->
          <div class="flex-1 min-w-0">
            <div class="text-sm font-medium truncate">{file.name}</div>
            <div class="text-xs text-muted-foreground">
              {formatFileSize(file.size)}
              {#if file.isLoading}
                · Processing...
              {:else}
                · Ready
              {/if}
            </div>
          </div>

          <!-- Remove button -->
          <button
            onclick={() => removeFile(file.id)}
            class="flex-shrink-0 p-1 hover:bg-background rounded transition-colors"
            type="button"
            aria-label="Remove file"
          >
            <XIcon
              class="w-4 h-4 text-muted-foreground hover:text-foreground"
            />
          </button>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .file-upload-container {
    width: 100%;
  }
</style>
