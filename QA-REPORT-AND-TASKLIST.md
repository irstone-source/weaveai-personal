# Comprehensive QA Report & Testing Task List
**Date**: 2025-10-29
**Based on**: ChatGPT Atlas QA Assessment
**Application**: https://app.greensignals.io

## Executive Summary

ChatGPT Atlas identified 3 critical bugs and several usability issues in the GreenSignals (WeaveAI) application. This document provides:
1. Complete analysis of identified bugs
2. Automated fixes that can be implemented
3. Manual testing checklist for human QA
4. Comprehensive QA strategy for ongoing testing

---

## Critical Bugs Identified

### 1. Code Review Agent Stalling/Hanging ⚠️ CRITICAL
**Severity**: HIGH
**Impact**: Feature completely unusable
**User Experience**: "is writing..." state for 20+ seconds with no response

**Symptoms**:
- User selects "Code Review" prompt card
- Prompt refinement modal appears
- User submits code sample
- Agent enters indefinite loading state
- No response ever returns

**Root Cause** (Suspected):
- Model selection issue (GPT-5 or GLM 4.5 Air model may be timing out)
- Streaming response not handled correctly
- Model API endpoint returning errors silently
- Timeout configuration too aggressive

**Files to Investigate**:
- `/src/lib/components/chat-state.svelte.ts` (lines 790-1332) - handleSubmit() function
- `/src/routes/api/chat/+server.ts` - Streaming response implementation
- Model configuration for Code Review agent

**Cannot Auto-Fix**: Requires investigation of API endpoints and model behavior

---

### 2. Analysis & Research Prompt Not Populating/Sending ⚠️ CRITICAL
**Severity**: HIGH
**Impact**: Feature completely unusable
**User Experience**: Prompt card click does nothing

**Symptoms**:
- User clicks "Analysis & Research" card
- Prompt text appears below card but NOT in message input
- Send button remains disabled
- Pressing Enter or clicking send does nothing
- Prompt cannot be submitted

**Root Cause** (Suspected):
- Prompt card click handler not properly populating the `chatState.prompt` field
- Event handler missing or broken for this specific prompt
- JavaScript/Svelte reactivity issue

**Files to Investigate**:
- `/src/lib/components/ChatInterface.svelte` - Prompt card click handlers
- Prompt card definitions and onclick events

**Cannot Auto-Fix**: Requires access to ChatInterface component code

---

### 3. General Discussion Prompt Not Populating/Sending ⚠️ CRITICAL
**Severity**: HIGH
**Impact**: Feature completely unusable
**User Experience**: Same as Analysis & Research

**Symptoms**: Identical to bug #2 above

**Root Cause** (Suspected): Same as bug #2

**Files to Investigate**: Same as bug #2

**Cannot Auto-Fix**: Requires access to ChatInterface component code

---

## Usability Issues Identified

### 4. Prompt Card Auto-Population Inconsistency 🔶 MEDIUM
**Severity**: MEDIUM
**Impact**: Confusing user experience

**Issue**:
- Some prompt cards auto-populate message input
- Others don't populate until "New Chat" is clicked
- Creative Writing works correctly
- Other cards fail inconsistently

**Root Cause**:
- Event handler timing issues
- Need to call `chatState.prompt = "..."` immediately when card is clicked

---

### 5. Prompt Refinement Modal Slows Experienced Users 🔶 MEDIUM
**Severity**: LOW
**Impact**: Workflow friction

**Issue**:
- Extra modal step before sending prompt
- Useful for quality control but slows down repeated use
- No option to bypass or "always skip refinement"

**Recommendation**:
- Add user preference to skip refinement modal
- Add "Don't ask again" checkbox
- Consider keyboard shortcut to bypass (Shift+Enter)

---

## Production Deployment Issues (Recently Fixed)

### ✅ Fathom Import 404 Error - FIXED
- **Status**: RESOLVED
- **Fix**: Custom domain aliased to correct deployment
- **Verification**: HTTP 302 (redirect to login, not 404)

