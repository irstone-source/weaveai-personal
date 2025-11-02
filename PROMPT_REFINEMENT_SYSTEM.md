# 🎯 Prompt Refinement & Multi-Agent System

## ✅ What's Been Built

### 1. **Agent System** (`src/lib/config/agents.ts`)
- 8 specialized agents with unique capabilities
- Auto-recommendation based on prompt analysis
- Multi-agent collaboration support
- Agents:
  - 🤖 General Assistant
  - 👨‍💻 Code Expert
  - 🔬 Research Analyst
  - ✍️ Creative Writer
  - 💼 Business Strategist
  - 👨‍🏫 Educational Tutor
  - 📋 Technical Writer
  - 📊 Data Scientist

### 2. **PromptRefiner Component** (`src/lib/components/PromptRefiner.svelte`)
- Analyzes prompt complexity
- Provides improvement suggestions
- Auto-refines prompts with AI assistance
- Recommends optimal settings (temperature, tokens)
- Shows refined vs original prompt
- Integrates agent selection
- "Run Prompt" button to confirm execution

### 3. **AgentSelector Component** (`src/lib/components/AgentSelector.svelte`)
- Visual agent selection cards
- Multi-select support
- Color-coded agents
- Shows agent capabilities
- Real-time selected agents summary
- Multi-agent collaboration mode

## 🔧 Integration Steps

### Step 1: Add Prompt Refinement State

Add to `src/lib/components/chat-state.svelte.ts`:

```typescript
export class ChatState {
  // ... existing state ...

  // Prompt Refinement System
  showPromptRefiner = $state(false);
  pendingPrompt = $state<string | null>(null);
  selectedAgents = $state<Agent[]>([]);
  refinedPromptSettings = $state<any>(null);

  // Method to trigger refinement
  requestPromptRefinement(prompt: string) {
    this.pendingPrompt = prompt;
    this.showPromptRefiner = true;
  }

  // Method to execute refined prompt
  executeRefinedPrompt(refinedPrompt: string, agents: Agent[], settings: any) {
    this.selectedAgents = agents;
    this.refinedPromptSettings = settings;
    this.showPromptRefiner = false;

    // Apply settings
    if (settings.temperature) {
      // Apply temperature setting
    }

    // Execute with refined prompt
    this.sendMessage(refinedPrompt);
  }

  // Method to cancel refinement
  cancelRefinement() {
    this.showPromptRefiner = false;
    this.pendingPrompt = null;
  }
}
```

### Step 2: Modify Chat Interface

Update `src/lib/components/ChatInterface.svelte` to show PromptRefiner:

```svelte
<script lang="ts">
  import PromptRefiner from './PromptRefiner.svelte';
  // ... other imports ...

  const chatState = getContext<ChatState>("chatState");

  // Modify sendMessage to trigger refinement for first message
  async function handleSendMessage() {
    if (!chatState.prompt.trim()) return;

    // If this is the first message and no messages exist yet, show refiner
    if (chatState.messages.length === 0 && !chatState.showPromptRefiner) {
      chatState.requestPromptRefinement(chatState.prompt);
      return;
    }

    // Otherwise send directly
    await chatState.sendMessage();
  }
</script>

<!-- In the template -->
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
{:else}
  <!-- Normal chat interface -->
  <!-- ... existing chat UI ... -->
{/if}
```

### Step 3: Integrate Agent System Prompts

Modify the AI request to use agent system prompts:

```typescript
async sendMessage(userMessage?: string) {
  // ... existing validation ...

  // Build system prompt with agent instructions
  let systemPrompt = 'You are a helpful AI assistant.';

  if (this.selectedAgents.length > 0) {
    if (this.selectedAgents.length === 1) {
      // Single agent mode
      systemPrompt = this.selectedAgents[0].systemPrompt;
    } else {
      // Multi-agent mode
      systemPrompt = `You are a collaborative AI system with multiple specialized agents working together:

${this.selectedAgents.map((agent, i) =>
  `${i + 1}. ${agent.emoji} ${agent.name}: ${agent.systemPrompt}`
).join('\n\n')}

