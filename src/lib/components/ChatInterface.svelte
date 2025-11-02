<script lang="ts">
  // UI Component imports
  import * as Select from "$lib/components/ui/select/index.js";
  import * as Tooltip from "$lib/components/ui/tooltip/index.js";
  import Button from "$lib/components/ui/button/button.svelte";
  import Skeleton from "$lib/components/ui/skeleton/skeleton.svelte";
  import PromptRefiner from "$lib/components/PromptRefiner.svelte";

  // Icon imports
  import {
    ArrowUpIcon,
    CircleCheckIcon,
    ImageIcon,
    TypeIcon,
    VideoIcon,
    Settings2Icon,
    BulbIcon,
    CodeIcon,
    AnalyticsIcon,
    MessageCircleIcon,
    SquarePlusIcon,
    XIcon,
    FileIcon,
    ChevronDownIcon,
    SparkleIcon,
  } from "$lib/icons/index.js";

  // Application types and config
  import type { AIModelConfig } from "$lib/ai/types.js";
  import { providerConfig } from "$lib/config/provider-icons.js";
  import { GUEST_MESSAGE_LIMIT } from "$lib/constants/guest-limits.js";
  import {
    parseMarkdown,
    applySyntaxHighlighting,
  } from "$lib/utils/markdown.js";
  import { getAllTools, getToolDisplayName } from "$lib/ai/tools/index.js";
  import { TextareaAutosize } from "$lib/spells/textarea-autosize.svelte.ts";
  import { ElementSize, ScrollState, IsMounted, Debounced } from "runed";

  import { getContext } from "svelte";
  import type { ChatState, AttachedFile } from "./chat-state.svelte.js";
  import FileUpload from "./FileUpload.svelte";
  import ElapsedTimer from "./ElapsedTimer.svelte";
  import * as Carousel from "$lib/components/ui/carousel/index.js";
  import * as m from "$lib/../paraglide/messages.js";

  // ToggleEvent interface for popover beforetoggle event
  interface ToggleEvent extends Event {
    newState: "open" | "closed";
    oldState: "open" | "closed";
  }

  // Get chat state from context (provided by layout)
  const chatState = getContext<ChatState>("chatState");

  let chatContainer: HTMLDivElement;

  // Model filter state
  let modelFilter = $state<"all" | "images" | "videos">("all");

  // Textarea implementation based on thom-chat
  let textarea = $state<HTMLTextAreaElement>();
  const autosize = new TextareaAutosize();
  const textareaSize = new ElementSize(() => textarea);
  const mounted = new IsMounted();

  // Timer management for cleanup
  let timers: Set<ReturnType<typeof setTimeout>> = new Set();

  // Standardized timing constants
  const TIMING = {
    TEXTAREA_SCROLL: 10,
    CHAT_SCROLL: 100,
    SYNTAX_HIGHLIGHTING: 100,
    FOCUS_AFTER_MOUNT: 225,
    FOCUS_AFTER_RESPONSE: 200,
    PROMPT_TEMPLATE_FOCUS: 10,
  } as const;

  // Helper function for managed timers
  function managedTimeout(callback: () => void, delay: number) {
    const timer = setTimeout(() => {
      timers.delete(timer);
      callback();
    }, delay);
    timers.add(timer);
    return timer;
  }

  // Cleanup timers on component destroy
  $effect(() => {
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
    };
  });

  // Position popover relative to trigger button
  function positionPopover(popover: HTMLElement, trigger: HTMLElement) {
    const triggerRect = trigger.getBoundingClientRect();
    const popoverRect = popover.getBoundingClientRect();
    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight,
    };

    // Default spacing above/below trigger
    const spacing = 16;
    const isFileUpload = popover.id === "file-upload-popover";
    const isMobile = viewport.width < 640; // sm breakpoint

    // Calculate horizontal position
    let left: number;

    if (isMobile && !isFileUpload) {
      // On mobile, center the popover in the viewport with 8px margins
      left = 8;
      // Ensure the popover uses full available width (already handled by CSS w-[calc(100vw-16px)])
    } else {
      // Desktop behavior: center-align with trigger
      left = triggerRect.left + (triggerRect.width - popoverRect.width) / 2;
    }

    // Ensure popover doesn't go off screen horizontally
    if (left < 8) {
      left = 8; // 8px margin from left edge
    } else if (left + popoverRect.width > viewport.width - 8) {
      left = viewport.width - popoverRect.width - 8; // 8px margin from right edge
    }

    if (isFileUpload) {
      // File upload popover: anchor bottom edge above trigger (grows upward)
      const bottom = viewport.height - triggerRect.top + spacing;

      // Ensure popover doesn't go off screen at the top
      const maxBottom = viewport.height - 8; // 8px margin from top
      const finalBottom = Math.min(bottom, maxBottom);

      popover.style.bottom = `${finalBottom}px`;
      popover.style.top = "auto";
    } else {
      // Model selector popover: intelligent positioning
      let top: number;

      if (isMobile) {
        // On mobile, prefer positioning above the trigger with more space
        const spaceAbove = triggerRect.top - spacing;
        const spaceBelow = viewport.height - triggerRect.bottom - spacing;
        const popoverHeight = Math.min(
          popoverRect.height,
          viewport.height * 0.7
        ); // Max 70% of viewport height

        if (spaceAbove >= popoverHeight) {
          // Position above
          top = triggerRect.top - popoverHeight - spacing;
        } else if (spaceBelow >= popoverHeight) {
          // Position below
          top = triggerRect.bottom + spacing;
        } else {
          // Use the larger space and adjust height
          if (spaceAbove > spaceBelow) {
            top = 8; // Near top of screen
            popover.style.maxHeight = `${triggerRect.top - 24}px`; // Leave space for trigger
          } else {
            top = triggerRect.bottom + spacing;
            popover.style.maxHeight = `${viewport.height - triggerRect.bottom - 24}px`;
          }
        }
      } else {
        // Desktop logic: try above first, then below
        top = triggerRect.top - popoverRect.height - spacing;

        // If not enough space above, position below
        if (top < 8) {
          top = triggerRect.bottom + spacing;
        }

        // Ensure popover doesn't go off screen vertically
        if (top + popoverRect.height > viewport.height - 8) {
          top = viewport.height - popoverRect.height - 8; // 8px margin from bottom
        }
      }

      popover.style.top = `${top}px`;
      popover.style.bottom = "auto";
    }

    // Apply horizontal positioning for both types
    popover.style.left = `${left}px`;
  }

  // Setup popover positioning when component mounts
  $effect(() => {
    if (!mounted.current) return;

    const modelPopover = document.getElementById("model-selector-popover");
    const modelTrigger = document.getElementById("model-selector-trigger");
    const filePopover = document.getElementById("file-upload-popover");
    const fileTrigger = document.getElementById("file-upload-trigger");

    const cleanupHandlers: (() => void)[] = [];

    // Debounced resize handler to improve performance
    let resizeTimer: ReturnType<typeof setTimeout>;
    const handleResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        // Reposition open popovers when screen size changes
        if (modelPopover?.matches(":popover-open") && modelTrigger) {
          requestAnimationFrame(() => {
            positionPopover(modelPopover, modelTrigger);
          });
        }
        if (filePopover?.matches(":popover-open") && fileTrigger) {
          requestAnimationFrame(() => {
            positionPopover(filePopover, fileTrigger);
          });
        }
      }, 150); // 150ms debounce
    };

    // Add resize and orientation change listeners
    window.addEventListener("resize", handleResize);
    window.addEventListener("orientationchange", handleResize);

    cleanupHandlers.push(() => {
      clearTimeout(resizeTimer);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("orientationchange", handleResize);
    });

    // Setup model selector popover positioning
    if (modelPopover && modelTrigger) {
      const handleModelBeforeToggle = (event: Event) => {
        const toggleEvent = event as ToggleEvent;
        if (toggleEvent.newState === "open") {
          // Small delay to ensure popover dimensions are available
          requestAnimationFrame(() => {
            positionPopover(modelPopover, modelTrigger);
          });
        }
      };

      modelPopover.addEventListener("beforetoggle", handleModelBeforeToggle);
      cleanupHandlers.push(() => {
        modelPopover.removeEventListener(
          "beforetoggle",
          handleModelBeforeToggle
        );
      });
    }

    // Setup file upload popover positioning
    if (filePopover && fileTrigger) {
      const handleFileBeforeToggle = (event: Event) => {
        const toggleEvent = event as ToggleEvent;
        if (toggleEvent.newState === "open") {
          // Small delay to ensure popover dimensions are available
          requestAnimationFrame(() => {
            positionPopover(filePopover, fileTrigger);
          });
        }
      };

      filePopover.addEventListener("beforetoggle", handleFileBeforeToggle);
      cleanupHandlers.push(() => {
        filePopover.removeEventListener("beforetoggle", handleFileBeforeToggle);
      });
    }

    // Cleanup all handlers
    return () => {
      cleanupHandlers.forEach((cleanup) => cleanup());
    };
  });

  // Create scroll state for textarea
  const textareaScrollState = new ScrollState({
    element: () => textarea,
    behavior: "smooth",
  });

  // Track if textarea is at bottom with debounced state
  const notAtBottom = new Debounced(
    () =>
      mounted.current && textarea ? !textareaScrollState.arrived.bottom : false,
    250
  );

  // Enhanced textarea disabled state
  const textareaDisabled = $derived(chatState.isLoading);

  // Check if send button should be disabled (empty content after cleaning)
  const sendButtonDisabled = $derived.by(() => {
    if (chatState.isLoading) return true;
    if (!chatState.prompt) return true;
    if (!chatState.cleanMessageContent(chatState.prompt)) return true;

    // Disable for guests who have reached their limit
    if (!chatState.canGuestSendMessage()) return true;

    return false;
  });

  // Function to check if cursor is at the end of the text
  function isCursorAtEnd(): boolean {
    if (!textarea) return false;
    const cursorPosition = textarea.selectionStart;
    const textLength = chatState.prompt.length;
    return cursorPosition === textLength;
  }

  // Auto-scroll textarea to bottom when content or size changes (only if cursor is at end)
  $effect(() => {
    const shouldScroll =
      mounted.current &&
      textarea &&
      isCursorAtEnd() &&
      (chatState.prompt || textareaSize.height);

    if (shouldScroll) {
      managedTimeout(() => {
        if (textarea) {
          textareaScrollState.scrollToBottom();
        }
      }, TIMING.TEXTAREA_SCROLL);
    }
  });

  // Advanced smooth scroll with acceleration and easing
  let scrollAnimationFrame: number | null = null;
  let targetScrollTop = 0;
  let currentScrollVelocity = 0;
  const SCROLL_BUFFER = 20; // Pixels ahead to anticipate content growth
  const EASING_FACTOR = 0.25; // Higher = snappier (0.1-0.5 range)

  // Check if user is near bottom of chat
  function isNearBottom(threshold = 150): boolean {
    if (!chatContainer) return true;

    const { scrollTop, scrollHeight, clientHeight } = chatContainer;
    return scrollHeight - scrollTop - clientHeight < threshold;
  }

  // Easing function - ease-out cubic for natural deceleration
  function easeOutCubic(t: number): number {
    return 1 - Math.pow(1 - t, 3);
  }

  // Smooth scroll with acceleration and easing
  function smoothScrollToBottom(force = false) {
    if (!chatContainer) return;

    // Only auto-scroll if user is near bottom (unless forced)
    if (!force && !isNearBottom()) {
      return;
    }

    // Cancel any existing scroll animation
    if (scrollAnimationFrame !== null) {
      cancelAnimationFrame(scrollAnimationFrame);
    }

    // Target with buffer to get slightly ahead of content
    targetScrollTop = chatContainer.scrollHeight + SCROLL_BUFFER;
    const startScrollTop = chatContainer.scrollTop;
    const distance = targetScrollTop - startScrollTop;

    // If distance is small, use instant scroll for responsiveness
    if (Math.abs(distance) < 10) {
      requestAnimationFrame(() => {
        if (chatContainer) {
          chatContainer.scrollTop = chatContainer.scrollHeight;
        }
      });
      return;
    }

    // Animated scroll with easing
    let startTime: number | null = null;

    function animateScroll(currentTime: number) {
      if (!chatContainer) return;

      if (!startTime) startTime = currentTime;
      const elapsed = currentTime - startTime;
      const duration = 150; // 150ms animation duration

      // Use easing for smooth acceleration/deceleration
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easeOutCubic(progress);

      // Apply eased position
      const newScrollTop = startScrollTop + (distance * easedProgress);
      chatContainer.scrollTop = newScrollTop;

      // Continue animation if not complete
      if (progress < 1) {
        scrollAnimationFrame = requestAnimationFrame(animateScroll);
      } else {
        // Snap to exact bottom when done
        chatContainer.scrollTop = chatContainer.scrollHeight;
        scrollAnimationFrame = null;
      }
    }

    scrollAnimationFrame = requestAnimationFrame(animateScroll);
  }

  // Auto-scroll when messages change or loading state changes
  let lastScrollTime = 0;
  const SCROLL_THROTTLE = 16; // 60fps - one frame per 16.67ms

  $effect(() => {
    if (chatState.messages.length > 0 || chatState.isLoading) {
      const now = Date.now();
      // Throttle scroll updates to 60fps during rapid changes (like streaming)
      if (now - lastScrollTime >= SCROLL_THROTTLE) {
        lastScrollTime = now;
        smoothScrollToBottom();
      }
    }
  });

  // Apply syntax highlighting when messages change
  $effect(() => {
    if (chatState.messages.length > 0) {
      // Small delay to ensure DOM has updated with new content
      managedTimeout(() => {
        applySyntaxHighlighting(chatContainer);
      }, TIMING.SYNTAX_HIGHLIGHTING);
    }
  });

  // Setup model change detection
  chatState.setupModelChangeDetection();

  // Handle file upload
  function handleFilesSelected(files: any[]) {
    const attachedFiles: AttachedFile[] = files.map((f) => ({
      id: f.id,
      file: f.file,
      name: f.name,
      size: f.size,
      type: f.type,
      dataUrl: f.dataUrl,
      content: f.content,
    }));
    chatState.addAttachedFiles(attachedFiles);
  }

  // Helper functions for image handling
  function getImageCount(message: any): number {
    if (message.images?.length) return message.images.length;
    if (message.imageIds?.length) return message.imageIds.length;
    if (message.imageId || message.imageUrl || message.imageData) return 1;
    return 0;
  }

  function getAllImages(message: any) {
    if (message.images?.length) return message.images;
    if (message.imageIds?.length)
      return message.imageIds.map((id: string) => ({
        imageId: id,
        mimeType: "",
      }));
    if (message.imageId || message.imageData)
      return [
        {
          imageId: message.imageId,
          imageData: message.imageData,
          mimeType: message.mimeType || "",
        },
      ];
    return [];
  }

  // Group models by provider for display - memoized for performance
  const aiModelGroups = $derived(
    chatState.models.reduce(
      (groups, model) => {
        const provider = model.provider;
        const group = groups.find((g) => g.provider === provider);
        const modelData = {
          value: model.name,
          label: model.displayName,
          capabilities: getCapabilities(model),
          architecture: model.architecture, // Include architecture data for UI enhancements
        };

        if (group) {
          group.models.push(modelData);
        } else {
          groups.push({
            provider,
            models: [modelData],
          });
        }

        return groups;
      },
      [] as {
        provider: string;
        models: {
          value: string;
          label: string;
          capabilities: Capability[];
          architecture?: import("$lib/ai/types.js").ArchitectureObject;
        }[];
      }[]
    )
  );

  // Filtered model groups based on selected filter
  const filteredModelGroups = $derived(
    aiModelGroups
      .map((group) => {
        const filteredModels = group.models.filter((model) => {
          const foundModel = chatState.models.find(
            (m) => m.name === model.value
          );
          if (!foundModel) return false;

          switch (modelFilter) {
            case "images":
              return foundModel.supportsImageGeneration === true;
            case "videos":
              return foundModel.supportsVideoGeneration === true;
            case "all":
            default:
              return true;
          }
        });

        return {
          ...group,
          models: filteredModels,
        };
      })
      .filter((group) => group.models.length > 0) // Only show groups that have models
  );

  function getCapabilities(model: AIModelConfig): Capability[] {
    const caps: Capability[] = [];

    // Architecture-first approach: Use architecture data when available (OpenRouter models)
    if (model.architecture) {
      // Text capability: Check if model outputs text
      if (model.architecture.output_modalities.includes("text")) {
        caps.push("text");
      }

      // Image capability: Check if model accepts image/file inputs OR supports image generation
      if (
        model.architecture.input_modalities.includes("image") ||
        model.architecture.input_modalities.includes("file") ||
        model.supportsImageGeneration // Still check boolean for image generation
      ) {
        caps.push("image");
      }

      // Video capability: Architecture doesn't specify video, use boolean fallback
      if (model.supportsVideoGeneration) {
        caps.push("video");
      }
    } else {
      // Boolean fallback approach: For providers without architecture data (Google Gemini, etc.)

      // Text capability: Check boolean flag
      if (model.supportsTextGeneration) {
        caps.push("text");
      }

      // Image capability: Check multiple boolean flags
      if (
        model.supportsFunctions ||
        model.supportsImageGeneration ||
        model.supportsImageInput
      ) {
        caps.push("image");
      }

      // Video capability: Check boolean flag
      if (model.supportsVideoGeneration) {
        caps.push("video");
      }
    }

    return caps;
  }

  // Capability types and configuration
  type Capability = "text" | "image" | "video" | "file";

  const capabilityConfig: Record<
    Capability,
    { icon: any; bgColor: string; iconColor: string; tooltip: string }
  > = {
    text: {
      icon: TypeIcon,
      bgColor: "bg-blue-100 dark:bg-blue-900/30",
      iconColor: "text-blue-700 dark:text-blue-300",
      tooltip: m["interface.supports_text"](),
    },
    image: {
      icon: ImageIcon,
      bgColor: "bg-green-100 dark:bg-green-900/30",
      iconColor: "text-green-700 dark:text-green-300",
      tooltip: m["interface.supports_image"](),
    },
    video: {
      icon: VideoIcon,
      bgColor: "bg-purple-100 dark:bg-purple-900/30",
      iconColor: "text-purple-700 dark:text-purple-300",
      tooltip: m["interface.supports_video"](),
    },
    file: {
      icon: FileIcon,
      bgColor: "bg-orange-100 dark:bg-orange-900/30",
      iconColor: "text-orange-700 dark:text-orange-300",
      tooltip: m["interface.file_support"](),
    },
  };

  // Function to get modality styling configuration
  function getModalityConfig(modality: string) {
    const modalityKey = modality.toLowerCase() as Capability;
    return capabilityConfig[modalityKey] || capabilityConfig.text; // Default to text config
  }

  // Function to create synthetic architecture data for Google Gemini models
  function getSyntheticArchitecture(
    model: AIModelConfig
  ): import("$lib/ai/types.js").ArchitectureObject {
    const input_modalities: string[] = [];
    const output_modalities: string[] = [];

    // Map input capabilities to modalities
    if (model.supportsTextInput) input_modalities.push("text");
    if (model.supportsImageInput) input_modalities.push("image");
    if (model.supportsVideoInput) input_modalities.push("video");
    if (model.supportsAudioInput) input_modalities.push("audio");

    // Map output capabilities to modalities
    if (model.supportsTextGeneration) output_modalities.push("text");
    if (model.supportsImageGeneration) output_modalities.push("image");
    if (model.supportsVideoGeneration) output_modalities.push("video");
    if (model.supportsAudioGeneration) output_modalities.push("audio");

    return {
      input_modalities,
      output_modalities,
      tokenizer: model.provider || "Unknown",
      instruct_type: null,
    };
  }

  // Prompt templates configuration
  const PROMPT_TEMPLATES = [
    {
      id: "creative",
      title: m["prompts.creative_writing.title"](),
      icon: BulbIcon,
      iconColor: "text-orange-600 dark:text-orange-400",
      bgColor: "bg-orange-100 dark:bg-orange-900/30",
      prompt: m["prompts.creative_writing.description"](),
      description: m["prompts.creative_writing.short_description"](),
    },
    {
      id: "code",
      title: m["prompts.code_review.title"](),
      icon: CodeIcon,
      iconColor: "text-blue-600 dark:text-blue-400",
      bgColor: "bg-blue-100 dark:bg-blue-900/30",
      prompt: m["prompts.code_review.description"](),
      description: m["prompts.code_review.short_description"](),
    },
    {
      id: "analysis",
      title: m["prompts.analysis_research.title"](),
      icon: AnalyticsIcon,
      iconColor: "text-green-600 dark:text-green-400",
      bgColor: "bg-green-100 dark:bg-green-900/30",
      prompt: m["prompts.analysis_research.description"](),
      description: m["prompts.analysis_research.short_description"](),
    },
    {
      id: "general",
      title: m["prompts.general_discussion.title"](),
      icon: MessageCircleIcon,
      iconColor: "text-purple-600 dark:text-purple-400",
      bgColor: "bg-purple-100 dark:bg-purple-900/30",
      prompt: m["prompts.general_discussion.description"](),
      description: m["prompts.general_discussion.short_description"](),
    },
  ] as const;

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      chatState.handleSubmit();
    }
  }

  // Function to handle clicking on prompt templates
  function handlePromptTemplate(template: string) {
    console.log('[PROMPT_TEMPLATE] handlePromptTemplate called', {
      template,
      length: template.length,
      chatStatePromptBefore: chatState.prompt
    });
    chatState.prompt = template;
    console.log('[PROMPT_TEMPLATE] chatState.prompt set', {
      chatStatePromptAfter: chatState.prompt,
      success: chatState.prompt === template
    });
    // Focus the textarea after setting the prompt
    managedTimeout(() => {
      if (textarea) {
        textarea.focus();
        // Move cursor to end of text
        textarea.setSelectionRange(template.length, template.length);
        console.log('[PROMPT_TEMPLATE] Textarea focused and cursor positioned');
      } else {
        console.warn('[PROMPT_TEMPLATE] Textarea not available for focus');
      }
    }, TIMING.PROMPT_TEMPLATE_FOCUS);
  }

  // Function to handle keyboard events on prompt templates
  function handlePromptTemplateKeydown(event: KeyboardEvent, template: string) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handlePromptTemplate(template);
    }
  }

  // Focus textarea on mount
  $effect(() => {
    if (textarea && mounted.current) {
      // Focus textarea after scroll completes (scroll happens at 100ms, so focus at 225ms)
      managedTimeout(() => {
        if (textarea) {
          textarea.focus();
        }
      }, TIMING.FOCUS_AFTER_MOUNT);
    }
  });

  // Focus textarea after AI responds
  $effect(() => {
    if (!chatState.isLoading && chatState.messages.length > 0) {
      // Focus textarea after any scrolling completes (scroll at 100ms, focus at 200ms)
      managedTimeout(() => {
        if (textarea) {
          textarea.focus();
        }
      }, TIMING.FOCUS_AFTER_RESPONSE);
    }
  });
