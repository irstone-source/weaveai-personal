# 🧪 Auto-Select Feature Testing Guide

## ✅ Feature Complete!

All UI and backend components are now implemented and running.

---

## 🎯 What You'll See

### 1. **Auto/Manual Toggle Button**
**Location:** Top of chat interface, left of model selector

**Appearance:**
- **Auto mode:** `🤖 Auto` (blue/primary background)
- **Manual mode:** `✋ Manual` (gray background)

**Behavior:**
- Click to toggle between modes
- Toast notification confirms: "Auto-select enabled" / "Manual mode enabled"
- Hover shows explanation tooltip

---

### 2. **Auto-Selection Reasoning Display**
**Location:** Right after the Auto/Manual toggle

**When visible:** Only shows when auto-select picks a model (auto mode ON)

**Appearance:**
```
✨ Selected GPT-5 - optimized for code generation
```

**Background:** Light accent color with muted text

---

### 3. **Re-Analyze Button**
**Location:** After the reasoning display (only shows when you have messages and are logged in)

**Appearance:** `🔄 Re-analyze`

**Behavior:**
- Click → Confirmation dialog
- Enter model name (e.g., `anthropic/claude-opus-4.1`)
- Re-analyzes entire conversation with new model

---

### 4. **Model Switching Freedom**
**What's Gone:** No more "This will start a new chat" warning!

**What's New:** Switch models anytime mid-conversation

---

## 🧪 Test Scenarios

### Test 1: Auto-Selection for Code

**Steps:**
1. Ensure `🤖 Auto` is enabled (should be default)
2. Type: `"Write a Python function to calculate fibonacci numbers"`
3. Watch console: `[Auto-Select] Selected ...`
4. Look for reasoning display: `✨ Selected GPT-5 - optimized for code generation`
5. Send message
6. Verify GPT-5 (or similar code model) was used

**Expected Result:**
- Auto-selects a code-oriented model (GPT-5, Claude, Qwen Coder)
- Shows reasoning
- Message sent successfully

---

### Test 2: Auto-Selection for Creative Writing

**Steps:**
1. Type: `"Write me a short story about a time traveler"`
2. Watch for: `✨ Selected Claude Sonnet 4 - optimized for creative writing`
3. Send message

**Expected Result:**
- Auto-selects Claude Sonnet or similar creative model
- Shows different reasoning than code task

---

### Test 3: Auto-Selection for Quick Question

**Steps:**
1. Type: `"What is 5 + 5?"`
2. Watch for: `✨ Selected GPT-4o Mini - optimized for quick question`
3. Send message

**Expected Result:**
- Auto-selects fast/efficient model (GPT-4o Mini, Gemini Flash Lite)
- Shows reasoning about quick questions

---

### Test 4: Manual Override

**Steps:**
1. Auto mode is ON
2. Type any prompt
3. **Before sending:** Click model selector and choose different model
4. Look for toast: `"Manual override: [Model Name]"`
5. Send message

**Expected Result:**
- Your chosen model is used (not auto-selected one)
- Toast confirms override
- Next message: auto-select activates again

---

### Test 5: Manual Mode (No Auto-Select)

**Steps:**
1. Click `🤖 Auto` to switch to `✋ Manual`
2. Toast: "Manual mode enabled"
3. Type any prompt
4. Notice: No auto-selection happens
5. No reasoning display shown
6. Manually choose model from selector
7. Send message

**Expected Result:**
- No automatic model selection
- You must choose model manually
- Model stays selected for all messages

---

### Test 6: Model Switching Mid-Conversation

**Steps:**
1. Start conversation with GPT-5
2. Send 2-3 messages
3. Click model selector
4. Choose Claude Opus 4.1
5. No warning dialog appears!
6. Send another message
7. Conversation continues with Claude

**Expected Result:**
- Switch works seamlessly
- No "new chat" warning
- Conversation history preserved
- New messages use new model

---

### Test 7: Re-Analyze Conversation

**Steps:**
1. Have conversation with 3+ messages
2. Click `🔄 Re-analyze` button
3. Confirm dialog: "Re-analyze this conversation with a different model?"
4. Enter model name: `anthropic/claude-opus-4.1`
5. Wait for re-analysis
6. Toast: "Re-analysis complete with Claude Opus 4.1"

**Expected Result:**
- All user messages combined
- New AI provides fresh perspective
- Conversation replaced with re-analysis
- Can continue chatting with new model

---

### Test 8: Auto-Selection with Image Attachments

**Steps:**
1. Upload an image
2. Type: "What's in this image?"
3. Watch auto-selector choose multimodal model
4. Reasoning: `✨ Selected GPT-5 - optimized for image analysis`

**Expected Result:**
- Auto-selects vision-capable model (GPT-5, Claude Opus, Gemini)
- Handles image correctly

---

## 🔍 Console Debugging

**Open Browser Console (F12)** and watch for:

