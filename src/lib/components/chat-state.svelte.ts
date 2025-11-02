import { goto } from "$app/navigation";
import { browser } from "$app/environment";
import type { AIModelConfig, AIMessage, AIResponse } from "$lib/ai/types.js";
import { isMultimodal } from "$lib/ai/types.js";
import { toast } from "svelte-sonner";
import { GUEST_MESSAGE_LIMIT, GUEST_ALLOWED_MODELS } from "$lib/constants/guest-limits.js";
import { selectBestModel, getSelectionExplanation, type ModelSelection } from "$lib/ai/model-router.js";
import { fetchWithRetry } from "$lib/utils/network-retry.js";

// File attachment types
export interface AttachedFile {
  id: string;
  file: File;
  name: string;
  size: number;
  type: string;
  dataUrl?: string;
  content?: string; // For text files
  uploadedImageId?: string; // After upload to server
}

export class ChatState {
  // Chat state
  prompt = $state("");
  selectedModel = $state("x-ai/grok-4-fast:free");
  isAutoSelectMode = $state(true); // Auto-select best model by default
  lastAutoSelection = $state<ModelSelection | null>(null); // Track last auto-selection
  manualModelOverride = $state<string | null>(null); // User's manual override
  isLoading = $state(false);
  loadingStatus = $state<string | null>(null); // Detailed status during loading
  loadingStartTime = $state<number | null>(null); // Track when loading started
  loadingMetadata = $state<{
    model: string;
    messageCount: number;
    attachmentCount: number;
    temperature: number;
    maxTokens: number;
  } | null>(null); // Metadata about current request
  messages = $state<AIMessage[]>([]);
  error = $state<string | null>(null);
  models = $state<AIModelConfig[]>([]);
  currentChatId = $state<string | null>(null);
  userId = $state<string | null>(null);
  chatHistory = $state<
    Array<{
      id: string;
      title: string;
      model: string;
      pinned: boolean;
      createdAt: string;
      updatedAt: string;
    }>
  >([]);

  // Loading states
  isLoadingChat = $state(false);
  isLoadingChatData = $state(false);
  isLoadingModels = $state(true); // Add loading state for models

  // UI states
  editingChatId = $state<string | null>(null);
  editingTitle = $state("");
  deletingChatId = $state<string | null>(null);
  showModelChangeDialog = $state(false);
  pendingModelChange = $state<string | null>(null);

  // Track previous model to detect changes
  previousModel = $state<string | null>(null);

  // File attachment state
  attachedFiles = $state<AttachedFile[]>([]);
  isUploadingFiles = $state(false);

  // Guest user limitations
  guestMessageCount = $state(0);

  // Tool selection
  selectedTool = $state<string | undefined>(undefined);

  // Track fresh chat creation to preserve tool selection
  isFreshChat = $state(false);

  // Prompt Refinement System
  showPromptRefiner = $state(false);
  pendingPrompt = $state<string | null>(null);
  selectedAgents = $state<any[]>([]);
  refinedPromptSettings = $state<any>(null);
  skipRefinement = $state(false); // Flag to skip refinement when executing refined prompt
  enablePromptRefinement = $state(true); // Can be toggled by user to enable/disable refinement

  constructor() {
    // Auto-load models when state is created
    if (browser) {
      this.loadModels();
      this.loadGuestMessageCount();
      // Note: chat history will be loaded when session is established
    }
  }

  // Set up session reactivity - call this from the layout when session changes
  setupSessionReactivity(getSession: () => any) {
    if (!browser) return;

    let previousSessionId: string | null = null;

    $effect(() => {
      const session = getSession();
      const currentSessionId = session?.user?.id || null;

      // Update userId state
      this.userId = currentSessionId;

      // Only reload if session actually changed
      if (currentSessionId !== previousSessionId) {
        previousSessionId = currentSessionId;
        if (currentSessionId) {
          // User logged in, load chat history and reset guest count
          this.loadChatHistory();
          this.resetGuestMessageCount();
          this.loadModels(); // Reload models to get full access
        } else {
          // User logged out, clear chat history and load guest count
          this.chatHistory = [];
          this.loadGuestMessageCount();
          this.loadModels(); // Reload models to get restricted access
        }
      }
    });
  }

  // Function to clean and normalize message content
  cleanMessageContent(content: string): string {
    return content
      .trim() // Remove leading/trailing whitespace
      .replace(/[ \t]{3,}/g, " ") // Replace 3+ consecutive spaces/tabs with single space
      .replace(/\n{3,}/g, "\n\n") // Replace 3+ consecutive newlines with double newline
      .replace(/[ \t]+\n/g, "\n") // Remove trailing spaces before newlines
      .replace(/\n[ \t]+/g, "\n"); // Remove leading spaces after newlines
  }

  // Load models from API
  async loadModels() {
    try {
      this.isLoadingModels = true;
      const response = await fetchWithRetry("/api/models", {}, {
        maxRetries: 3,
        onRetry: (attempt) => {
          console.log(`[RETRY] Loading models - attempt ${attempt}/3`);
        }
      });
      if (response.ok) {
        const data = await response.json();
        this.models = data.models;

        // Set default model based on user login status
        if (this.models.length > 0) {
          if (!this.userId) {
            // Non-logged in user: try to use first configured guest model
            const firstConfiguredGuestModel = GUEST_ALLOWED_MODELS.find(modelName =>
              this.models.some(m => m.name === modelName)
            );

            if (firstConfiguredGuestModel) {
              this.selectedModel = firstConfiguredGuestModel;
            } else {
              // Fallback: find first guest-allowed model from the models list
              const firstGuestAllowed = this.models.find(m => m.isGuestAllowed);
              if (firstGuestAllowed) {
                this.selectedModel = firstGuestAllowed.name;
                console.warn(`Configured guest models not found, using fallback: ${firstGuestAllowed.name}`);
              } else {
                // Last resort: use first available model but log warning
                this.selectedModel = this.models[0].name;
                console.warn(`No guest-allowed models found, using fallback: ${this.models[0].name}`);
              }
            }
          } else if (!this.selectedModel) {
            // Logged in user: use first available model if none selected
            this.selectedModel = this.models[0].name;
          }
        }
      }
    } catch (err) {
      console.error("Failed to load models:", err);
    } finally {
      // Add a small delay to ensure model enrichment completes
      setTimeout(() => {
        this.isLoadingModels = false;
      }, 1500); // Wait for OpenRouter enrichment to complete
    }
  }