</script>

<!-- Main content area -->
<main class="flex flex-col h-full w-full">
  <!-- Prompt Refinement Overlay -->
  {#if chatState.showPromptRefiner && chatState.pendingPrompt}
    <div class="fixed inset-0 bg-background/95 z-50 overflow-auto">
      <PromptRefiner
        prompt={chatState.pendingPrompt}
        onRun={(refinedPrompt, agents, settings) => {
          chatState.executeRefinedPrompt(refinedPrompt, agents, settings);
        }}
        onEdit={() => {
          chatState.cancelRefinement();
        }}
      />
    </div>
  {/if}

  <!-- Main chat area -->
  <div
    class="flex-1 overflow-auto min-h-0 overflow-x-hidden chat-scroll-container"
    bind:this={chatContainer}
  >
    {#if chatState.isLoadingChat}
      <div class="flex items-center justify-center p-6 h-full">
        <div class="w-full xl:max-w-4xl mx-auto text-center">
          <div class="flex items-center justify-center gap-2">
            <div class="flex items-center space-x-4">
              <div class="space-y-2">
                <Skeleton class="h-5 w-lg" />
                <Skeleton class="h-5 w-xl" />
                <Skeleton class="h-5 w-sm" />
                <Skeleton class="h-5 w-md" />
                <Skeleton class="h-5 w-xl" />
                <Skeleton class="h-5 w-lg" />
              </div>
            </div>
          </div>
        </div>
      </div>
    {:else if chatState.messages.length === 0}
      <div class="flex items-center justify-center p-6 h-full">
        <div class="w-full xl:max-w-4xl mx-auto">
          <div class="text-center mb-8">
            <h1 class="text-4xl font-bold mb-4">
              {m["interface.welcome_heading"]()}
            </h1>
            <p class="text-muted-foreground text-lg mb-2">
              {m["interface.welcome_subtitle"]()}
            </p>
            <div class="text-sm text-muted-foreground">
              {m["interface.welcome_description"]()}
            </div>
          </div>

          <!-- Prompt Templates Grid -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl mx-auto">
            {#each PROMPT_TEMPLATES as template}
              <div
                class="p-4 border rounded-lg bg-card hover:bg-accent/50 transition-colors cursor-pointer group"
                role="button"
                tabindex="0"
                onclick={() => handlePromptTemplate(template.prompt)}
                onkeydown={(e) =>
                  handlePromptTemplateKeydown(e, template.prompt)}
              >
                <div class="flex items-center gap-3 mb-2">
                  <div class="p-2 rounded-full {template.bgColor}">
                    <template.icon class="w-4 h-4 {template.iconColor}" />
                  </div>
                  <h3 class="font-medium text-sm">{template.title}</h3>
                </div>
                <p
                  class="text-sm text-muted-foreground group-hover:text-foreground transition-colors"
                >
                  {template.description}
                </p>
              </div>
            {/each}
          </div>
        </div>
      </div>
    {:else}
      <!-- Sticky loading indicator at top -->
      {#if chatState.isLoading || chatState.loadingMetadata}
        <div class="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border/50">
          <div class="w-full xl:max-w-4xl mx-auto p-4">
            <div class="flex flex-col gap-3 bg-accent/10 rounded-lg border border-accent/20 p-4">
              <!-- Status header with icon and timer -->
              <div class="flex items-center gap-3">
                <div class="relative flex items-center justify-center">
                  <!-- Animated pulse circle -->
                  <div class="absolute size-10 rounded-full bg-primary/20 animate-ping"></div>
                  <div class="relative size-10 rounded-full bg-primary/30 flex items-center justify-center">
                    <span class="text-xl">🤖</span>
                  </div>
                </div>
                <div class="flex-1">
                  <div class="text-sm font-medium text-foreground flex items-center gap-2">
                    <span>{chatState.loadingStatus || "Processing..."}</span>
                    {#if chatState.loadingStartTime}
                      <ElapsedTimer startTime={chatState.loadingStartTime} />
                    {/if}
                  </div>
                  <div class="text-xs text-muted-foreground mt-0.5">
                    {chatState.isLoading ? "Please wait while the AI generates a response" : "Streaming response..."}
                  </div>
                </div>
              </div>

              <!-- Metadata panel -->
              {#if chatState.loadingMetadata}
                <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div class="bg-background/50 px-2 py-1 rounded">
                    <span class="text-muted-foreground">Model:</span>
                    <span class="ml-1 font-medium">{chatState.getModelDisplayName(chatState.loadingMetadata.model)}</span>
                  </div>
                  <div class="bg-background/50 px-2 py-1 rounded">
                    <span class="text-muted-foreground">Context:</span>
                    <span class="ml-1 font-medium">{chatState.loadingMetadata.messageCount} msg</span>
                  </div>
                  <div class="bg-background/50 px-2 py-1 rounded">
                    <span class="text-muted-foreground">Temp:</span>
                    <span class="ml-1 font-medium">{chatState.loadingMetadata.temperature}</span>
                  </div>
                  <div class="bg-background/50 px-2 py-1 rounded">
                    <span class="text-muted-foreground">Max tokens:</span>
                    <span class="ml-1 font-medium">{chatState.loadingMetadata.maxTokens}</span>
                  </div>
                </div>
              {/if}

              <!-- Progress indicator -->
              <div class="w-full h-1.5 bg-accent/30 rounded-full overflow-hidden">
                <div class="h-full bg-primary animate-progress rounded-full"></div>
              </div>
            </div>
          </div>
        </div>
      {/if}

      <div class="w-full xl:max-w-4xl mx-auto p-6">
        <div class="space-y-6">
          {#each chatState.messages as message}
            {#if message.role === "user"}
              <!-- User message - gray bubble for both modes -->
              <div class="flex justify-end">
                <div class="max-w-[75%] flex flex-col items-end gap-3">
                  <!-- Text bubble -->
                  <div
                    class="bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-2xl px-4 py-3"
                  >
                    <div
                      class="text-sm font-medium mb-1 text-slate-600 dark:text-slate-400 italic"
                    >
                      You
                    </div>
                    <div
                      class="prose prose-slate dark:prose-invert max-w-none overflow-hidden markdown-content"
                      style="word-wrap: break-word; word-break: normal;"
                    >
                      {@html parseMarkdown(message.content || "")}
                    </div>
                  </div>

                  <!-- User message image attachments (outside bubble) -->
                  {#if message.type === "image" && (message.imageId || message.imageUrl || message.imageData || message.imageIds || message.images)}
                    {@const imageCount = getImageCount(message)}
                    {@const allImages = getAllImages(message)}

                    {#if imageCount >= 2}
                      <!-- Multiple images - use carousel -->
                      <Carousel.Root class="w-full max-w-sm mx-8">
                        <Carousel.Content>
                          {#each allImages as image}
                            <Carousel.Item>
                              <div class="border rounded-lg overflow-hidden">
                                <img
                                  src={image.imageId
                                    ? `/api/images/${image.imageId}`
                                    : image.imageData
                                      ? `data:${image.mimeType};base64,${image.imageData}`
                                      : ""}
                                  alt={m["interface.uploaded_attachment"]()}
                                  class="w-full h-auto"
                                  loading="eager"
                                />
                              </div>
                            </Carousel.Item>
                          {/each}
                        </Carousel.Content>
                        <Carousel.Previous />
                        <Carousel.Next />
                      </Carousel.Root>
                    {:else if imageCount === 1}
                      <!-- Single image -->
                      <div class="border rounded-lg overflow-hidden max-w-sm">
                        <img
                          src={message.imageId
                            ? `/api/images/${message.imageId}`
                            : message.imageUrl ||
                              `data:${message.mimeType};base64,${message.imageData}`}
                          alt={m["interface.uploaded_attachment"]()}
                          class="w-full h-auto"
                          loading="eager"
                        />
                      </div>
                    {/if}
                  {/if}
                </div>
              </div>
            {:else}
              <!-- AI message - full width, no bubble -->
              <div class="w-full">
                <div
                  class="text-sm font-medium mb-2 text-slate-600 dark:text-slate-400 italic"
                >
                  {chatState.getModelDisplayName(
                    (message as any).model || chatState.selectedModel
                  )}
                </div>

                {#if message.type === "image" && (message.imageId || message.imageUrl || message.imageData || message.imageIds || message.images)}
                  {@const imageCount = getImageCount(message)}
                  {@const allImages = getAllImages(message)}

                  <!-- Image message -->
                  <div class="space-y-3">
                    <div
                      class="prose prose-slate dark:prose-invert max-w-none overflow-hidden markdown-content"
                      style="word-wrap: break-word; word-break: normal;"
                    >
                      {@html parseMarkdown(message.content || "")}
                    </div>

                    {#if imageCount >= 2}
                      <!-- Multiple images - use carousel -->
                      <Carousel.Root class="w-full max-w-lg">
                        <Carousel.Content>
                          {#each allImages as image}
                            <Carousel.Item>
                              <div class="border rounded-lg overflow-hidden">
                                <img
                                  src={image.imageId
                                    ? `/api/images/${image.imageId}`
                                    : image.imageData
                                      ? `data:${image.mimeType};base64,${image.imageData}`
                                      : ""}
                                  alt=""
                                  class="w-full h-auto"
                                  loading="eager"
                                />
                              </div>
                            </Carousel.Item>
                          {/each}
                        </Carousel.Content>
                        <Carousel.Previous />
                        <Carousel.Next />
                      </Carousel.Root>
                    {:else if imageCount === 1}
                      <!-- Single image -->
                      <div class="border rounded-lg overflow-hidden max-w-lg">
                        <img
                          src={message.imageId
                            ? `/api/images/${message.imageId}`
                            : message.imageUrl ||
                              `data:${message.mimeType};base64,${message.imageData}`}
                          alt=""
                          class="w-full h-auto"
                          loading="eager"
                        />
                      </div>
                    {/if}
                  </div>
                {:else if message.type === "video" && message.videoId}
                  <!-- Video message -->
                  <div class="space-y-3">
                    <div
                      class="prose prose-slate dark:prose-invert max-w-none overflow-hidden markdown-content"
                      style="word-wrap: break-word; word-break: normal;"
                    >
                      {@html parseMarkdown(message.content || "")}
                    </div>
                    <div class="border rounded-lg overflow-hidden max-w-2xl">
                      <video
                        src={`/api/videos/${message.videoId}`}
                        class="w-full h-auto max-h-96"
                        controls
                        preload="metadata"
                        poster=""
                      >
                        Your browser does not support the video tag.
                        <track kind="captions" />
                      </video>
                    </div>
                    <!-- Video metadata -->
                    <div class="text-sm text-muted-foreground flex gap-4">
                      <span>Duration: 8s</span>
                      <span>Resolution: 720p</span>
                      <span>Audio: Yes</span>
                    </div>
                  </div>
                {:else}
                  <!-- Text message -->
                  <div
                    class="prose prose-slate dark:prose-invert max-w-none overflow-hidden markdown-content min-h-[1.5rem]"
                    style="word-wrap: break-word; word-break: normal;"
                  >
                    {#if message.content}
                      {@html parseMarkdown(message.content)}
                    {:else}
                      <!-- Empty message placeholder with streaming cursor -->
                      <span class="inline-flex items-center gap-1">
                        <span class="text-muted-foreground">Generating response</span>
                        <span class="inline-block w-2 h-4 bg-primary animate-pulse"></span>
                      </span>
                    {/if}
                  </div>
                {/if}
              </div>
            {/if}
          {/each}

          {#if chatState.error}
            <div class="flex justify-center">
              <div
                class="bg-destructive/10 border border-destructive/20 text-destructive rounded-lg px-4 py-2 text-sm"
              >
                Error: {chatState.error}
              </div>
            </div>
          {/if}
        </div>
      </div>
    {/if}
  </div>

  <!-- Chat input area -->
  <div class="flex-shrink-0 p-4 w-full flex justify-center">
    <div class="w-full max-w-3xl">
      <!-- Guest limitation indicator -->
      {#if !chatState.userId}
        <div class="mb-2 px-2 text-sm text-muted-foreground">
          <div class="flex items-center justify-between">
            <span>
              {m["interface.guest_mode_usage"]({
                used: chatState.guestMessageCount.toString(),
                limit: GUEST_MESSAGE_LIMIT.toString(),
              })}
            </span>
            {#if chatState.canGuestSendMessage()}
              <Button
                variant="ghost"
                size="sm"
                onclick={() => (window.location.href = "/login")}
                class="h-7 underline px-2 cursor-pointer hover:bg-accent"
              >
                {m["interface.guest_login_prompt"]()}
              </Button>
            {:else}
              <Button
                variant="ghost"
                size="sm"
                onclick={() => (window.location.href = "/login")}
                class="h-7 underline px-2 cursor-pointer hover:bg-accent text-orange-600 dark:text-orange-400"
              >
                {m["interface.guest_limit_reached"]()}
              </Button>
            {/if}
          </div>
        </div>
      {/if}

      <!-- Textarea with embedded model selector and send button -->
      <div class="relative w-full border bg-background rounded-2xl shadow-lg">
        <textarea
          bind:this={textarea}
          bind:value={chatState.prompt}
          disabled={textareaDisabled}
          class="text-foreground placeholder:text-muted-foreground/60 max-h-80 min-h-36 w-full resize-none !overflow-y-auto bg-transparent px-5 pt-5 pb-14 text-base leading-6 outline-none focus:outline-none focus:ring-0 disabled:cursor-not-allowed disabled:opacity-50 scrollbar-thin"
          placeholder={chatState.isLoading
            ? m["interface.generating_response"]()
            : m["interface.type_message_here"]()}
          name="message"
          onkeydown={handleKeyDown}
          autocomplete="off"
          {@attach autosize.attachment}
        ></textarea>

        <!-- Scroll to bottom button for textarea -->
        {#if notAtBottom.current}
          <button
            onclick={() => textareaScrollState.scrollToBottom()}
            class="absolute right-3 top-3 opacity-60 hover:opacity-100 transition-opacity mr-5 p-1 rounded bg-background/80 backdrop-blur-sm"
            type="button"
            aria-label={m["interface.scroll_to_bottom"]()}
          >
            <svg
              class="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M19 14l-7 7m0 0l-7-7m7 7V3"
              ></path>
            </svg>
          </button>
        {/if}

        <!-- Controls wrapper with background to prevent text overlap -->
        <div
          class="absolute bottom-0 left-0 right-0 px-2 mx-3 h-14 {chatState.isLoading
            ? 'bg-[#f2f2f2] dark:bg-[#141414]'
            : 'bg-[#f2f2f2] dark:bg-[#141414]'} pointer-events-none"
        >
          <!-- File Upload, Model selector, Tools buttons container -->
          <div
            class="absolute bottom-2 flex items-center gap-2 m-1 pointer-events-auto"
          >
            <!-- Upload button positioned in bottom left -->
            <div class="pointer-events-auto">
              <div class="relative">
                <button
                  id="file-upload-trigger"
                  popovertarget="file-upload-popover"
                  class="h-6 {chatState.attachedFiles.length > 0
                    ? 'w-auto px-3 bg-blue-500 hover:bg-blue-600 text-white'
                    : 'w-6 bg-transparent'} border-transparent cursor-pointer flex items-center rounded-md justify-center gap-1 transition-all duration-300 ease-in-out"
                  onclick={() => {
                    // Ensure positioning happens when button is clicked
                    const popover = document.getElementById(
                      "file-upload-popover"
                    );
                    const trigger = document.getElementById(
                      "file-upload-trigger"
                    );
                    if (popover && trigger) {
                      requestAnimationFrame(() => {
                        positionPopover(popover, trigger);
                      });
                    }
                  }}
                >
                  <SquarePlusIcon class="w-5 h-5 flex-shrink-0" />
                  {#if chatState.attachedFiles.length > 0}
                    <span class="text-xs font-medium whitespace-nowrap">
                      {chatState.attachedFiles.length}
                      {chatState.attachedFiles.length === 1
                        ? m["interface.file_singular"]()
                        : m["interface.files_plural"]()}
                    </span>
                  {/if}
                </button>

                <div
                  id="file-upload-popover"
                  popover="auto"
                  class="file-upload-popover w-80 max-h-[300px] overflow-y-auto p-4 bg-popover text-popover-foreground border rounded-md shadow-md"
                >
                  <div class="flex justify-between items-center mb-3">
                    <h3 class="text-sm font-medium cursor-default">
                      {m["interface.attach_files"]()}
                    </h3>
                    <button
                      class="text-muted-foreground hover:text-foreground"
                      onclick={() => {
                        document
                          .getElementById("file-upload-popover")
                          ?.hidePopover();
                      }}
                    >
                      ✕
                    </button>
                  </div>

                  <!-- File upload area - always at top -->
                  <FileUpload
                    onFilesSelected={handleFilesSelected}
                    acceptedTypes={[
                      "image/png",
                      "image/jpeg",
                      "image/jpg",
                      "image/gif",
                      "image/webp",
                      "text/plain",
                      "text/markdown",
                      "text/csv",
                      "application/json",
                    ]}
                    maxFiles={3 - chatState.attachedFiles.length}
                    class="mb-3"
                  />

                  <!-- Attached files list - below upload area -->
                  {#if chatState.attachedFiles.length > 0}
                    <div class="border-t pt-3 mt-3">
                      <h4 class="text-sm font-medium mb-2 cursor-default">
                        Attached Files ({chatState.attachedFiles.length})
                      </h4>
                      <div class="space-y-2 mb-3">
                        {#each chatState.attachedFiles as file}
                          <div
                            class="flex items-center justify-between gap-2 bg-muted/50 rounded px-3 py-2 cursor-default"
                          >
                            <div class="flex items-center gap-2 flex-1 min-w-0">
                              <span class="text-sm truncate">{file.name}</span>
                              <span class="text-xs text-muted-foreground"
                                >({(file.size / 1024).toFixed(1)}KB)</span
                              >
                            </div>
                            <button
                              onclick={() =>
                                chatState.removeAttachedFile(file.id)}
                              class="text-muted-foreground hover:text-foreground p-1 rounded-sm hover:bg-muted"
                              type="button"
                              aria-label={m["interface.remove_file"]()}
                            >
                              ✕
                            </button>
                          </div>
                        {/each}

                        <!-- Clear all button -->
                        <div class="flex justify-end pt-2">
                          <button
                            onclick={() => {
                              chatState.clearAttachedFiles();
                            }}
                            class="text-xs text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 px-2 py-1 rounded"
                          >
                            {m["interface.remove_all"]()}
                          </button>
                        </div>
                      </div>
                    </div>
                  {/if}
                </div>

                <!-- Separate tooltip overlay -->
                <Tooltip.Provider>
                  <Tooltip.Root>
                    <Tooltip.Trigger
                      class="absolute inset-0 pointer-events-none"
                    >
                      <span class="sr-only"
                        >{m["interface.attach_files_tooltip"]()}</span
                      >
                    </Tooltip.Trigger>
                    <Tooltip.Content>
                      <p>{m["interface.attach_files_tooltip"]()}</p>
                    </Tooltip.Content>
                  </Tooltip.Root>
                </Tooltip.Provider>
              </div>
            </div>

            <!-- Auto/Manual Mode Toggle -->
            <button
              class="text-xs h-6 px-2 rounded border cursor-pointer ml-3 flex items-center gap-1 {chatState.isAutoSelectMode
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background text-foreground border-border'}"
              onclick={() => chatState.toggleAutoSelect(!chatState.isAutoSelectMode)}
              title={chatState.isAutoSelectMode
                ? 'Auto-select mode: System picks best model for each task'
                : 'Manual mode: You choose the model'}
            >
              <span class="font-medium">
                {chatState.isAutoSelectMode ? '🤖 Auto' : '✋ Manual'}
              </span>
            </button>

            <!-- Model selector -->
            <button
              id="model-selector-trigger"
              popovertarget="model-selector-popover"
              class="text-sm h-6 border-transparent cursor-pointer ml-2 flex items-center gap-1"
              disabled={chatState.isLoadingModels}
              onclick={() => {
                // Ensure positioning happens when button is clicked
                const popover = document.getElementById(
                  "model-selector-popover"
                );
                const trigger = document.getElementById(
                  "model-selector-trigger"
                );
                if (popover && trigger) {
                  requestAnimationFrame(() => {
                    positionPopover(popover, trigger);
                  });
                }
              }}
            >
              <span
                class="truncate {chatState.isLoadingModels ? 'italic' : ''}"
              >
                {chatState.isLoadingModels
                  ? m["interface.loading"]()
                  : chatState.getModelDisplayName(chatState.selectedModel) ||
                    m["interface.select"]()}
              </span>
              <ChevronDownIcon class="w-4 h-4 flex-shrink-0" />
            </button>

            <!-- Auto-selection reasoning display -->
            {#if chatState.lastAutoSelection && chatState.isAutoSelectMode}
              <div
                class="ml-3 text-xs text-muted-foreground py-1 px-2 bg-accent/20 rounded flex items-center gap-1"
                title="Model auto-selected based on your prompt"
              >
                <span>✨</span>
                <span class="truncate max-w-[200px]">
                  {chatState.lastAutoSelection.reasoning}
                </span>
              </div>
            {/if}

            <!-- Re-analyze conversation button -->
            {#if chatState.messages.length > 0 && chatState.userId}
              <button
                class="ml-3 text-xs h-6 px-2 rounded border border-border cursor-pointer flex items-center gap-1 hover:bg-accent/50"
                onclick={() => {
                  // Show model selector and trigger re-analysis
                  const currentModel = chatState.selectedModel;
                  if (confirm('Re-analyze this conversation with a different model? This will replace the current conversation.')) {
                    // For now, let's use a prompt to select model
                    // In a full implementation, you'd show a model selector dialog
                    const modelName = prompt('Enter model name (e.g., anthropic/claude-opus-4.1, openai/gpt-5):');
                    if (modelName) {
                      chatState.reAnalyzeConversation(modelName);
                    }
                  }
                }}
                title="Re-analyze entire conversation with a different AI model"
              >
                <span>🔄</span>
                <span class="font-medium">Re-analyze</span>
              </button>
            {/if}

            {#if !chatState.isLoadingModels}
              <div
                id="model-selector-popover"
                popover="auto"
                class="model-selector-popover w-[calc(100vw-16px)] sm:w-[580px] lg:w-[620px] max-w-[620px] max-h-96 overflow-y-auto p-4 bg-popover text-popover-foreground border rounded-md shadow-md"
              >
                <!-- Filter Header -->
                <div class="mb-4 pb-3 border-b">
                  <div class="flex items-center gap-6">
                    <label class="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        bind:group={modelFilter}
                        value="all"
                        class="w-4 h-4 text-primary cursor-pointer"
                      />
                      <span class="text-sm font-light">All</span>
                    </label>
                    <label class="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        bind:group={modelFilter}
                        value="images"
                        class="w-4 h-4 text-primary cursor-pointer"
                      />
                      <span class="text-sm font-light">Image generation</span>
                    </label>
                    <label class="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        bind:group={modelFilter}
                        value="videos"
                        class="w-4 h-4 text-primary cursor-pointer"
                      />
                      <span class="text-sm font-light">Video generation</span>
                    </label>
                  </div>
                </div>

                <div class="space-y-4">
                  {#each filteredModelGroups as group}
                    <!-- Provider Group Header -->
                    <div class="space-y-3 cursor-default">
                      <div
                        class="flex items-center gap-2 p-2 bg-muted/50 rounded-md"
                      >
                        <div
                          class="inline-flex items-center justify-center w-5 h-5 rounded-full overflow-hidden"
                        >
                          {#if providerConfig[group.provider]?.iconPath}
                            <img
                              src={providerConfig[group.provider].iconPath}
                              alt="{group.provider} icon"
                              class="w-4 h-4 object-contain"
                            />
                          {:else}
                            <span class="text-xs">🤖</span>
                          {/if}
                        </div>
                        <span class="font-medium text-sm">{group.provider}</span
                        >
                      </div>

                      <!-- Model Cards Grid -->
                      <div
                        class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
                      >
                        {#each group.models as model}
                          {@const foundModel = chatState.models.find(
                            (m) => m.name === model.value
                          )}
                          {@const effectiveArchitecture = foundModel
                            ? model.architecture ||
                              getSyntheticArchitecture(foundModel)
                            : null}
                          {@const isSelected =
                            chatState.selectedModel === model.value}

                          {@const isLocked = foundModel?.isLocked || false}
                          <button
                            data-model-selector
                            onclick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();

                              // Manually select model (with validation and override support)
                              if (!chatState.manuallySelectModel(model.value)) {
                                return;
                              }

                              // Close the popover after successful selection
                              document
                                .getElementById("model-selector-popover")
                                ?.hidePopover();
                            }}
                            disabled={isLocked}
                            class="p-3 border rounded-lg bg-card transition-colors text-left relative group {isSelected
                              ? 'ring-2 ring-primary bg-primary/5'
                              : ''} {isLocked
                              ? 'opacity-50 cursor-not-allowed bg-muted/50'
                              : 'cursor-pointer hover:bg-accent/50'}"
                          >
                            <!-- Provider icon (top-right corner) -->
                            <div
                              class="absolute top-2 right-2 w-4 h-4 group-hover:opacity-100
                              {isSelected ? 'opacity-100' : 'opacity-60'}"
                            >
                              {#if providerConfig[group.provider]?.iconPath}
                                <img
                                  src={providerConfig[group.provider].iconPath}
                                  alt="{group.provider} icon"
                                  class="w-full h-full object-contain"
                                />
                              {:else}
                                <span class="text-xs">🤖</span>
                              {/if}
                            </div>

                            <!-- Selected indicator -->
                            {#if isSelected}
                              <div class="absolute bottom-2 right-2">
                                <CircleCheckIcon class="w-6 h-6 text-primary" />
                              </div>
                            {/if}

                            <!-- Model name -->
                            <div class="pr-6 mb-3">
                              <h3
                                class="font-medium text-sm leading-tight truncate {isLocked
                                  ? 'text-muted-foreground'
                                  : ''}"
                                title={model.label}
                              >
                                {model.label}
                              </h3>
                              <!-- Always render lock message area for consistent layout -->
                              <p
                                class="text-xs text-muted-foreground mt-1 min-h-[16px]"
                              >
                                {#if isLocked}
                                  {#if !chatState.userId}
                                    {m["interface.sign_up_to_unlock"]()}
                                  {:else if chatState.userId && foundModel?.isDemoMode}
                                    {m["interface.not_available_in_demo"]()}
                                  {:else}
                                    {m["interface.sign_up_to_unlock"]()}
                                  {/if}
                                {:else}
                                  <!-- Empty space to maintain layout consistency -->
                                  &nbsp;
                                {/if}
                              </p>
                            </div>

                            <!-- Modality indicators -->
                            {#if effectiveArchitecture && (effectiveArchitecture.input_modalities.length > 0 || effectiveArchitecture.output_modalities.length > 0)}
                              <div class="space-y-1">
                                <!-- Input modalities -->
                                {#if effectiveArchitecture.input_modalities.length > 0}
                                  <div class="flex items-center gap-1">
                                    <span class="text-sm text-muted-foreground"
                                      >{m["interface.input_label"]()}:</span
                                    >
                                    <div class="flex gap-1">
                                      {#each effectiveArchitecture.input_modalities.slice(0, 4) as modality}
                                        {@const modalityConfig =
                                          getModalityConfig(modality)}
                                        <span
                                          class="inline-flex items-center justify-center w-5 h-5 rounded-full {modalityConfig.bgColor}"
                                          title={modalityConfig.tooltip}
                                        >
                                          <modalityConfig.icon
                                            class="w-2.5 h-2.5 {modalityConfig.iconColor}"
                                          />
                                        </span>
                                      {/each}
                                      {#if effectiveArchitecture.input_modalities.length > 4}
                                        <span
                                          class="text-xs text-muted-foreground"
                                          >+{effectiveArchitecture
                                            .input_modalities.length - 4}</span
                                        >
                                      {/if}
                                    </div>
                                  </div>
                                {/if}

                                <!-- Output modalities -->
                                {#if effectiveArchitecture.output_modalities.length > 0}
                                  <div class="flex items-center gap-1">
                                    <span class="text-sm text-muted-foreground"
                                      >{m["interface.output_label"]()}:</span
                                    >
                                    <div class="flex gap-1">
                                      {#each effectiveArchitecture.output_modalities.slice(0, 4) as modality}
                                        {@const modalityConfig =
                                          getModalityConfig(modality)}
                                        <span
                                          class="inline-flex items-center justify-center w-5 h-5 rounded-full {modalityConfig.bgColor}"
                                          title={modalityConfig.tooltip}
                                        >
                                          <modalityConfig.icon
                                            class="w-2.5 h-2.5 {modalityConfig.iconColor}"
                                          />
                                        </span>
                                      {/each}
                                      {#if effectiveArchitecture.output_modalities.length > 4}
                                        <span
                                          class="text-xs text-muted-foreground"
                                          >+{effectiveArchitecture
                                            .output_modalities.length - 4}</span
                                        >
                                      {/if}
                                    </div>
                                  </div>
                                {/if}
                              </div>
                            {/if}
                          </button>
                        {/each}
                      </div>
                    </div>
                  {/each}
                </div>
              </div>
            {/if}

            <!-- Tools selector -->
            <Select.Root type="single" bind:value={chatState.selectedTool}>
              <Select.Trigger
                class="h-6 text-sm {chatState.selectedTool
                  ? 'border-dashed border-blue-500'
                  : 'border-transparent'} cursor-pointer bg-transparent dark:bg-transparent hover:bg-transparent dark:hover:bg-transparent [&>svg:last-child]:hidden"
              >
                <Settings2Icon />
              </Select.Trigger>
              <Select.Content class="max-h-40">
                {#each getAllTools() as tool}
                  <Select.Item
                    value={tool.function.name}
                    class="cursor-pointer"
                  >
                    <div class="flex flex-col">
                      <span class="font-medium"
                        >{getToolDisplayName(tool.function.name)}</span
                      >
                    </div>
                  </Select.Item>
                {/each}
              </Select.Content>
            </Select.Root>

            <!-- Selected tool display button (only visible when tool is selected) -->
            {#if chatState.selectedTool}
              <Button
                variant="secondary"
                size="sm"
                onclick={() => chatState.clearSelectedTool()}
                class="h-7 p-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl hidden sm:flex items-center gap-1 text-xs cursor-pointer"
                aria-label="Clear tool selection: {getToolDisplayName(
                  chatState.selectedTool
                )}"
              >
                <span class="truncate max-w-25"
                  >{getToolDisplayName(chatState.selectedTool)}</span
                >
                <XIcon class="w-3 h-3 flex-shrink-0" />
              </Button>
            {/if}
          </div>

          <!-- Prompt Refinement button (for testing) -->
          {#if chatState.prompt.trim() && !chatState.isLoading}
            <Tooltip.Root>
              <Tooltip.Trigger asChild let:builder>
                <Button
                  builders={[builder]}
                  onclick={() => chatState.triggerRefinementManually()}
                  class="absolute bottom-2 right-14 h-9 w-9 m-1 bg-amber-500/90 hover:bg-amber-600 backdrop-blur-sm rounded-lg cursor-pointer pointer-events-auto"
                  size="icon"
                  aria-label="Refine prompt with AI"
                >
                  <SparkleIcon class="h-4 w-4" />
                </Button>
              </Tooltip.Trigger>
              <Tooltip.Content>
                <p>Refine prompt with AI agents</p>
              </Tooltip.Content>
            </Tooltip.Root>
          {/if}

          <!-- Send button positioned in bottom right -->
          <Button
            onclick={() => chatState.handleSubmit()}
            disabled={sendButtonDisabled}
            class="absolute bottom-2 right-2 h-9 w-9 m-1 bg-primary/90 hover:bg-primary backdrop-blur-sm rounded-lg cursor-pointer disabled:pointer-events-auto disabled:cursor-not-allowed pointer-events-auto"
            size="icon"
            aria-label={chatState.isLoading
              ? m["interface.sending"]()
              : m["interface.send_message"]()}
          >
            <ArrowUpIcon />
          </Button>
        </div>
      </div>
    </div>
  </div>
</main>

<style>
  /* Native HTML Popover Positioning and Performance Optimization */
  .model-selector-popover:popover-open {
    position: fixed;
    max-height: 550px;
    z-index: 50;

    /* Performance optimizations for Firefox scroll lag */
    will-change: transform, scroll-position;
    contain: layout style paint;
    transform: translateZ(0); /* Force hardware acceleration fallback */

    /* Smooth scrolling optimizations */
    -webkit-overflow-scrolling: touch; /* iOS Safari smooth scrolling */
    scroll-behavior: smooth;
    overscroll-behavior: contain;

    /* Initial positioning - will be overridden by JavaScript */
    top: 0;
    left: 0;
  }

  .file-upload-popover:popover-open {
    position: fixed;
    max-height: 415px;
    z-index: 50;

    /* Performance optimizations */
    will-change: transform;
    contain: layout style paint;
    transform: translateZ(0);

    /* Initial positioning - will be overridden by JavaScript */
    left: 0;
  }

  /* Optimize individual model cards for paint performance */
  .model-selector-popover [data-model-selector] {
    contain: paint;
    /* Avoid triggering layout/paint during scroll */
    will-change: auto;
  }

  /* Reduce paint complexity on hover to prevent scroll lag */
  .model-selector-popover [data-model-selector]:hover {
    transform: translateZ(0);
  }
</style>
