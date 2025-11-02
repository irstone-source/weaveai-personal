<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { onDestroy } from "svelte";

  // UI Components
  import Button from "$lib/components/ui/button/button.svelte";
  import { Badge } from "$lib/components/ui/badge/index.js";
  import * as Pagination from "$lib/components/ui/pagination/index.js";
  import * as Dialog from "$lib/components/ui/dialog/index.js";
  import * as Select from "$lib/components/ui/select/index.js";

  // Icons
  import {
    ImageIcon,
    VideoIcon,
    ArrowUpIcon,
    ChevronLeftIcon,
    ChevronRightIcon,
    XIcon,
    DownloadIcon,
    ExternalLinkIcon,
  } from "$lib/icons/index.js";

  import type { PageData } from "./$types.js";
  import * as m from "$lib/../paraglide/messages.js";

  let { data }: { data: PageData } = $props();

  // Type definitions
  type MediaItem = {
    id: string;
    filename: string;
    mimeType: string;
    fileSize: number;
    createdAt: string;
    chatId: string | null;
    chatTitle: string | null;
    chatModel: string | null;
    type: "image" | "video";
    duration?: number | null;
    resolution?: string | null;
    fps?: number | null;
    hasAudio?: boolean | null;
  };

  // Reactive state for filtering and pagination
  let filterType = $state<string>("all");
  let sortBy = $state<string>("newest");
  let currentPage = $state<number>(1);
  let itemsPerPage = $state<number>(12);

  // Lightbox state
  let lightboxOpen = $state<boolean>(false);
  let currentImageIndex = $state<number>(0);

  // Initialize state from URL parameters
  $effect(() => {
    const searchParams = page.url.searchParams;

    // Get filter type from URL
    const urlFilterType = searchParams.get("type");
    if (urlFilterType && ["all", "images", "videos"].includes(urlFilterType)) {
      filterType = urlFilterType;
    }

    // Get current page from URL
    const urlPage = searchParams.get("page");
    if (urlPage) {
      const pageNum = parseInt(urlPage, 10);
      if (pageNum > 0) {
        currentPage = pageNum;
      }
    }

    // Get items per page from URL
    const urlPerPage = searchParams.get("perPage");
    if (urlPerPage) {
      const perPageNum = parseInt(urlPerPage, 10);
      if ([12, 24, 48].includes(perPageNum)) {
        itemsPerPage = perPageNum;
      }
    }
  });

  // Derived content for Select triggers
  const filterTriggerContent = $derived(() => {
    if (filterType === "all") return `${m['library.all']()} ${m['library.types_suffix']()}`;
    if (filterType === "images") return m['library.images']();
    return m['library.videos']();
  });

  const sortTriggerContent = $derived(() => {
    return sortBy === "newest"
      ? `${m['library.newest']()} ${m['library.first_suffix']()}`
      : `${m['library.oldest']()} ${m['library.first_suffix']()}`;
  });

  const itemsPerPageTriggerContent = $derived(() => `${itemsPerPage} ${m['library.per_page_suffix']()}`);

  // Convert number to string for Select component binding
  let itemsPerPageString = $state('12'); // Default value matches itemsPerPage

  // Update string when number changes
  $effect(() => {
    itemsPerPageString = itemsPerPage.toString();
  });

  // Handle string to number conversion
  function handleItemsPerPageChange(value: string) {
    const numValue = parseInt(value, 10);
    if ([12, 24, 48].includes(numValue)) {
      itemsPerPage = numValue;
      itemsPerPageString = value;
    }
  }

  // Update URL when state changes
  $effect(() => {
    const searchParams = new URLSearchParams();

    // Only add parameters that differ from defaults to keep URLs clean
    if (filterType !== "all") {
      searchParams.set("type", filterType);
    }

    if (currentPage > 1) {
      searchParams.set("page", currentPage.toString());
    }

    if (itemsPerPage !== 12) {
      searchParams.set("perPage", itemsPerPage.toString());
    }

    const queryString = searchParams.toString();
    const newUrl = `/library${queryString ? "?" + queryString : ""}`;

    // Use window.location for immediate URL checking (page.url has sync delay)
    const currentPath = window.location.pathname + window.location.search;

    if (currentPath !== newUrl) {
      window.history.replaceState({}, "", newUrl);
    }
  });

  // Filter and sort media
  const filteredMedia = $derived(() => {
    let media: MediaItem[] = (data.library.media || []) as MediaItem[];

    // Apply type filter
    if (filterType === "images") {
      media = media.filter((item: MediaItem) => item.type === "image");
    } else if (filterType === "videos") {
      media = media.filter((item: MediaItem) => item.type === "video");
    }

    // Apply sorting
    if (sortBy === "newest") {
      media = media.sort(
        (a: MediaItem, b: MediaItem) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    } else if (sortBy === "oldest") {
      media = media.sort(
        (a: MediaItem, b: MediaItem) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
    }

    return media;
  });

  // Calculate total pages
  const totalPages = $derived(() => {
    return Math.ceil(filteredMedia().length / itemsPerPage);
  });

  // Get paginated media for current page
  const paginatedMedia = $derived(() => {
    const filtered = filteredMedia();
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filtered.slice(startIndex, endIndex);
  });

  // Get only images for lightbox navigation
  const lightboxImages = $derived(() => {
    return filteredMedia().filter(
      (item) => item.type === "image"
    ) as MediaItem[];
  });

  // Get current lightbox image
  const currentLightboxImage = $derived(() => {
    const images = lightboxImages();
    return images[currentImageIndex] || null;
  });

  // Reset to page 1 when filters change (but not items per page)
  let previousFilterType = $state("all");
  let previousSortBy = $state("newest");
  let isInitialized = $state(false);

  $effect(() => {
    // Skip the first run to avoid resetting on initial load
    if (!isInitialized) {
      previousFilterType = filterType;
      previousSortBy = sortBy;
      isInitialized = true;
      return;
    }

    // Reset page to 1 when filter type or sort changes
    if (filterType !== previousFilterType || sortBy !== previousSortBy) {
      currentPage = 1;
      previousFilterType = filterType;
      previousSortBy = sortBy;
    }

    // Also reset if current page exceeds total pages
    const maxPage = totalPages();
    if (currentPage > maxPage && maxPage > 0) {
      currentPage = 1;
    }
  });

  // Handle navigation to chat
  function navigateToChat(chatId: string) {
    if (chatId) {
      goto(`/chat/${chatId}`);
    }
  }

  // Lightbox functions
  function openLightbox(imageItem: MediaItem) {
    const images = lightboxImages();
    const imageIndex = images.findIndex((img) => img.id === imageItem.id);
    if (imageIndex >= 0) {
      currentImageIndex = imageIndex;
      lightboxOpen = true;
    }
  }

  function navigateToNext() {
    const images = lightboxImages();
    if (currentImageIndex < images.length - 1) {
      currentImageIndex++;
    }
  }

  function navigateToPrevious() {
    if (currentImageIndex > 0) {
      currentImageIndex--;
    }
  }

  function closeLightbox() {
    lightboxOpen = false;
  }

  // Keyboard navigation for lightbox
  $effect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (!lightboxOpen) return;

      switch (event.key) {
        case "ArrowLeft":
          event.preventDefault();
          navigateToPrevious();
          break;
        case "ArrowRight":
          event.preventDefault();
          navigateToNext();
          break;
        case "Escape":
          event.preventDefault();
          closeLightbox();
          break;
      }
    }

    // Add event listener when lightbox is open
    if (lightboxOpen) {
      window.addEventListener("keydown", handleKeyDown);

      return () => {
        window.removeEventListener("keydown", handleKeyDown);
      };
    }
  });

  // Cleanup effect to ensure scroll is restored on component unmount
  onDestroy(() => {
    // Close lightbox if it's open during component unmount
    if (lightboxOpen) {
      lightboxOpen = false;
    }
    // Reset any potential scroll lock that might still be applied
    if (typeof document !== "undefined") {
      document.body.style.overflow = "";
    }
  });

  // Format file size
  function formatFileSize(bytes: number): string {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }

  // Format date
  function formatDate(dateString: string): string {
    const date = new Date(dateString);
    return (
      date.toLocaleDateString() +
      " " +
      date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    );
  }

  // Get media URL
  function getMediaUrl(item: MediaItem): string {
    return `/api/${item.type === "image" ? "images" : "videos"}/${item.id}`;
  }

  // Download image function
  async function downloadImage(imageItem: MediaItem) {
    try {
      const response = await fetch(getMediaUrl(imageItem));
      if (!response.ok) {
        throw new Error("Failed to fetch image");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = imageItem.filename || `image-${imageItem.id}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Download failed:", error);
      // Could add toast notification here for user feedback
    }
  }

  // Open image in new tab function
  function openImageInNewTab(imageItem: MediaItem) {
    const imageUrl = getMediaUrl(imageItem);
    window.open(imageUrl, "_blank", "noopener,noreferrer");
  }
</script>

<svelte:head>
  <title>{m['library.title']()} - {m['library.subtitle']()}</title>
</svelte:head>

<main class="flex-1 p-6 overflow-auto">
  <div class="max-w-7xl mx-auto">
    <!-- Header -->
    <div class="mb-8">
      <h1 class="text-3xl font-bold mb-2">{m['library.title']()}</h1>
      <p class="text-muted-foreground">
        {m['library.description']()}
      </p>
    </div>

    <!-- Stats and Filters -->
    <div
      class="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
    >
      <!-- Stats -->
      <div class="flex items-center gap-4 text-sm text-muted-foreground">
        <span>{m['library.stats_total']()}: {data.library.total}</span>
        <span>{m['library.stats_images']()}: {data.library.images}</span>
        <span>{m['library.stats_videos']()}: {data.library.videos}</span>
      </div>

      <!-- Filters -->
      <div class="flex items-center gap-3 flex-wrap">
        <!-- Type Filter -->
        <Select.Root type="single" bind:value={filterType}>
          <Select.Trigger class="w-fit">
            {filterTriggerContent()}
          </Select.Trigger>
          <Select.Content>
            <Select.Item value="all">{m['library.all']()} {m['library.types_suffix']()}</Select.Item>
            <Select.Item value="images">{m['library.images']()}</Select.Item>
            <Select.Item value="videos">{m['library.videos']()}</Select.Item>
          </Select.Content>
        </Select.Root>

        <!-- Sort -->
        <Select.Root type="single" bind:value={sortBy}>
          <Select.Trigger class="w-fit">
            {sortTriggerContent()}
          </Select.Trigger>
          <Select.Content>
            <Select.Item value="newest">{m['library.newest']()} {m['library.first_suffix']()}</Select.Item>
            <Select.Item value="oldest">{m['library.oldest']()} {m['library.first_suffix']()}</Select.Item>
          </Select.Content>
        </Select.Root>

        <!-- Items Per Page -->
        <Select.Root type="single" value={itemsPerPageString} onValueChange={handleItemsPerPageChange}>
          <Select.Trigger class="w-fit">
            {itemsPerPageTriggerContent()}
          </Select.Trigger>
          <Select.Content>
            <Select.Item value="12">12 {m['library.per_page_suffix']()}</Select.Item>
            <Select.Item value="24">24 {m['library.per_page_suffix']()}</Select.Item>
            <Select.Item value="48">48 {m['library.per_page_suffix']()}</Select.Item>
          </Select.Content>
        </Select.Root>
      </div>
    </div>

    <!-- Error State -->
    {#if data.library.error}
      <div class="text-center py-12">
        <div class="bg-destructive/10 text-destructive p-4 rounded-lg">
          <p>{m['library.error_loading']()}: {data.library.error}</p>
        </div>
      </div>

      <!-- Empty State -->
    {:else if filteredMedia().length === 0}
      <div class="text-center py-12">
        <div class="flex justify-center mb-4">
          {#if filterType === "images"}
            <ImageIcon class="w-16 h-16 text-muted-foreground" />
          {:else if filterType === "videos"}
            <VideoIcon class="w-16 h-16 text-muted-foreground" />
          {:else}
            <div class="flex gap-2">
              <ImageIcon class="w-16 h-16 text-muted-foreground" />
              <VideoIcon class="w-16 h-16 text-muted-foreground" />
            </div>
          {/if}
        </div>

        <h3 class="text-lg font-semibold mb-2">
          {#if filterType === "all"}
            {m['library.no_content_found']({ type: 'content' })}
          {:else}
            {m['library.no_content_found']({ type: filterType })}
          {/if}
        </h3>
        <p class="text-muted-foreground mb-4">
          {#if filterType === "all"}
            {m['library.empty_description_all']()}
          {:else}
            {m['library.empty_description_filtered']({ type: filterType })}
          {/if}
        </p>

        <Button onclick={() => goto("/")}>{m['library.start_creating']()}</Button>
      </div>

      <!-- Media Grid -->
    {:else}
      <div
        class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
      >
        {#each paginatedMedia() as item (item.id)}
          {@const typedItem = item as MediaItem}
          <div
            class="group relative bg-card border rounded-lg overflow-hidden hover:shadow-lg transition-all duration-200"
          >
            <!-- Media Display -->
            <div class="aspect-square bg-muted relative overflow-hidden">
              {#if typedItem.type === "image"}
                <button
                  onclick={() => openLightbox(typedItem)}
                  class="cursor-pointer w-full h-full block focus:outline-none focus:ring-2 focus:ring-ring rounded-md relative group/image"
                >
                  <img
                    src={getMediaUrl(typedItem)}
                    alt=""
                    class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    loading="lazy"
                  />
                  <!-- Hover overlay to indicate clickable -->
                  <div
                    class="absolute inset-0 bg-black/0 group-hover/image:bg-black/10 transition-colors duration-200 flex items-center justify-center"
                  >
                    <div
                      class="opacity-0 group-hover/image:opacity-100 transition-opacity duration-200 bg-white/20 backdrop-blur-sm rounded-full p-2"
                    >
                      <ImageIcon class="w-5 h-5 text-white" />
                    </div>
                  </div>
                </button>
              {:else}
                <video
                  src={getMediaUrl(typedItem)}
                  class="w-full h-full object-cover"
                  muted
                  preload="metadata"
                >
                  <track kind="captions" />
                </video>
                <!-- Video overlay icon -->
                <div
                  class="absolute inset-0 flex items-center justify-center pointer-events-none"
                >
                  <div class="bg-black/50 rounded-full p-3">
                    <VideoIcon class="w-8 h-8 text-white" />
                  </div>
                </div>
              {/if}

              <!-- Type badge -->
              <div class="absolute top-2 left-2">
                <Badge
                  variant={typedItem.type === "image" ? "default" : "secondary"}
                  class="cursor-default text-xs"
                >
                  {#if typedItem.type === "image"}
                    <ImageIcon class="w-3 h-3 mr-1" />
                  {:else}
                    <VideoIcon class="w-3 h-3 mr-1" />
                  {/if}
                  {typedItem.type}
                </Badge>
              </div>

              <!-- Action Buttons (top-right corner) - Only for images -->
              {#if typedItem.type === "image"}
                <div
                  class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                >
                  <div class="flex gap-1">
                    <!-- Download Button -->
                    <button
                      onclick={(e) => {
                        e.stopPropagation();
                        downloadImage(typedItem);
                      }}
                      class="cursor-pointer p-1.5 bg-black/50 hover:bg-black/70 rounded backdrop-blur-sm text-white transition-colors"
                      title={m['library.download']()}
                    >
                      <DownloadIcon class="w-4 h-4" />
                    </button>

                    <!-- Open in New Tab Button -->
                    <button
                      onclick={(e) => {
                        e.stopPropagation();
                        openImageInNewTab(typedItem);
                      }}
                      class="cursor-pointer p-1.5 bg-black/50 hover:bg-black/70 rounded backdrop-blur-sm text-white transition-colors"
                      title={m['library.open_full']()}
                    >
                      <ExternalLinkIcon class="w-4 h-4" />
                    </button>
                  </div>
                </div>
              {/if}
            </div>

            <!-- Content Info -->
            <div class="cursor-default p-2.5">
              <!-- Chat link (if available) -->
              {#if typedItem.chatId && typedItem.chatTitle}
                <Button
                  variant="ghost"
                  size="sm"
                  class="cursor-pointer mb-1 p-1 h-auto"
                  onclick={() => navigateToChat(typedItem.chatId!)}
                >
                  {m['library.open_original_chat']()}
                  <ArrowUpIcon class="w-4 h-4 ml-1 flex-shrink-0 rotate-45" />
                </Button>
              {:else}
                <div class="text-sm text-muted-foreground mb-2 italic">
                  {m['library.no_chat_context']()}
                </div>
              {/if}

              <!-- Metadata -->
              <div class="space-y-1.5 text-xs text-muted-foreground">
                {#if typedItem.chatModel}
                  <div>
                    {m['library.model_label']()}: <span class="font-medium">{typedItem.chatModel}</span
                    >
                  </div>
                {/if}

                {#if typedItem.type === "video" && typedItem.duration}
                  <div>
                    {m['library.duration_label']()}: <span class="font-medium"
                      >{typedItem.duration}s</span
                    >
                  </div>
                {/if}

                {#if typedItem.resolution}
                  <div>
                    {m['library.resolution_label']()}: <span class="font-medium"
                      >{typedItem.resolution}</span
                    >
                  </div>
                {/if}

                <div>
                  {m['library.size_label']()}: <span class="font-medium"
                    >{formatFileSize(typedItem.fileSize)}</span
                  >
                </div>
                <div>
                  {m['library.created_label']()}: <span class="font-medium"
                    >{formatDate(typedItem.createdAt)}</span
                  >
                </div>
              </div>
            </div>
          </div>
        {/each}
      </div>

      <!-- Pagination Controls -->
      {#if totalPages() > 1}
        <div class="mt-8 flex flex-col items-center gap-4">
          <!-- Pagination Info -->
          <div class="text-sm text-muted-foreground">
            {m['library.showing_items']({
              start: ((currentPage - 1) * itemsPerPage + 1).toString(),
              end: Math.min(currentPage * itemsPerPage, filteredMedia().length).toString(),
              total: filteredMedia().length.toString()
            })}
          </div>

          <!-- Pagination Component -->
          <Pagination.Root
            count={filteredMedia().length}
            perPage={itemsPerPage}
            page={currentPage}
            onPageChange={(page) => {
              currentPage = page;
              // Scroll to top when page changes
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          >
            {#snippet children({ pages, currentPage: paginationCurrentPage })}
              <Pagination.Content>
                <Pagination.PrevButton />
                {#each pages as page}
                  {#if page.type === "ellipsis"}
                    <Pagination.Ellipsis />
                  {:else}
                    <Pagination.Link
                      {page}
                      isActive={paginationCurrentPage === page.value}
                    />
                  {/if}
                {/each}
                <Pagination.NextButton />
              </Pagination.Content>
            {/snippet}
          </Pagination.Root>
        </div>
      {/if}
    {/if}
  </div>
</main>

<!-- Image Lightbox -->
<Dialog.Root
  open={lightboxOpen}
  onOpenChange={(open) => {
    if (!open) closeLightbox();
  }}
>
  <Dialog.Content
    class="max-w-[95vw] max-h-[95vh] w-full h-full p-0 bg-black/95 border-0"
    showCloseButton={false}
  >
    {#if currentLightboxImage()}
      {@const image = currentLightboxImage()!}
      <div class="relative w-full h-full flex items-center justify-center">
        <!-- Close Button -->
        <button
          onclick={closeLightbox}
          class="absolute top-4 right-4 z-10 p-2 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors"
        >
          <XIcon class="w-5 h-5" />
        </button>

        <!-- Image Counter -->
        <div
          class="absolute top-4 left-4 z-10 px-3 py-2 bg-black/50 text-white text-sm rounded-md"
        >
          {m['library.lightbox_counter']({
            current: (currentImageIndex + 1).toString(),
            total: lightboxImages().length.toString()
          })}
        </div>

        <!-- Previous Button -->
        {#if currentImageIndex > 0}
          <button
            onclick={navigateToPrevious}
            class="absolute left-4 top-1/2 -translate-y-1/2 z-10 p-3 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors"
          >
            <ChevronLeftIcon class="w-6 h-6" />
          </button>
        {/if}

        <!-- Next Button -->
        {#if currentImageIndex < lightboxImages().length - 1}
          <button
            onclick={navigateToNext}
            class="absolute right-4 top-1/2 -translate-y-1/2 z-10 p-3 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors"
          >
            <ChevronRightIcon class="w-6 h-6" />
          </button>
        {/if}

        <!-- Main Image -->
        <img
          src={getMediaUrl(image)}
          alt=""
          class="max-w-full max-h-full object-contain"
          loading="lazy"
        />

        <!-- Image Info -->
        <div
          class="absolute bottom-4 left-4 right-4 z-10 bg-black/50 text-white p-4 rounded-md"
        >
          <div class="flex flex-col gap-2 text-sm">
            <div class="font-medium truncate">{image.filename}</div>
            {#if image.chatModel}
              <div class="text-white/80">{m['library.model_label']()}: {image.chatModel}</div>
            {/if}
            <div class="flex items-center gap-4 text-white/80 text-xs">
              <span>{m['library.size_label']()}: {formatFileSize(image.fileSize)}</span>
              <span>{m['library.created_label']()}: {formatDate(image.createdAt)}</span>
            </div>
          </div>
        </div>
      </div>
    {/if}
  </Dialog.Content>
</Dialog.Root>