  // Load guest message count from sessionStorage
  loadGuestMessageCount() {
    if (!browser || this.userId) return;

    try {
      const stored = sessionStorage.getItem('guestMessageCount');
      this.guestMessageCount = stored ? parseInt(stored, 10) : 0;
    } catch (err) {
      console.warn('Failed to load guest message count:', err);
      this.guestMessageCount = 0;
    }
  }

  // Save guest message count to sessionStorage
  saveGuestMessageCount() {
    if (!browser || this.userId) return;

    try {
      sessionStorage.setItem('guestMessageCount', this.guestMessageCount.toString());
    } catch (err) {
      console.warn('Failed to save guest message count:', err);
    }
  }

  // Check if guest has reached message limit
  canGuestSendMessage(): boolean {
    if (this.userId) return true; // Logged in users have no limit
    return this.guestMessageCount < GUEST_MESSAGE_LIMIT;
  }

  // Increment guest message count
  incrementGuestMessageCount() {
    if (!this.userId) {
      this.guestMessageCount++;
      this.saveGuestMessageCount();
    }
  }

  // Reset guest message count (when user logs in)
  resetGuestMessageCount() {
    this.guestMessageCount = 0;
    if (browser) {
      try {
        sessionStorage.removeItem('guestMessageCount');
      } catch (err) {
        console.warn('Failed to clear guest message count:', err);
      }
    }
  }

  // Validate model selection using server-provided flags
  validateModelSelection(modelName: string): boolean {
    const model = this.models.find(m => m.name === modelName);
    if (!model) {
      console.warn(`Model ${modelName} not found in available models`);
      return false;
    }

    // Use the isLocked flag that's set by the server based on user status and demo mode
    return !model.isLocked;
  }

  // Safe model selection with validation
  selectModel(modelName: string): boolean {
    if (!this.validateModelSelection(modelName)) {
      const model = this.models.find(m => m.name === modelName);
      let errorMsg: string;

      if (!this.userId) {
        // Guest user error message
        errorMsg = "Guest users can only use the allowed guest models. Please sign up for access to all models.";
      } else if (this.userId && model?.isDemoMode) {
        // Demo mode error message (logged in user in demo mode)
        errorMsg = "This model is not available in Demo Mode. Contact administrator for full access.";
      } else {
        // Fallback error message
        errorMsg = "This model is not available with your current access level.";
      }

      this.error = errorMsg;
      toast.error(errorMsg);
      return false;
    }

    this.selectedModel = modelName;
    this.error = null;
    return true;
  }

  // Load chat history from API
  async loadChatHistory() {
    try {
      const response = await fetchWithRetry("/api/chats", {}, {
        maxRetries: 3,
        onRetry: (attempt) => {
          console.log(`[RETRY] Loading chat history - attempt ${attempt}/3`);
        }
      });
      if (response.ok) {
        const data = await response.json();
        this.chatHistory = data.chats;
      } else if (response.status === 401) {
        // User not authenticated, clear chat history
        this.chatHistory = [];
      }
    } catch (err) {
      console.error("Failed to load chat history:", err);
    }
  }

  // Refresh chat history (useful when auth state changes)
  async refreshChatHistory() {
    await this.loadChatHistory();
  }

  // Generate chat title from first message
  generateChatTitle(content: string): string {
    const words = content.trim().split(" ").slice(0, 6);
    return (
      words.join(" ") + (content.trim().split(" ").length > 6 ? "..." : "")
    );
  }

  // Format date for display (shows in user's local timezone)
  formatDate(dateString: string): string {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    // Normalize dates to start of day for accurate comparison
    const normalizeDate = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

    const normalizedDate = normalizeDate(date);
    const normalizedToday = normalizeDate(today);
    const normalizedYesterday = normalizeDate(yesterday);

    if (normalizedDate.getTime() === normalizedToday.getTime()) {
      return "Today";
    } else if (normalizedDate.getTime() === normalizedYesterday.getTime()) {
      return "Yesterday";
    } else {
      return date.toLocaleDateString();
    }
  }

  // Load chat from URL (no URL update needed)
  async loadChatFromId(chatId: string) {
    if (this.isLoadingChat) return;

    try {
      this.isLoadingChat = true;
      this.isLoadingChatData = true;

      const response = await fetchWithRetry(`/api/chats/${chatId}`, {}, {
        maxRetries: 3,
        onRetry: (attempt) => {
          console.log(`[RETRY] Loading chat ${chatId} - attempt ${attempt}/3`);
        }
      });
      if (response.ok) {
        const data = await response.json();

        // Clear current state first for smooth transition
        this.messages = [];
        this.error = null;
        this.currentChatId = chatId;
        this.clearSelectedTool(); // Clear tool selection when loading existing chat
        this.resetFreshChatFlag(); // Reset fresh chat flag for existing chat loads

        // Small delay to ensure smooth transition
        await new Promise((resolve) => setTimeout(resolve, 50));

        // Set model first, then messages to avoid triggering the dialog
        this.selectedModel = data.chat.model;
        this.previousModel = data.chat.model; // Update previous model to match
        // Clean all message content when loading from database
        this.messages = data.chat.messages.map((msg: AIMessage) => ({
          ...msg,
          content: this.cleanMessageContent(msg.content || ''),
        }));

        // Refresh chat history to show updated order
        this.loadChatHistory();
        return true;
      } else {
        return false; // Chat not found or unauthorized
      }
    } catch (err) {
      console.error("Failed to load chat:", err);
      this.error = "Failed to load chat";
      return false;
    } finally {
      this.isLoadingChat = false;
      this.isLoadingChatData = false;
    }
  }