### ✅ Linear OAuth "Invalid redirect_uri" Error - FIXED
- **Status**: RESOLVED
- **Fix**: PUBLIC_ORIGIN environment variable set in Vercel
- **Verification**: Environment variable confirmed

---

## Automated Testing Already Implemented

### Playwright E2E Tests ✅
1. **verify-deployment.spec.ts** - Production URL verification
2. **authenticated-verification.spec.ts** - Authenticated user flows
3. **fathom-integration.spec.ts** - Fathom meeting imports
4. **05-projects-page.spec.ts** - Projects page functionality

**Test Coverage**:
- ✅ Landing page loads
- ✅ Login page exists
- ✅ Admin pages require auth (401/302, not 404)
- ✅ Fathom Import page exists
- ✅ Meetings page accessible
- ✅ OAuth providers page exists

**Gap**: No automated tests for prompt cards or chat functionality

---

## Manual QA Testing Checklist

### Test Category 1: Chat Prompts (CRITICAL - All must pass)

#### Test 1.1: Creative Writing Prompt ✓
- [ ] Log in to https://app.greensignals.io
- [ ] Click "New Chat"
- [ ] Click "Creative Writing" prompt card
- [ ] Verify prompt appears in message input field
- [ ] Verify send button becomes enabled
- [ ] Click send or press Enter
- [ ] Verify prompt refinement modal appears (or message sends)
- [ ] If modal: Click "Run Prompt"
- [ ] **Expected**: AI responds with creative writing suggestions
- [ ] **Actual**: ___________
- [ ] **Status**: PASS / FAIL

#### Test 1.2: Code Review Prompt ⚠️ KNOWN BROKEN
- [ ] Click "New Chat"
- [ ] Click "Code Review" prompt card
- [ ] Verify prompt appears in message input
- [ ] Paste sample code (e.g., simple Python function)
- [ ] Click send
- [ ] Verify prompt refinement modal appears
- [ ] Select model (note which model is chosen)
- [ ] Click "Run Prompt"
- [ ] Wait up to 30 seconds
- [ ] **Expected**: AI analyzes code and provides review
- [ ] **Actual**: ___________
- [ ] **Issue**: If hangs, note model name and exact time waited
- [ ] **Status**: PASS / FAIL

#### Test 1.3: Analysis & Research Prompt ⚠️ KNOWN BROKEN
- [ ] Click "New Chat"
- [ ] Click "Analysis & Research" prompt card
- [ ] **Expected**: Prompt text appears in message input field
- [ ] **Actual**: ___________
- [ ] Verify send button state (enabled/disabled)
- [ ] Try pressing Enter
- [ ] **Expected**: Message sends or refinement modal appears
- [ ] **Actual**: ___________
- [ ] **Status**: PASS / FAIL

#### Test 1.4: General Discussion Prompt ⚠️ KNOWN BROKEN
- [ ] Click "New Chat"
- [ ] Click "General Discussion" prompt card
- [ ] **Expected**: Prompt text appears in message input field
- [ ] **Actual**: ___________
- [ ] Verify send button state (enabled/disabled)
- [ ] Try pressing Enter
- [ ] **Expected**: Message sends or refinement modal appears
- [ ] **Actual**: ___________
- [ ] **Status**: PASS / FAIL

---

### Test Category 2: Navigation & Core Features

#### Test 2.1: Library Access
- [ ] Log in
- [ ] Click "Library" in sidebar
- [ ] **Expected**: Library page loads (may be empty for new users)
- [ ] **Actual**: ___________
- [ ] Click "Start Creating" if available
- [ ] Verify no errors
- [ ] **Status**: PASS / FAIL

#### Test 2.2: Projects - Linear Integration
- [ ] Click "Projects" in sidebar
- [ ] **Expected**: "Client Projects" page loads
- [ ] Verify "Connect Linear" button present
- [ ] Click "Connect Linear"
- [ ] **Expected**: Redirects to Linear OAuth consent page
- [ ] **Should NOT see**: "Invalid redirect_uri parameter" error
- [ ] **Actual**: ___________
- [ ] Complete OAuth flow (or cancel)
- [ ] **Status**: PASS / FAIL