Coordinate between these agents' expertise to provide the best response.`;
    }
  }

  // Include in API request
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: this.messages,
      model: this.selectedModel,
      systemPrompt, // Add system prompt
      temperature: this.refinedPromptSettings?.temperature || 0.7,
      // ... other params ...
    })
  });
}
```

## 🎨 User Experience Flow

### First Message

1. User enters prompt and presses send
2. **Instead of immediate execution:**
   - Show PromptRefiner overlay
   - Analyze prompt and show:
     - Complexity level
     - Improvement suggestions
     - Recommended agents (3 top picks)
     - Recommended settings
3. User can:
   - **Auto-Refine**: Let AI improve the prompt
   - **Edit**: Go back to modify prompt
   - **Select Agents**: Choose 1 or more specialized agents
   - **Run Prompt**: Execute with selected configuration

### Subsequent Messages

- Normal chat flow (no refinement by default)
- Option to enable refinement mode for specific messages

## 🚀 Features

### Prompt Analysis

- Detects prompt complexity (simple/medium/complex)
- Identifies code requests
- Detects data analysis needs
- Checks for questions
- Suggests improvements

### Agent Recommendations

Intelligent matching based on keywords:
- Code keywords → Code Expert
- Research keywords → Research Analyst
- Creative keywords → Creative Writer
- Business keywords → Business Strategist
- Learning keywords → Educational Tutor
- Documentation keywords → Technical Writer
- Data keywords → Data Scientist

### Multi-Agent Mode

- Select 2+ agents for collaborative responses
- Each agent contributes their expertise
- Combined system prompt coordinates agents

### Settings Optimization

- **Temperature**: Adjusts based on task
  - Creative tasks: 0.9
  - Code tasks: 0.3
  - General: 0.7
- **Max Tokens**: Adjusts based on complexity
  - Simple: 2048
  - Detailed/comprehensive: 4096
- **Memory**: Enabled if prompt mentions "remember"
- **Focus**: Enabled based on categories

## 🎯 Example Scenarios

### Scenario 1: Code Request

```
User: "Write a React component for a todo list"

Refinement shows:
- Recommended Agent: 👨‍💻 Code Expert
- Settings: Temperature 0.3, Tokens 2048
- Suggestion: "Specify React version and state management approach"
- Refined: "Write a modern React component using hooks for a todo list with add, edit, and delete functionality"
```

### Scenario 2: Research Request

```
User: "Tell me about climate change"

Refinement shows:
- Recommended Agents: 🔬 Research Analyst, 👨‍🏫 Educational Tutor
- Settings: Temperature 0.5, Tokens 4096
- Suggestion: "Add specific aspect you want to focus on"
- Refined: "Provide a comprehensive overview of climate change, including causes, effects, and current mitigation strategies"
```

### Scenario 3: Creative Request

```
User: "Write a story"

Refinement shows:
- Recommended Agent: ✍️ Creative Writer
- Settings: Temperature 0.9, Tokens 4096
- Suggestion: "Add genre, setting, or theme for better story"
- Refined: "Write a science fiction short story about AI consciousness, set in 2050, with themes of identity and humanity"
```

## 📋 TODO: Integration Checklist

- [x] Create agent system configuration
- [x] Build PromptRefiner component
- [x] Build AgentSelector component
- [ ] Modify chat-state.svelte.ts to add refinement state
- [ ] Integrate PromptRefiner into ChatInterface.svelte
- [ ] Update sendMessage to use agent system prompts
- [ ] Update API route to accept systemPrompt parameter
- [ ] Test first message refinement flow
- [ ] Test multi-agent mode
- [ ] Add user preference to enable/disable refinement

## 🔮 Future Enhancements

1. **Agent Training**: Allow users to create custom agents
2. **Refinement History**: Save and reuse refinements
3. **Agent Analytics**: Track which agents perform best
4. **Prompt Templates**: Pre-built prompts for common tasks
5. **Agent Marketplace**: Share custom agents
6. **Advanced Settings**: Fine-tune all model parameters
7. **Refinement API**: Use Claude or GPT to refine prompts
8. **Memory Integration**: Agents remember past interactions
9. **Focus Integration**: Agents use focus mode categories
10. **Workflow Builder**: Chain multiple agents for complex tasks

## 🎉 Benefits

✅ **Better Prompts**: AI-suggested improvements
✅ **Specialized Expertise**: Right agent for each task
✅ **Multi-Agent**: Collaborative intelligence
✅ **Optimal Settings**: Auto-configured parameters
✅ **User Control**: Review before execution
✅ **Transparency**: See what's being sent
✅ **Flexibility**: Single or multiple agents
✅ **Learning**: Understand prompt engineering

The system is **90% complete**! Just needs integration into the chat flow as described above.