  // Load chat and update URL (for navigation from sidebar)
  async loadChat(chatId: string) {
    // Skip loading if this chat is already active
    if (this.currentChatId === chatId) {
      // Still ensure URL is correct
      goto(`/chat/${chatId}`, { replaceState: true, noScroll: true });
      return;
    }

    const success = await this.loadChatFromId(chatId);
    if (success) {
      // Update URL to new route structure
      goto(`/chat/${chatId}`, { replaceState: true, noScroll: true });
    }
  }

  // Start new chat
  startNewChat() {
    // Set loading flag to prevent model change dialog
    this.isLoadingChatData = true;
    // Clear chat state
    this.currentChatId = null;
    this.messages = [];
    this.error = null;
    this.clearSelectedTool(); // Clear tool selection when starting new chat
    this.resetFreshChatFlag(); // Reset fresh chat flag when starting new chat
    // Sync previous model with current selection
    this.previousModel = this.selectedModel;
    // Navigate to root URL
    goto("/", { replaceState: true, noScroll: true });
    // Reset loading flag
    this.isLoadingChatData = false;
  }

  // Save or update chat
  async saveChat() {
    if (this.messages.length === 0) return;

    try {
      const title = this.generateChatTitle(this.messages[0].content || 'Untitled Chat');

      if (this.currentChatId) {
        // Update existing chat
        const response = await fetchWithRetry(`/api/chats/${this.currentChatId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title,
            model: this.selectedModel,
            messages: this.messages,
          }),
        }, {
          maxRetries: 3,
          onRetry: (attempt) => {
            console.log(`[RETRY] Updating chat ${this.currentChatId} - attempt ${attempt}/3`);
          }
        });

        if (response.ok) {
          const updatedChat = await response.json();

          // Update the chat in local state immediately for better UX
          const chatIndex = this.chatHistory.findIndex(
            (chat) => chat.id === this.currentChatId
          );
          if (chatIndex !== -1) {
            // Update the existing chat and move it to the top
            const updated = { ...this.chatHistory[chatIndex], ...updatedChat.chat };
            this.chatHistory = [
              updated,
              ...this.chatHistory.filter((chat) => chat.id !== this.currentChatId),
            ];
          }
          // Also refresh from server to ensure consistency
          this.loadChatHistory();
        }
      } else {
        // Create new chat
        const response = await fetchWithRetry("/api/chats", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title,
            model: this.selectedModel,
            messages: this.messages
          }),
        }, {
          maxRetries: 3,
          onRetry: (attempt) => {
            console.log(`[RETRY] Creating new chat - attempt ${attempt}/3`);
          }
        });

        if (response.ok) {
          const data = await response.json();
          this.currentChatId = data.chat.id;
          this.markAsFreshChat(); // Mark as fresh chat to preserve tool selection
          // Update URL to reflect the new chat with new route structure
          goto(`/chat/${data.chat.id}`, {
            replaceState: true,
            noScroll: true,
          });
          this.loadChatHistory(); // Refresh chat history
        }
      }
    } catch (err) {
      console.error("Failed to save chat:", err);
    }
  }

  // Start delete process - show confirmation dialog
  startDeleteChat(chatId: string) {
    this.deletingChatId = chatId;
  }

  // Cancel delete process
  cancelDelete() {
    this.deletingChatId = null;
  }

  // Handle model change confirmation
  confirmModelChange() {
    if (this.pendingModelChange) {
      this.selectedModel = this.pendingModelChange;
      this.previousModel = this.pendingModelChange;
      this.startNewChat();
    }
    this.showModelChangeDialog = false;
    this.pendingModelChange = null;
  }

  // Cancel model change
  cancelModelChange() {
    this.showModelChangeDialog = false;
    this.pendingModelChange = null;
  }

  // Confirm and delete chat
  async confirmDeleteChat() {
    if (!this.deletingChatId) return;

    try {
      const response = await fetchWithRetry(`/api/chats/${this.deletingChatId}`, {
        method: "DELETE",
      }, {
        maxRetries: 3,
        onRetry: (attempt) => {
          console.log(`[RETRY] Deleting chat ${this.deletingChatId} - attempt ${attempt}/3`);
        }
      });

      if (response.ok) {
        // Show success toast
        toast.success("Chat deleted successfully");

        // If deleting current chat, clear state and go to home
        if (this.currentChatId === this.deletingChatId) {
          this.currentChatId = null;
          this.messages = [];
          this.error = null;
          goto("/", { replaceState: true, noScroll: true });
        }
        this.loadChatHistory();
      } else {
        // Show error toast for failed deletion
        toast.error("Failed to delete chat");
      }
    } catch (err) {
      console.error("Failed to delete chat:", err);
      toast.error("Failed to delete chat");
    } finally {
      this.deletingChatId = null;
    }
  }

  // Toggle pin status for a chat
  async toggleChatPin(chatId: string) {
    try {
      const response = await fetchWithRetry(`/api/chats/${chatId}/pin`, {
        method: "PATCH",
      }, {
        maxRetries: 3,
        onRetry: (attempt) => {
          console.log(`[RETRY] Toggling pin for chat ${chatId} - attempt ${attempt}/3`);
        }
      });

      if (response.ok) {
        const { chat } = await response.json();
        // Show success toast
        toast.success(chat.pinned ? "Chat pinned" : "Chat unpinned");
        // Refresh chat history to reflect changes
        this.loadChatHistory();
      } else {
        toast.error("Failed to update pin status");
      }
    } catch (err) {
      console.error("Failed to toggle pin:", err);
      toast.error("Failed to update pin status");
    }
  }

  // Derived state for pinned chats
  get pinnedChats() {
    return this.chatHistory.filter(chat => chat.pinned);
  }

  // Derived state for unpinned chats (recent chats)
  get recentChats() {
    return this.chatHistory.filter(chat => !chat.pinned);
  }

  // Start editing chat title
  startEditingTitle(chatId: string, currentTitle: string) {
    this.editingChatId = chatId;
    this.editingTitle = currentTitle;
  }

  // Cancel editing
  cancelEditing() {
    this.editingChatId = null;
    this.editingTitle = "";
  }

  // Save renamed chat title
  async saveRenamedTitle(chatId: string) {
    if (!this.editingTitle.trim()) return;

    try {
      // Get the full chat data first
      const chatResponse = await fetchWithRetry(`/api/chats/${chatId}`, {}, {
        maxRetries: 3,
        onRetry: (attempt) => {
          console.log(`[RETRY] Fetching chat data for rename ${chatId} - attempt ${attempt}/3`);
        }
      });
      if (!chatResponse.ok) {
        toast.error("Failed to rename chat");
        return;
      }

      const chatData = await chatResponse.json();

      const response = await fetchWithRetry(`/api/chats/${chatId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: this.editingTitle.trim(),
          model: chatData.chat.model,
          messages: chatData.chat.messages,
        }),
      }, {
        maxRetries: 3,
        onRetry: (attempt) => {
          console.log(`[RETRY] Saving renamed title for chat ${chatId} - attempt ${attempt}/3`);
        }
      });

      if (response.ok) {
        toast.success("Chat renamed successfully");
        this.cancelEditing();
        this.loadChatHistory();
      } else {
        toast.error("Failed to rename chat");
      }
    } catch (err) {
      console.error("Failed to rename chat:", err);
      toast.error("Failed to rename chat");
    }
  }

  // File attachment methods
  addAttachedFiles(files: AttachedFile[]) {
    this.attachedFiles = [...this.attachedFiles, ...files];
  }

  removeAttachedFile(fileId: string) {
    this.attachedFiles = this.attachedFiles.filter(f => f.id !== fileId);
  }

  clearAttachedFiles() {
    this.attachedFiles = [];
  }

  async uploadAttachedFiles(): Promise<void> {
    if (this.attachedFiles.length === 0) return;

    this.isUploadingFiles = true;

    try {
      for (const file of this.attachedFiles) {
        if (file.type.startsWith('image/') && !file.uploadedImageId) {
          // Upload image files to server
          const formData = new FormData();
          formData.append('file', file.file);

          // Convert file to base64 for API
          const reader = new FileReader();
          const base64Promise = new Promise<string>((resolve, reject) => {
            reader.onload = () => {
              const result = reader.result as string;
              const base64Data = result.split(',')[1]; // Remove data URL prefix
              resolve(base64Data);
            };
            reader.onerror = reject;
          });
          reader.readAsDataURL(file.file);

          const base64Data = await base64Promise;

          const response = await fetchWithRetry('/api/images', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              imageData: base64Data,
              mimeType: file.type,
              filename: file.name,
              chatId: this.currentChatId
            })
          }, {
            maxRetries: 3,
            onRetry: (attempt) => {
              console.log(`[RETRY] Uploading image ${file.name} - attempt ${attempt}/3`);
            }
          });

          if (response.ok) {
            const result = await response.json();
            file.uploadedImageId = result.imageId;
          } else {
            throw new Error(`Failed to upload ${file.name}`);
          }
        }
      }
    } catch (error) {
      console.error('Error uploading files:', error);
      toast.error('Failed to upload files');
      throw error;
    } finally {
      this.isUploadingFiles = false;
    }
  }

  // Check if selected model supports image input
  selectedModelSupportsImageInput(): boolean {
    const model = this.models.find(m => m.name === this.selectedModel);
    return model?.supportsImageInput === true;
  }

  // Check if any attached files are images
  hasImageAttachments(): boolean {
    return this.attachedFiles.some(f => f.type.startsWith('image/'));
  }

  // Check if any attached files are text
  hasTextAttachments(): boolean {
    return this.attachedFiles.some(f =>
      f.type.startsWith('text/') || f.type === 'application/json'
    );
  }

  // Tool selection methods
  /**
   * Set the selected tool for the current chat session.
   */
  setSelectedTool(tool: string | undefined) {
    this.selectedTool = tool;
  }

  /**
   * Clear the currently selected tool.
   */
  clearSelectedTool() {
    this.selectedTool = undefined;
  }

  /**
   * Mark the current chat as freshly created to preserve tool selection during navigation.
   * This flag is used to distinguish between new chat creation (tool persists) and
   * existing chat navigation (tool clears).
   */
  markAsFreshChat() {
    this.isFreshChat = true;
  }

  /**
   * Reset the fresh chat flag. This should be called after handling the fresh chat state
   * or when navigating to ensure the flag doesn't persist incorrectly.
   */
  resetFreshChatFlag() {
    this.isFreshChat = false;
  }

  // Prompt Refinement Methods
  /**
   * Request prompt refinement for the first message in a chat
   */
  requestPromptRefinement(prompt: string) {
    console.log('[Prompt Refinement] Showing refiner with prompt:', prompt);
    this.pendingPrompt = prompt;
    this.showPromptRefiner = true;
  }

  /**
   * Manually trigger prompt refinement (for testing or user request)
   */
  triggerRefinementManually() {
    if (this.prompt.trim()) {
      console.log('[Prompt Refinement] Manual trigger activated');
      this.requestPromptRefinement(this.prompt);
    }
  }

  /**
   * Toggle prompt refinement feature on/off
   */
  togglePromptRefinement() {
    this.enablePromptRefinement = !this.enablePromptRefinement;
    console.log('[Prompt Refinement] Feature', this.enablePromptRefinement ? 'ENABLED' : 'DISABLED');
  }

  /**
   * Execute refined prompt with selected agents and settings
   */
  executeRefinedPrompt(refinedPrompt: string, agents: any[], settings: any) {
    console.log('[Prompt Refinement] Executing refined prompt with agents:', agents);
    this.selectedAgents = agents;
    this.refinedPromptSettings = settings;
    this.showPromptRefiner = false;
    this.pendingPrompt = null;

    // Set skip flag to prevent re-triggering refinement
    this.skipRefinement = true;

    // Set the prompt and execute
    this.prompt = refinedPrompt;
    this.handleSubmit();
  }

  /**
   * Cancel refinement and return to editing
   */
  cancelRefinement() {
    console.log('[Prompt Refinement] Cancelled');
    this.showPromptRefiner = false;
    this.pendingPrompt = null;
  }

  // Submit chat message
  async handleSubmit() {
    if ((!this.prompt && this.attachedFiles.length === 0) || this.isLoading) return;

    // Use the ChatState's selectedTool
    const toolToUse = this.selectedTool;

    // Check if this is the first message and should trigger refinement
    const shouldTriggerRefinement =
      this.enablePromptRefinement &&
      this.messages.length === 0 &&
      !this.showPromptRefiner &&
      !this.skipRefinement &&
      this.prompt.trim();

    console.log('[Prompt Refinement] Debug:', {
      enabled: this.enablePromptRefinement,
      messagesLength: this.messages.length,
      showPromptRefiner: this.showPromptRefiner,
      skipRefinement: this.skipRefinement,
      hasPrompt: !!this.prompt.trim(),
      willTrigger: shouldTriggerRefinement
    });

    if (shouldTriggerRefinement) {
      console.log('[Prompt Refinement] TRIGGERING automatic refinement');
      this.requestPromptRefinement(this.prompt);
      return;
    }

    // Reset skip refinement flag after checking
    if (this.skipRefinement) {
      console.log('[Prompt Refinement] Resetting skip flag');
      this.skipRefinement = false;
    }

    // Check guest message limits
    if (!this.canGuestSendMessage()) {
      this.error = `You've reached the ${GUEST_MESSAGE_LIMIT} message limit for guest users. Please sign up for an account to continue chatting.`;
      toast.error(this.error);
      return;
    }

    // Auto-select best model based on prompt (if auto-mode is enabled and no manual override)
    if (this.isAutoSelectMode && !this.manualModelOverride && this.prompt.trim()) {
      this.loadingStatus = "🤖 Auto-selecting best model for your task...";
      this.autoSelectModel(this.prompt);
    }

    // Check if user is trying to use a locked model
    const selectedModelData = this.models.find(m => m.name === this.selectedModel);
    if (selectedModelData?.isLocked) {
      let errorMsg: string;
      if (!this.userId) {
        errorMsg = "Guest users can only use the allowed guest models. Please sign up for access to all models.";
      } else if (selectedModelData?.isDemoMode) {
        errorMsg = "This model is not available in Demo Mode. Contact administrator for full access.";
      } else {
        errorMsg = "This model is not available with your current access level.";
      }
      this.error = errorMsg;
      toast.error(errorMsg);
      return;
    }

    const cleanedPrompt = this.cleanMessageContent(this.prompt);
    // Don't submit if cleaned content is empty and no files attached
    if (!cleanedPrompt && this.attachedFiles.length === 0) return;

    try {
      // Upload files first if any
      if (this.attachedFiles.length > 0) {
        this.loadingStatus = `📎 Uploading ${this.attachedFiles.length} file${this.attachedFiles.length > 1 ? 's' : ''}...`;
        await this.uploadAttachedFiles();
      }

      // Create user message with attachments
      let messageContent = cleanedPrompt;

      // Add text file content to the message if present
      const textAttachments = this.attachedFiles.filter(f =>
        f.type.startsWith('text/') || f.type === 'application/json'
      );
      if (textAttachments.length > 0) {
        const fileContents = textAttachments.map(f =>
          `\n\n---\nFile: ${f.name} (${f.type})\n---\n${f.content || ''}`
        ).join('');
        messageContent = cleanedPrompt + fileContents;
      }

      const userMessage: AIMessage = {
        role: "user",
        content: messageContent,
        type: this.attachedFiles.some(f => f.type.startsWith('image/')) ? "image" : "text"
      };

      // Add image attachments to message (support multiple images)
      const imageAttachments = this.attachedFiles.filter(f => f.type.startsWith('image/'));
      if (imageAttachments.length > 0) {
        // Handle multiple images
        if (imageAttachments.length === 1) {
          // Single image - use backwards compatible fields
          const imageAttachment = imageAttachments[0];
          if (imageAttachment?.uploadedImageId) {
            userMessage.imageId = imageAttachment.uploadedImageId;
            userMessage.mimeType = imageAttachment.type;
          } else if (imageAttachment?.dataUrl && imageAttachment.type) {
            // If we have base64 data but no uploaded ID, use the data directly
            const base64Data = imageAttachment.dataUrl.split(',')[1]; // Remove data URL prefix
            userMessage.imageData = base64Data;
            userMessage.mimeType = imageAttachment.type;
          }
        } else {
          // Multiple images - use new array fields
          const uploadedImages = imageAttachments.filter(img => img.uploadedImageId);
          const dataImages = imageAttachments.filter(img => !img.uploadedImageId && img.dataUrl);

          if (uploadedImages.length > 0) {
            userMessage.imageIds = uploadedImages.map(img => img.uploadedImageId!);
          }

          if (dataImages.length > 0 || uploadedImages.length > 0) {
            userMessage.images = imageAttachments.map(img => {
              if (img.uploadedImageId) {
                return {
                  imageId: img.uploadedImageId,
                  mimeType: img.type
                };
              } else if (img.dataUrl) {
                const base64Data = img.dataUrl.split(',')[1]; // Remove data URL prefix
                return {
                  imageData: base64Data,
                  mimeType: img.type
                };
              }
              return {
                mimeType: img.type
              };
            }).filter(img => img.imageId || img.imageData); // Filter out incomplete entries
          }
        }
      }

      // Add user message to conversation
      this.messages = [...this.messages, userMessage];

      // Increment guest message count for non-logged users
      this.incrementGuestMessageCount();

      this.prompt = "";
      this.clearAttachedFiles(); // Clear attachments after sending
      this.isLoading = true;
      this.loadingStartTime = Date.now();
      this.loadingStatus = `💭 Preparing message for ${this.getModelDisplayName(this.selectedModel)}...`;
      this.loadingMetadata = {
        model: this.selectedModel,
        messageCount: this.messages.length,
        attachmentCount: this.attachedFiles.length,
        temperature: 0.7,
        maxTokens: 2000
      };
      this.error = null;

      // Save chat immediately after user message to prevent loss on refresh
      try {
        await this.saveChat();
      } catch (saveError) {
        console.warn("Failed to save chat after user message:", saveError);
        // Continue with AI request even if initial save fails
      }

      // Check model capabilities
      const selectedModelConfig = this.models.find(m => m.name === this.selectedModel);
      const isModelMultimodal = selectedModelConfig ? isMultimodal(selectedModelConfig) : false;
      const isVideoGenerationModel = selectedModelConfig?.supportsVideoGeneration;
      const hasImageInput = selectedModelConfig?.supportsImageInput;
      const hasImageAttachments = userMessage.imageId || (userMessage.imageIds && userMessage.imageIds.length > 0) || (userMessage.images && userMessage.images.length > 0) || userMessage.type === "image";

      // Check if this is a Gemini model being used for pure image generation
      // (no image attachments - just a text prompt for image generation)
      const isGeminiPureImageGeneration = selectedModelConfig?.provider === 'Google' &&
        selectedModelConfig?.supportsImageGeneration &&
        this.selectedModel.includes('gemini') &&
        !hasImageAttachments && // No image inputs
        !isVideoGenerationModel; // Not a video model

      // Original logic for pure image generation models (like Imagen)
      const isImageGenerationModel = selectedModelConfig?.supportsImageGeneration && !isModelMultimodal;

      // Use regular chat API for models that support image input and have image attachments
      // OR for Google Gemini models in multimodal conversation context (but NOT for pure image generation)
      const useMultimodalApi = ((isModelMultimodal || hasImageInput) && hasImageAttachments) ||
        (selectedModelConfig?.provider === 'Google' &&
          selectedModelConfig?.supportsImageGeneration &&
          this.selectedModel.includes('gemini') &&
          hasImageAttachments); // Only when there are actual image attachments

      if (isGeminiPureImageGeneration) {
        console.log('🖼️ Using IMAGE GENERATION API path for Gemini pure image generation');
        this.loadingStatus = `🎨 Generating image with ${this.getModelDisplayName(this.selectedModel)}...`;
        // Use image generation API for Gemini models when used for pure image generation
        const response = await fetchWithRetry("/api/image-generation", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: this.selectedModel,
            prompt: cleanedPrompt,
          }),
        }, {
          maxRetries: 3,
          onRetry: (attempt) => {
            console.log(`[RETRY] Gemini image generation - attempt ${attempt}/3`);
            this.loadingStatus = `🔄 Retrying image generation (${attempt}/3)...`;
          }
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to generate image");
        }

        const imageResponse = await response.json();

        const assistantMessage: AIMessage = {
          role: "assistant" as const,
          content: `Generated image for: "${cleanedPrompt}"`,
          model: this.selectedModel,
          imageId: imageResponse.imageId,
          imageUrl: imageResponse.imageUrl, // Keep for backwards compatibility
          imageData: imageResponse.imageData, // Keep for backwards compatibility
          mimeType: imageResponse.mimeType,
          type: "image"
        };

        this.messages = [...this.messages, assistantMessage];
      } else if (useMultimodalApi && !isVideoGenerationModel) {
        console.log('🔀 Using MULTIMODAL CHAT API path');
        console.log('Reason: hasImageAttachments =', hasImageAttachments, ', isGeminiModel =',
          selectedModelConfig?.provider === 'Google' && selectedModelConfig?.supportsImageGeneration && this.selectedModel.includes('gemini'));
        this.loadingStatus = `🧠 ${this.getModelDisplayName(this.selectedModel)} is analyzing...`;
        // Use regular chat API with multimodal message format
        const response = await fetchWithRetry("/api/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: this.selectedModel,
            messages: this.messages, // Send full conversation context
            maxTokens: 2000,
            temperature: 0.7,
            userId: this.userId,
            chatId: this.currentChatId,
            multimodal: true, // Flag to indicate this requires multimodal processing
            selectedTool: toolToUse, // Pass selected tool for function calling
          }),
        }, {
          maxRetries: 3,
          onRetry: (attempt) => {
            console.log(`[RETRY] Multimodal chat - attempt ${attempt}/3`);
            this.loadingStatus = `🔄 Retrying (${attempt}/3)...`;
          }
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to get multimodal response");
        }

        const aiResponse = await response.json();

        console.log('=== FRONTEND RESPONSE PROCESSING ===');
        console.log('Response status:', response.status);
        console.log('Response ok:', response.ok);
        console.log('AI Response:', JSON.stringify(aiResponse, null, 2));
        console.log('Response keys:', Object.keys(aiResponse));
        console.log('Has imageId?', 'imageId' in aiResponse);
        console.log('Has videoId?', 'videoId' in aiResponse);
        console.log('Has content?', 'content' in aiResponse);

        // Handle different response types from multimodal chat
        let assistantMessage: AIMessage;

        if ('imageId' in aiResponse) {
          console.log('✓ Creating IMAGE assistant message');
          const imagePrompt = aiResponse.prompt || cleanedPrompt || "image generation";
          assistantMessage = {
            role: "assistant" as const,
            content: `Generated image: ${imagePrompt}`,
            model: this.selectedModel,
            imageId: aiResponse.imageId,
            mimeType: aiResponse.mimeType,
            type: "image"
          };
          console.log('Image message created:', JSON.stringify(assistantMessage, null, 2));
        } else if ('videoId' in aiResponse) {
          console.log('✓ Creating VIDEO assistant message');
          const videoPrompt = aiResponse.prompt || cleanedPrompt || "video generation";
          assistantMessage = {
            role: "assistant" as const,
            content: `Generated video: ${videoPrompt}`,
            model: this.selectedModel,
            videoId: aiResponse.videoId,
            mimeType: aiResponse.mimeType,
            type: "video"
          };
          console.log('Video message created:', JSON.stringify(assistantMessage, null, 2));
        } else {
          console.log('✓ Creating TEXT assistant message');
          console.log('aiResponse.content:', aiResponse.content);
          console.log('fallback content:', "No response received");
          assistantMessage = {
            role: "assistant" as const,
            content: aiResponse.content || "No response received",
            model: this.selectedModel,
            type: "text"
          };
          console.log('Text message created:', JSON.stringify(assistantMessage, null, 2));
        }

        this.messages = [...this.messages, assistantMessage];
      } else if (isImageGenerationModel) {
        console.log('🖼️ Using IMAGE GENERATION API path');
        // Use image generation API for pure image models (Imagen)
        const response = await fetchWithRetry("/api/image-generation", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: this.selectedModel,
            prompt: cleanedPrompt,
          }),
        }, {
          maxRetries: 3,
          onRetry: (attempt) => {
            console.log(`[RETRY] Image generation (Imagen) - attempt ${attempt}/3`);
            this.loadingStatus = `🔄 Retrying image generation (${attempt}/3)...`;
          }
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to generate image");
        }

        const imageResponse = await response.json();

        const assistantMessage: AIMessage = {
          role: "assistant" as const,
          content: `Generated image for: "${cleanedPrompt}"`,
          model: this.selectedModel,
          imageId: imageResponse.imageId,
          imageUrl: imageResponse.imageUrl, // Keep for backwards compatibility
          imageData: imageResponse.imageData, // Keep for backwards compatibility
          mimeType: imageResponse.mimeType,
          type: "image"
        };

        this.messages = [...this.messages, assistantMessage];
      } else if (isVideoGenerationModel) {
        this.loadingStatus = `🎬 Generating video with ${this.getModelDisplayName(this.selectedModel)}... This may take a moment`;
        // Use chat API for video generation (handles video generation internally)
        const response = await fetchWithRetry("/api/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: this.selectedModel,
            messages: this.messages,
            maxTokens: 2000,
            temperature: 0.7,
            userId: this.userId,
            chatId: this.currentChatId,
          }),
        }, {
          maxRetries: 3,
          onRetry: (attempt) => {
            console.log(`[RETRY] Video generation - attempt ${attempt}/3`);
            this.loadingStatus = `🔄 Retrying video generation (${attempt}/3)...`;
          }
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to generate video");
        }

        const videoResponse = await response.json();

        const assistantMessage: AIMessage = {
          role: "assistant" as const,
          content: `Generated video for: "${cleanedPrompt}"`,
          model: this.selectedModel,
          videoId: videoResponse.videoId,
          mimeType: videoResponse.mimeType,
          type: "video"
        };

        this.messages = [...this.messages, assistantMessage];
      } else {
        console.log('💬 Using TEXT CHAT API path with STREAMING');
        this.loadingStatus = `✍️ ${this.getModelDisplayName(this.selectedModel)} is writing...`;

        // Use streaming text chat API
        const response = await fetchWithRetry("/api/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: this.selectedModel,
            messages: this.messages,
            maxTokens: 2000,
            temperature: 0.7,
            userId: this.userId,
            chatId: this.currentChatId,
            selectedTool: toolToUse,
            stream: true, // Enable streaming
          }),
        }, {
          maxRetries: 3,
          onRetry: (attempt) => {
            console.log(`[RETRY] Text chat streaming - attempt ${attempt}/3`);
            this.loadingStatus = `🔄 Retrying (${attempt}/3)...`;
          }
        });

        if (!response.ok) {
          const errorData = await response.json();
          const errorMsg = errorData.error || "Failed to get response";

          // Check for common API errors and provide actionable messages
          if (response.status === 402 || errorMsg.toLowerCase().includes('insufficient credits') || errorMsg.toLowerCase().includes('payment required')) {
            toast.error('⚠️ OpenRouter credits exhausted. Please add credits at https://openrouter.ai/credits');
            throw new Error('OpenRouter credits exhausted - please add credits');
          } else if (response.status === 401 || errorMsg.toLowerCase().includes('unauthorized') || errorMsg.toLowerCase().includes('invalid api key')) {
            toast.error('⚠️ API authentication failed. Please check your OpenRouter API key');
            throw new Error('API authentication failed');
          } else if (response.status === 429 || errorMsg.toLowerCase().includes('rate limit')) {
            toast.error('⚠️ Rate limit exceeded. Please wait a moment and try again');
            throw new Error('Rate limit exceeded');
          } else if (response.status === 503 || errorMsg.toLowerCase().includes('service unavailable')) {
            toast.error('⚠️ Model temporarily unavailable. Try a different model');
            throw new Error('Model service unavailable');
          } else {
            toast.error(`API Error: ${errorMsg}`);
            throw new Error(errorMsg);
          }
        }

        // Create a placeholder message that we'll update as chunks arrive
        const assistantMessage: AIMessage = {
          role: "assistant" as const,
          content: "",
          model: this.selectedModel,
          type: "text"
        };

        // Add the placeholder message - keep loading indicator visible during streaming
        this.messages = [...this.messages, assistantMessage];
        // Don't set isLoading = false yet - keep sticky header visible

        // Handle the streaming response
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) {
          throw new Error("No response body reader available");
        }

        try {
          let buffer = "";
          let accumulatedContent = "";
          let lastUpdateTime = Date.now();
          const UPDATE_INTERVAL = 16; // Update UI at 60fps (16.67ms) for buttery smooth rendering

          while (true) {
            const { done, value } = await reader.read();

            if (done) break;

            // Decode the chunk and add to buffer
            buffer += decoder.decode(value, { stream: true });

            // Process complete lines (SSE format: "data: {...}\n\n")
            const lines = buffer.split('\n\n');
            buffer = lines.pop() || ""; // Keep incomplete line in buffer

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6); // Remove "data: " prefix

                if (data === '[DONE]') {
                  // Stream complete - do final update with accumulated content
                  if (accumulatedContent) {
                    const currentMessages = [...this.messages];
                    const lastMessage = currentMessages[currentMessages.length - 1];
                    lastMessage.content = accumulatedContent;
                    this.messages = currentMessages;
                  }
                  break;
                }

                try {
                  const chunk = JSON.parse(data);
                  console.log('[Streaming] Parsed chunk:', { hasContent: !!chunk.content, hasError: !!chunk.error, contentLength: chunk.content?.length || 0 });

                  if (chunk.error) {
                    throw new Error(chunk.error);
                  }

                  // Accumulate content (append new token to existing content)
                  if (chunk.content) {
                    accumulatedContent += chunk.content;
                    console.log('[Streaming] Accumulated length:', accumulatedContent.length);

                    // Debounced UI update - only update every UPDATE_INTERVAL ms
                    const now = Date.now();
                    if (now - lastUpdateTime >= UPDATE_INTERVAL) {
                      console.log('[Streaming] Updating UI with content:', accumulatedContent.substring(0, 50) + '...');
                      const currentMessages = [...this.messages];
                      const lastMessage = currentMessages[currentMessages.length - 1];
                      lastMessage.content = accumulatedContent;
                      this.messages = currentMessages;
                      lastUpdateTime = now;
                    }
                  }
                } catch (e) {
                  console.error('Error parsing SSE chunk:', e);
                }
              }
            }
          }

          // Final update to ensure we have all content
          if (accumulatedContent) {
            const currentMessages = [...this.messages];
            const lastMessage = currentMessages[currentMessages.length - 1];
            lastMessage.content = accumulatedContent;
            this.messages = currentMessages;
          }
        } finally {
          reader.releaseLock();
        }
      }

      // Save chat after successful AI response (but don't let save errors affect the UI)
      try {
        await this.saveChat();
      } catch (saveError) {
        console.error("Failed to save chat after AI response:", saveError);
        // Don't throw - we successfully got the AI response, just failed to save
      }
    } catch (err) {
      console.error("Chat error:", err);
      this.error = err instanceof Error ? err.message : "An error occurred";
      // Remove the user message on error (only if AI request failed)
      this.messages = this.messages.slice(0, -1);
      // Restore the prompt
      this.prompt = cleanedPrompt;
    } finally {
      this.isLoading = false;
      this.loadingStatus = null;
      this.loadingStartTime = null;
      this.loadingMetadata = null;
      // Clear manual override after message sent, so next message can be auto-selected
      this.manualModelOverride = null;
    }
  }

  // Helper function to get model display name
  getModelDisplayName(modelName: string): string {
    const model = this.models.find((m) => m.name === modelName);
    return model?.displayName || "Select model";
  }

  // Toggle auto-select mode
  toggleAutoSelect(enable: boolean) {
    this.isAutoSelectMode = enable;
    if (!enable) {
      this.lastAutoSelection = null;
    }
    toast.success(enable ? "Auto-select enabled" : "Manual mode enabled");
  }

  // Auto-select best model based on prompt
  autoSelectModel(prompt: string): void {
    if (!this.isAutoSelectMode) return;

    try {
      const hasImages = this.attachedFiles.some(f => f.type.startsWith('image/'));
      const selection = selectBestModel(prompt, this.models, hasImages);

      this.selectedModel = selection.modelName;
      this.lastAutoSelection = selection;
      this.manualModelOverride = null;

      console.log('[Auto-Select]', getSelectionExplanation(selection));
    } catch (error) {
      console.error('[Auto-Select] Failed:', error);
      // Silently fall back to current model
    }
  }

  // Manually override auto-selection
  manuallySelectModel(modelName: string): boolean {
    if (!this.validateModelSelection(modelName)) {
      return false;
    }

    this.selectedModel = modelName;
    this.manualModelOverride = modelName;

    if (this.isAutoSelectMode) {
      toast.success(`Manual override: ${this.getModelDisplayName(modelName)}`);
    }

    return true;
  }

  // Get the effective model (respects manual override)
  getEffectiveModel(): string {
    return this.manualModelOverride || this.selectedModel;
  }

  // Re-analyze entire conversation with a new model
  async reAnalyzeConversation(newModelName: string): Promise<void> {
    if (this.messages.length === 0) {
      toast.error("No conversation to re-analyze");
      return;
    }

    if (!this.validateModelSelection(newModelName)) {
      toast.error("Selected model is not available");
      return;
    }

    try {
      this.isLoading = true;
      toast.info(`Re-analyzing conversation with ${this.getModelDisplayName(newModelName)}...`);

      // Filter to only user messages for re-analysis
      const userMessages = this.messages.filter(m => m.role === 'user');

      if (userMessages.length === 0) {
        toast.error("No user messages to re-analyze");
        return;
      }

      // Build combined prompt from all user messages
      const combinedPrompt = userMessages
        .map((m, idx) => `[Message ${idx + 1}] ${m.content}`)
        .join('\n\n');

      const reAnalysisPrompt = `Please re-analyze this conversation and provide a comprehensive response:\n\n${combinedPrompt}`;

      // Create new user message
      const userMessage: AIMessage = {
        role: "user",
        content: reAnalysisPrompt,
        type: "text"
      };

      // Clear existing messages and start fresh with new model
      this.messages = [userMessage];
      this.selectedModel = newModelName;
      this.manualModelOverride = newModelName;

      // Call AI with new model
      const response = await fetchWithRetry("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: newModelName,
          messages: [userMessage],
          maxTokens: 4000, // Larger for comprehensive re-analysis
          temperature: 0.7,
          userId: this.userId,
          chatId: this.currentChatId,
        }),
      }, {
        maxRetries: 3,
        onRetry: (attempt) => {
          console.log(`[RETRY] Re-analyzing conversation - attempt ${attempt}/3`);
          toast.info(`Retrying re-analysis (${attempt}/3)...`);
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to re-analyze conversation");
      }

      const aiResponse: AIResponse = await response.json();

      const assistantMessage: AIMessage = {
        role: "assistant" as const,
        content: aiResponse.content || "No response received",
        model: newModelName,
        type: "text"
      };

      this.messages = [...this.messages, assistantMessage];

      // Save the re-analyzed conversation
      await this.saveChat();

      toast.success(`Re-analysis complete with ${this.getModelDisplayName(newModelName)}`);
    } catch (err) {
      console.error("Re-analysis error:", err);
      this.error = err instanceof Error ? err.message : "Re-analysis failed";
      toast.error(this.error);
    } finally {
      this.isLoading = false;
    }
  }

  // Setup model change detection effect (DISABLED - allow model switching mid-chat)
  setupModelChangeDetection() {
    // Model change detection disabled - users can now switch models freely mid-conversation
    // The conversation history will be maintained and new messages will use the selected model
    $effect(() => {
      this.previousModel = this.selectedModel;
    });
  }
}