#### Test 2.3: Projects - Manual Creation
- [ ] On Projects page
- [ ] Click "Create Project" button
- [ ] Fill in project details
- [ ] Save project
- [ ] **Expected**: Project created successfully
- [ ] **Actual**: ___________
- [ ] **Status**: PASS / FAIL

#### Test 2.4: Meetings - Fathom Import
- [ ] Click "Meetings" in sidebar
- [ ] **Expected**: Meetings page loads
- [ ] Verify "Import Meetings" button present
- [ ] Click "Import Meetings"
- [ ] **Expected**: Navigates to /admin/settings/fathom-import
- [ ] **Should NOT see**: 404 error
- [ ] **Actual**: ___________
- [ ] **Status**: PASS / FAIL

---

### Test Category 3: Admin Dashboard (Requires Admin Account)

#### Test 3.1: Dashboard Metrics
- [ ] Navigate to Admin → Dashboard
- [ ] Verify metrics display:
  - [ ] Total users
  - [ ] Total chats
  - [ ] Images/videos generated
  - [ ] Revenue
  - [ ] Subscriptions
- [ ] Verify recent activity list appears
- [ ] **Status**: PASS / FAIL

#### Test 3.2: Analytics Charts
- [ ] Navigate to Admin → Analytics
- [ ] Verify time-series charts display:
  - [ ] Users over time
  - [ ] Subscriptions
  - [ ] Revenue
  - [ ] Conversations
- [ ] Charts may be empty for new installation
- [ ] Verify no JavaScript errors
- [ ] **Status**: PASS / FAIL

#### Test 3.3: User Management
- [ ] Navigate to Admin → Users
- [ ] Verify user list displays
- [ ] Check columns: email, plan, role, creation date
- [ ] Try clicking edit button on a user
- [ ] Verify edit functionality works
- [ ] **Status**: PASS / FAIL

#### Test 3.4: Site Settings Access
- [ ] Navigate to Admin → Settings
- [ ] Verify all settings sections listed:
  - [ ] General
  - [ ] Branding
  - [ ] Payment Methods
  - [ ] Pricing Plans
  - [ ] OAuth Providers
  - [ ] AI Models
  - [ ] Cloud Storage
  - [ ] Security
  - [ ] Mailing
  - [ ] Fathom Import
- [ ] Click "Configure" on one section
- [ ] Verify settings page loads
- [ ] **Do NOT modify** unless authorized
- [ ] **Status**: PASS / FAIL

#### Test 3.5: OAuth Providers - Linear Configuration
- [ ] Navigate to Admin → Settings → OAuth Providers
- [ ] Scroll to Linear section
- [ ] Verify setup instructions present
- [ ] Verify callback URL displayed: `https://app.greensignals.io/auth/callback/linear`
- [ ] Verify "Copy" button exists
- [ ] Click copy button
- [ ] Verify URL copied to clipboard
- [ ] **Status**: PASS / FAIL

---

### Test Category 4: Guest User Experience

#### Test 4.1: Guest Message Limit
- [ ] Log out (or use incognito mode)
- [ ] Visit https://app.greensignals.io
- [ ] Start new chat
- [ ] Send 6 messages (allowed limit)
- [ ] Verify message counter displays
- [ ] Try sending 7th message
- [ ] **Expected**: Error message about guest limit
- [ ] **Actual**: ___________
- [ ] **Status**: PASS / FAIL

#### Test 4.2: Guest Model Restrictions
- [ ] As guest user
- [ ] Try selecting a premium model
- [ ] **Expected**: Error toast: "Guest users can only use allowed models"
- [ ] **Actual**: ___________
- [ ] Verify only guest-allowed models are selectable
- [ ] **Status**: PASS / FAIL

