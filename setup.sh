#!/bin/bash

# ==============================================================================
# WeaveAI Enterprise - Quick Setup Script
# ==============================================================================
#
# This script automates the initial setup process for local development.
#
# Usage:
#   chmod +x setup.sh
#   ./setup.sh
#
# ==============================================================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Print colored output
print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_header() {
    echo ""
    echo -e "${BLUE}===================================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}===================================================${NC}"
    echo ""
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# ==============================================================================
# Step 1: Check Prerequisites
# ==============================================================================

print_header "Step 1: Checking Prerequisites"

# Check Node.js
if command_exists node; then
    NODE_VERSION=$(node --version)
    print_success "Node.js installed: $NODE_VERSION"

    # Check if version is >= 20
    NODE_MAJOR=$(echo $NODE_VERSION | cut -d'.' -f1 | sed 's/v//')
    if [ "$NODE_MAJOR" -lt 20 ]; then
        print_error "Node.js version must be 20 or higher"
        print_info "Current version: $NODE_VERSION"
        print_info "Please upgrade Node.js: https://nodejs.org/"
        exit 1
    fi
else
    print_error "Node.js not found"
    print_info "Please install Node.js 20+: https://nodejs.org/"
    exit 1
fi

# Check npm
if command_exists npm; then
    NPM_VERSION=$(npm --version)
    print_success "npm installed: $NPM_VERSION"
else
    print_error "npm not found"
    exit 1
fi

# Check git
if command_exists git; then
    GIT_VERSION=$(git --version)
    print_success "Git installed: $GIT_VERSION"
else
    print_warning "Git not found (optional but recommended)"
fi

# ==============================================================================
# Step 2: Install Dependencies
# ==============================================================================

print_header "Step 2: Installing Dependencies"

print_info "Running: npm install --legacy-peer-deps"
print_info "This may take a few minutes..."

if npm install --legacy-peer-deps > /tmp/npm-install.log 2>&1; then
    print_success "Dependencies installed successfully"
else
    print_error "Failed to install dependencies"
    print_info "Check /tmp/npm-install.log for details"
    exit 1
fi

# ==============================================================================
# Step 3: Compile i18n Messages
# ==============================================================================

print_header "Step 3: Compiling Translations"

print_info "Compiling paraglide i18n messages..."

if npx @inlang/paraglide-js compile --project ./project.inlang --outdir ./src/paraglide > /tmp/paraglide.log 2>&1; then
    print_success "Translations compiled successfully"
else
    print_error "Failed to compile translations"
    print_info "Check /tmp/paraglide.log for details"
    exit 1
fi

# ==============================================================================
# Step 4: Check Environment Configuration
# ==============================================================================

print_header "Step 4: Environment Configuration"

if [ -f ".env.local" ]; then
    print_success ".env.local file exists"

    # Check if DATABASE_URL is set
    if grep -q "DATABASE_URL=postgresql://" .env.local 2>/dev/null; then
        if grep -q "DATABASE_URL=postgresql://REPLACE" .env.local; then
            print_warning "DATABASE_URL needs to be configured"
            print_info "Edit .env.local and add your database connection string"
        else
            print_success "DATABASE_URL is configured"
        fi
    else
        print_warning "DATABASE_URL not found in .env.local"
    fi

    # Check if AUTH_SECRET is set
    if grep -q "AUTH_SECRET=REPLACE" .env.local; then
        print_warning "AUTH_SECRET needs to be generated"
        print_info "Run: npx auth secret"
        print_info "Then add it to .env.local"
    else
        if grep -q "AUTH_SECRET=.\\{32,\\}" .env.local 2>/dev/null; then
            print_success "AUTH_SECRET is configured"
        else
            print_warning "AUTH_SECRET may be too short (needs 32+ characters)"
        fi
    fi

    # Check if at least one AI provider is configured
    if grep -q "OPENROUTER_API_KEY=sk-" .env.local ||
       grep -q "GEMINI_API_KEY=AIza" .env.local ||
       grep -q "OPENAI_API_KEY=sk-" .env.local; then
        print_success "At least one AI provider is configured"
    else
        print_warning "No AI provider API keys found"
        print_info "Add at least one API key to .env.local:"
        print_info "  - OPENROUTER_API_KEY (recommended)"
        print_info "  - GEMINI_API_KEY"
        print_info "  - OPENAI_API_KEY"
    fi
else
    print_warning ".env.local file not found"
    print_info "Copy .env.local template and configure:"
    print_info "  cp .env.local .env.local.backup"
fi

# ==============================================================================
# Step 5: Run Type Checking
# ==============================================================================

print_header "Step 5: Type Checking"

print_info "Running TypeScript type checking..."

if npm run check > /tmp/typecheck.log 2>&1; then
    print_success "Type checking passed (0 errors)"
else
    print_error "Type checking failed"
    print_info "Check /tmp/typecheck.log for details"
    # Don't exit on type check failure - it's informational
fi

# ==============================================================================
# Summary and Next Steps
# ==============================================================================

print_header "Setup Complete! 🎉"

echo ""
echo "✓ Dependencies installed"
echo "✓ Translations compiled"
echo "✓ Type checking completed"
echo ""

print_header "Next Steps"

echo ""
echo "1. Configure Environment Variables (.env.local):"
echo "   ${BLUE}→${NC} Set DATABASE_URL (from neon.tech or local PostgreSQL)"
echo "   ${BLUE}→${NC} Generate AUTH_SECRET: ${GREEN}npx auth secret${NC}"
echo "   ${BLUE}→${NC} Add AI provider API key (OPENROUTER_API_KEY recommended)"
echo ""

echo "2. Initialize Database:"
echo "   ${GREEN}npm run db:push${NC}"
echo ""

echo "3. Start Development Server:"
echo "   ${GREEN}npm run dev${NC}"
echo ""

echo "4. Open in Browser:"
echo "   ${BLUE}http://localhost:5173${NC}"
echo ""

echo "5. Create Admin Account:"
echo "   ${BLUE}→${NC} Register at /register"
echo "   ${BLUE}→${NC} Run SQL: ${GREEN}UPDATE \"user\" SET \"isAdmin\" = true WHERE email = 'your@email.com';${NC}"
echo ""

print_info "For detailed instructions, see: ${GREEN}GETTING_STARTED.md${NC}"
print_info "For deployment guide, see: ${GREEN}IMPLEMENTATION_GUIDE.md${NC}"

echo ""