```javascript
[Auto-Select] Selected GPT-5 - optimized for code generation
[Auto-Select] Selected Claude Sonnet 4 - optimized for creative writing
[Auto-Select] Selected GPT-4o Mini - optimized for quick question
```

These logs confirm auto-selection is working behind the scenes.

---

## 🎨 Visual Guide

**Before Sending Message (Auto Mode ON):**
```
┌──────────────────────────────────────────────────────┐
│ [🤖 Auto] [GPT-5 ▾] ✨ Selected GPT-5 - for code    │
└──────────────────────────────────────────────────────┘
```

**After Typing (Auto Mode OFF):**
```
┌──────────────────────────────────────────────────────┐
│ [✋ Manual] [Claude Opus 4.1 ▾]                      │
└──────────────────────────────────────────────────────┘
```

**With Re-Analyze Button (during conversation):**
```
┌─────────────────────────────────────────────────────────────┐
│ [🤖 Auto] [GPT-5 ▾] ✨ for code [🔄 Re-analyze]          │
└─────────────────────────────────────────────────────────────┘
```

---

## 🐛 Troubleshooting

### Issue: No Auto-Selection Happening

**Check:**
1. Is `🤖 Auto` button enabled? (should be blue/primary color)
2. Open console - do you see `[Auto-Select]` logs?
3. Try different prompts with clear intent

**Fix:** Click `✋ Manual` then `🤖 Auto` again to reset

---

### Issue: Wrong Model Selected

**Explanation:** Pattern matching might not catch all variations

**Solution:**
1. Use manual override for this message
2. Or, adjust patterns in `src/lib/ai/model-router.ts`
3. Add your specific keywords to `TASK_PATTERNS`

---

### Issue: Reasoning Not Showing

**Check:**
1. Is auto mode enabled?
2. Did auto-selector successfully pick a model?
3. Check console for `[Auto-Select] Failed` errors

**Common Cause:** No unlocked models available for the task

---

### Issue: Re-Analyze Button Not Visible

**Requirements:**
- Must be logged in (`chatState.userId` exists)
- Must have messages in conversation (`chatState.messages.length > 0`)

**Check:** Are you logged in at http://localhost:5173/login ?

---

## 📊 Model Selection Priorities

### Code Tasks
1. openai/gpt-5
2. anthropic/claude-opus-4.1
3. qwen/qwen3-coder
4. x-ai/grok-code-fast-1

### Creative Writing
1. anthropic/claude-sonnet-4
2. anthropic/claude-opus-4.1
3. openai/gpt-5

### Quick Questions
1. openai/gpt-4o-mini
2. google/gemini-2.5-flash-lite
3. anthropic/claude-3.5-haiku

### Math & Reasoning
1. deepseek/deepseek-r1-0528
2. openai/o3-mini
3. openai/o1

### Images
1. openai/gpt-5
2. anthropic/claude-opus-4.1
3. google/gemini-2.5-pro

---

## 🎯 Success Criteria

✅ **Auto mode works:** Models auto-select based on prompt
✅ **Manual mode works:** You choose, no auto-selection
✅ **Override works:** Manual choice overrides auto-selection
✅ **Switch works:** Change models mid-chat with no warning
✅ **Reasoning shows:** See why model was chosen
✅ **Re-analyze works:** Get fresh perspective from different model
✅ **Console logs:** `[Auto-Select]` messages appear
✅ **Toasts work:** Confirmation messages show

---

## 🚀 What's Next?

### Potential Enhancements:

1. **Better Model Selector Dialog for Re-Analyze**
   - Current: Text input prompt
   - Better: Visual model selector with filters

2. **Auto-Selection Confidence Score**
   - Show how confident the selector is
   - Suggest alternative models

3. **Learning from Usage**
   - Track which models users prefer for each task
   - Adapt recommendations over time

4. **Admin Configuration**
   - Let admins customize model priorities
   - Define custom task types
   - Set cost optimization rules

5. **A/B Testing Dashboard**
   - Compare auto vs manual selection outcomes
   - Measure user satisfaction
   - Optimize patterns

---

## 📝 Notes

- **Auto-select is ON by default** for best user experience
- **Console logs are helpful** for debugging during development
- **Reasoning display is subtle** - doesn't distract from chat
- **Re-analyze is powerful** - entire conversation gets fresh perspective
- **Model switching is seamless** - no interruptions or warnings

---

## ✅ Testing Complete Checklist

- [ ] Logged in with admin account
- [ ] Auto mode button visible and functional
- [ ] Tested code generation prompt
- [ ] Tested creative writing prompt
- [ ] Tested quick question prompt
- [ ] Manual override working
- [ ] Manual mode working
- [ ] Model switching mid-chat working
- [ ] Re-analyze button visible (when messages exist)
- [ ] Re-analyze functionality working
- [ ] Console logs showing auto-selections
- [ ] Reasoning display showing
- [ ] Toast notifications appearing

---

**Ready to test!** Visit: http://localhost:5173

**Admin Login:**
- Email: irstone@me.com
- Password: WeaveAI2025!

**Start Chatting and Watch the Magic! ✨**