#### Test 4.3: Guest Navigation Restrictions
- [ ] As guest user
- [ ] Try accessing Library
- [ ] **Expected**: Redirect to login page
- [ ] **Actual**: ___________
- [ ] Try accessing Projects
- [ ] **Expected**: Redirect to login page
- [ ] **Actual**: ___________
- [ ] Meetings should be accessible (may be empty)
- [ ] **Status**: PASS / FAIL

---

### Test Category 5: Cross-Browser Compatibility

#### Test 5.1: Chrome/Edge (Chromium)
- [ ] Test all prompt cards in Chrome
- [ ] Verify chat interface renders correctly
- [ ] Verify modals display properly
- [ ] Verify no console errors
- [ ] **Status**: PASS / FAIL

#### Test 5.2: Firefox
- [ ] Test all prompt cards in Firefox
- [ ] Verify chat interface renders correctly
- [ ] Verify modals display properly
- [ ] Verify no console errors
- [ ] **Status**: PASS / FAIL

#### Test 5.3: Safari (Mac only)
- [ ] Test all prompt cards in Safari
- [ ] Verify chat interface renders correctly
- [ ] Verify modals display properly
- [ ] Verify no console errors
- [ ] **Status**: PASS / FAIL

---

### Test Category 6: Performance & Load

#### Test 6.1: Page Load Times
- [ ] Clear browser cache
- [ ] Load homepage
- [ ] Measure load time: _________ seconds
- [ ] **Expected**: < 3 seconds
- [ ] Load Projects page
- [ ] Measure load time: _________ seconds
- [ ] **Status**: PASS / FAIL

#### Test 6.2: Chat Response Times
- [ ] Send simple chat message
- [ ] Measure time to first token: _________ seconds
- [ ] **Expected**: < 5 seconds
- [ ] Measure time to complete response: _________ seconds
- [ ] **Status**: PASS / FAIL

#### Test 6.3: Large Conversation Handling
- [ ] Create chat with 20+ messages
- [ ] Scroll through conversation
- [ ] Verify smooth scrolling
- [ ] Verify no memory leaks (check task manager)
- [ ] **Status**: PASS / FAIL

---

### Test Category 7: Security & Privacy

#### Test 7.1: Unauthorized Access Prevention
- [ ] Log out
- [ ] Try accessing /admin/dashboard directly
- [ ] **Expected**: Redirect to login
- [ ] **Actual**: ___________
- [ ] Try accessing /admin/settings/general
- [ ] **Expected**: Redirect to login or 401 error
- [ ] **Actual**: ___________
- [ ] **Status**: PASS / FAIL

