# AGENTS.md

## Commands

```bash
# Development
pnpm dev              # Start Vite dev server
pnpm tauri dev        # Start Tauri app in dev mode

# Build
pnpm build            # Build frontend (tsc + vite build)
pnpm tauri build     # Full Tauri production build
```

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite 7, Tailwind CSS 4
- **Backend**: Tauri 2, Rust (tokio), SQLite (rusqlite bundled)
- **Crypto**: x25519-dalek, AES-GCM, SHA-2
- **Package manager**: pnpm

## Project Structure

```
src/           # React frontend (TypeScript)
src-tauri/     # Rust backend
  src/main.rs  # Entry point (Rust side)
  src/lib.rs   # Library with Tauri commands
  src/db.rs    # SQLite database operations
  Cargo.toml   # Rust dependencies
```

## Notes

- Tailwind CSS 4 uses the `@tailwindcss/vite` plugin (not a config file)
- Rust SQLite uses `rusqlite` with bundled feature
- The app is a chat application with E2E encryption capabilities
- Desktop notifications are handled via `tauri-plugin-notification`

## IDE Setup

- VS Code with Tauri + rust-analyzer extensions recommended