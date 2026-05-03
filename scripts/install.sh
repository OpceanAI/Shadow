#!/bin/sh
set -e

# Shadow CLI Install Script
# POSIX-compliant one-liner installer

REPO="https://github.com/OpceanAI/Shadow"
DEFAULT_INSTALL_DIR="/usr/local/lib/shadow"
BIN_DIR="/usr/local/bin"
BIN_NAME="shadow"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

info() { printf "${CYAN}%s${NC}\n" "$*"; }
success() { printf "${GREEN}%s${NC}\n" "$*"; }
warn() { printf "${YELLOW}%s${NC}\n" "$*"; }
error() { printf "${RED}%s${NC}\n" "$*"; exit 1; }

# Check prerequisites
check_node() {
  if ! command -v node >/dev/null 2>&1; then
    error "Node.js is required but not installed. Install from https://nodejs.org"
  fi
  NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
  if [ "$NODE_VERSION" -lt 18 ]; then
    error "Node.js >= 18 is required. Current: $(node -v)"
  fi
  info "Node.js $(node -v) detected"
}

check_npm() {
  if ! command -v npm >/dev/null 2>&1; then
    error "npm is required but not installed."
  fi
  info "npm $(npm -v) detected"
}

# Detect platform
detect_platform() {
  PLATFORM=$(uname -s)
  case "$PLATFORM" in
    Linux|Darwin) ;;
    *) warn "Unsupported platform: $PLATFORM. Proceeding anyway..." ;;
  esac
}

# Install via npm (recommended)
install_npm() {
  info "Installing Shadow CLI via npm..."
  npm install -g @opceanai/shadow
  success "Shadow CLI installed successfully!"
  info "Run 'shadow --help' to get started."
}

# Install from source
install_source() {
  INSTALL_DIR="${1:-$DEFAULT_INSTALL_DIR}"

  info "Installing Shadow CLI from source to $INSTALL_DIR..."

  # Clone repo
  if [ -d "$INSTALL_DIR" ]; then
    info "Updating existing installation at $INSTALL_DIR"
    cd "$INSTALL_DIR"
    git pull origin main
  else
    git clone "$REPO" "$INSTALL_DIR"
    cd "$INSTALL_DIR"
  fi

  # Install dependencies
  npm install --production
  npm run build

  # Create symlink
  if [ -f "$BIN_DIR/$BIN_NAME" ]; then
    rm -f "$BIN_DIR/$BIN_NAME"
  fi

  if [ -w "$BIN_DIR" ]; then
    ln -sf "$INSTALL_DIR/dist/index.js" "$BIN_DIR/$BIN_NAME"
  else
    info "Need sudo to create symlink in $BIN_DIR"
    sudo ln -sf "$INSTALL_DIR/dist/index.js" "$BIN_DIR/$BIN_NAME"
  fi

  chmod +x "$INSTALL_DIR/dist/index.js"

  success "Shadow CLI installed from source!"
  info "Run 'shadow --help' to get started."
}

# Add shell completion
setup_completions() {
  info "Setting up shell completion..."
  SHELL_NAME=$(basename "$SHELL")

  case "$SHELL_NAME" in
    bash)
      if [ -f "$HOME/.bashrc" ]; then
        if ! grep -q "shadow completion" "$HOME/.bashrc"; then
          echo "source <(shadow completion bash)" >> "$HOME/.bashrc"
          success "Bash completion added to ~/.bashrc"
        fi
      fi
      ;;
    zsh)
      if [ -f "$HOME/.zshrc" ]; then
        if ! grep -q "shadow completion" "$HOME/.zshrc"; then
          echo "source <(shadow completion zsh)" >> "$HOME/.zshrc"
          success "Zsh completion added to ~/.zshrc"
        fi
      fi
      ;;
    fish)
      FISH_DIR="$HOME/.config/fish/completions"
      mkdir -p "$FISH_DIR"
      shadow completion fish > "$FISH_DIR/shadow.fish" 2>/dev/null || true
      success "Fish completion installed"
      ;;
  esac
}

# Main
main() {
  echo ""
  info "=== Shadow CLI Installer ==="
  echo ""

  detect_platform
  check_node
  check_npm

  # Parse arguments
  INSTALL_METHOD="npm"
  SRC_DIR=""

  while [ $# -gt 0 ]; do
    case "$1" in
      --source)
        INSTALL_METHOD="source"
        ;;
      --dir)
        shift
        SRC_DIR="$1"
        ;;
      --npm)
        INSTALL_METHOD="npm"
        ;;
      --help|-h)
        echo "Usage: install.sh [--source | --npm] [--dir <path>]"
        echo ""
        echo "Options:"
        echo "  --source     Install from source (clone repo)"
        echo "  --npm        Install via npm (default)"
        echo "  --dir <path> Source install directory"
        exit 0
        ;;
    esac
    shift
  done

  # Run installation
  case "$INSTALL_METHOD" in
    npm)
      install_npm
      ;;
    source)
      install_source "$SRC_DIR"
      ;;
  esac

  # Setup completions
  setup_completions

  echo ""
  success "Installation complete!"
}

main "$@"