#### Test 7.2: API Endpoint Protection
- [ ] Use browser dev tools
- [ ] Try calling /api/chats without auth
- [ ] **Expected**: 401 Unauthorized
- [ ] **Actual**: ___________
- [ ] Try calling /api/admin/* endpoints without auth
- [ ] **Expected**: 401/403 error
- [ ] **Actual**: ___________
- [ ] **Status**: PASS / FAIL

---

## Recommended Automated Tests to Add

### Unit Tests Needed:
1. **Prompt Card Click Handlers**
   - Test each prompt card populates `chatState.prompt`
   - Test send button enables after population
   - Test Enter key sends message

2. **Chat State Management**
   - Test message submission with various models
   - Test streaming response handling
   - Test error handling for failed API calls
   - Test guest message limit enforcement

3. **Model Selection Logic**
   - Test auto-select best model
   - Test manual model override
   - Test guest model restrictions
   - Test locked model validation

### Integration Tests Needed:
1. **End-to-End Chat Flows**
   - Test complete conversation with streaming
   - Test conversation with file attachments
   - Test conversation with images
   - Test code review workflow

2. **OAuth Integration Tests**
   - Test Linear OAuth connection flow
   - Test callback URL handling
   - Test token refresh

3. **Admin Functionality Tests**
   - Test user CRUD operations
   - Test settings modification
   - Test analytics data display

---

## QA Strategy & Best Practices

### 1. Shift-Left Testing
- **Current**: Testing happens after deployment
- **Recommended**: Integrate tests into CI/CD pipeline
- **Action**: Run Playwright tests before every deployment
- **Benefit**: Catch regressions before production

### 2. Test Pyramid
```
         /\
        /  \  E2E Tests (10%)
       /____\
      /      \
     / Integration \ (30%)
    /______________\
   /                \
  /   Unit Tests      \ (60%)
 /____________________\
```

**Current State**: Heavy on E2E, lacking unit tests
**Recommended**: Build strong unit test foundation

### 3. Continuous Testing in Production
- **Monitor**:
  - Error rates in Sentry/logging
  - API response times
  - User session recordings (e.g., LogRocket, FullStory)
  - Real User Monitoring (RUM) metrics

- **Alerts**:
  - Set up alerts for:
    - API errors > 1% of requests
    - Response time > 5 seconds
    - 404 errors on critical paths
    - OAuth failures

### 4. Test Data Management
- **Create Test Accounts**:
  - Guest user (no auth)
  - Free tier user
  - Premium user
  - Admin user

- **Test Projects/Data**:
  - Pre-populate test conversations
  - Create sample projects
  - Upload test meeting data

### 5. Accessibility Testing
- **Tools**: axe DevTools, WAVE
- **Standards**: WCAG 2.1 Level AA
- **Tests**:
  - Keyboard navigation through all prompts
  - Screen reader compatibility
  - Color contrast ratios
  - Focus indicators

### 6. Performance Benchmarking
- **Metrics to Track**:
  - Time to First Byte (TTFB)
  - First Contentful Paint (FCP)
  - Largest Contentful Paint (LCP)
  - Time to Interactive (TTI)
  - Cumulative Layout Shift (CLS)

- **Tools**:
  - Lighthouse CI in pipeline
  - WebPageTest for detailed analysis
  - Vercel Analytics

### 7. Security Testing
- **Automated Scans**:
  - OWASP ZAP for vulnerability scanning
  - npm audit for dependency vulnerabilities
  - Snyk or Dependabot for security alerts

- **Manual Checks**:
  - Test all API endpoints for unauthorized access
  - Verify sensitive data not exposed in responses
  - Test for SQL injection in user inputs
  - Verify CORS configuration

---

## Priority Fixes Required

### P0 - Critical (Must Fix Immediately)
1. **Fix Code Review agent hanging** - Investigate model timeout/streaming
2. **Fix Analysis & Research prompt** - Add click handler
3. **Fix General Discussion prompt** - Add click handler

### P1 - High (Fix This Sprint)
4. **Add automated tests for prompt cards**
5. **Improve prompt refinement UX** - Add skip option
6. **Fix prompt card auto-population consistency**

### P2 - Medium (Fix Next Sprint)
7. **Add comprehensive unit test coverage**
8. **Implement error boundary for graceful failures**
9. **Add loading states for all async operations**
10. **Improve guest user onboarding**

### P3 - Low (Nice to Have)
11. **Add keyboard shortcuts for power users**
12. **Implement "Don't show again" for refinement modal**
13. **Add conversation export feature**
14. **Improve mobile responsive design**

---

## Files Requiring Investigation

### Critical Path Files:
1. **`/src/lib/components/ChatInterface.svelte`**
   - Contains prompt card definitions
   - Click handlers for all 4 prompts
   - Send button logic

2. **`/src/lib/components/chat-state.svelte.ts`**
   - `handleSubmit()` function (lines 790-1332)
   - Streaming response handling
   - Model selection logic

3. **`/src/routes/api/chat/+server.ts`**
   - Streaming implementation
   - Model API integration
   - Error handling

4. **`/src/lib/ai/model-router.ts`**
   - Auto-select model logic
   - Model capability detection

---

## Test Environment Setup

### Prerequisites:
- Node.js 18+
- npm or pnpm
- Playwright browsers: `npx playwright install`

### Environment Variables Needed:
```bash
# .env.test
DATABASE_URL=postgresql://...  # Test database
AUTH_SECRET=test_secret_key
OPENROUTER_API_KEY=sk-or-v1-...
LINEAR_CLIENT_ID=...
LINEAR_CLIENT_SECRET=...
FATHOM_API_KEY=...
PUBLIC_ORIGIN=http://localhost:5173
```

### Running Tests Locally:
```bash
# Run all E2E tests
npm run test:e2e

# Run specific test file
npx playwright test tests/e2e/verify-deployment.spec.ts

# Run tests in UI mode (interactive)
npx playwright test --ui

# Run tests in headed mode (see browser)
npx playwright test --headed

# Generate test report
npx playwright show-report
```

---

## Success Criteria

### Minimum Viable Quality (MVQ):
- ✅ All 4 prompt cards work correctly
- ✅ No 404 errors on critical paths
- ✅ OAuth integrations functional
- ✅ Guest user experience smooth
- ✅ Admin dashboard accessible

### Target Quality Level:
- ✅ All automated tests passing
- ✅ < 1% error rate in production
- ✅ < 3 second page load times
- ✅ < 5 second chat response times
- ✅ 95%+ uptime
- ✅ Zero P0 bugs in production

### Excellence Quality Level:
- ✅ 80%+ code coverage
- ✅ Lighthouse score > 90
- ✅ Accessibility audit passing
- ✅ Security scan passing
- ✅ Performance budget met
- ✅ User satisfaction > 4.5/5

---

## Next Steps

1. **Immediate** (Today):
   - [ ] Investigate Code Review agent hanging issue
   - [ ] Fix Analysis & Research prompt population
   - [ ] Fix General Discussion prompt population

2. **This Week**:
   - [ ] Complete full manual QA checklist above
   - [ ] Add automated tests for prompt cards
   - [ ] Set up continuous integration testing
   - [ ] Configure error monitoring (Sentry)

3. **This Month**:
   - [ ] Achieve 60%+ unit test coverage
   - [ ] Implement performance monitoring
   - [ ] Add accessibility testing
   - [ ] Create staging environment for pre-production testing

4. **Ongoing**:
   - [ ] Run full QA checklist before each release
   - [ ] Monitor production metrics daily
   - [ ] Review and update test suite monthly
   - [ ] Conduct security audit quarterly

---

## Appendix A: Bug Report Template

Use this template when reporting new bugs:

```markdown
## Bug Title
Brief description of the issue

### Environment
- URL: https://app.greensignals.io
- Browser: Chrome 120 / Firefox 121 / Safari 17
- User Type: Guest / Logged In / Admin
- Device: Desktop / Mobile / Tablet

### Steps to Reproduce
1. Navigate to...
2. Click on...
3. Enter...
4. Observe...

### Expected Behavior
What should happen

### Actual Behavior
What actually happens

### Screenshots/Video
[Attach if available]

### Console Errors
```
[Paste any console errors]
```

### Severity
- [ ] P0 - Critical (App unusable)
- [ ] P1 - High (Major feature broken)
- [ ] P2 - Medium (Minor feature impacted)
- [ ] P3 - Low (Cosmetic/edge case)

### Impact
- Users Affected: All / Some / Few
- Workaround Available: Yes / No
```

---

## Appendix B: Test Data

### Sample Code for Code Review Test:
```python
def calculate_total(items):
    total = 0
    for item in items:
        total += item['price'] * item['quantity']
    return total
```

### Sample Projects:
- Project Name: "Test Website Redesign"
- Description: "Redesign company website with modern UI"
- Status: In Progress

### Sample Meeting Topics:
- "Q4 Planning Meeting"
- "Customer Feedback Review"
- "Sprint Retrospective"

---

**Report Generated**: 2025-10-29
**Last Updated**: 2025-10-29
**Version**: 1.0
**Author**: Claude Code QA Analysis
