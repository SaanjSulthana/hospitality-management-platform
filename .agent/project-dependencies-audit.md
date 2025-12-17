# Project Dependencies & Plugins Audit

## 📦 Installed Plugins (from `package.json`)

### Core Tailwind Ecosystem
These are required for the build system and styling engine.
- **`tailwindcss`** (v4.1.12): The core CSS framework.
- **`@tailwindcss/vite`**: Integrates Tailwind directly into the Vite build process (crucial for v4).
- **`@tailwindcss/oxide`**: The new high-performance engine for Tailwind v4.
- **`tailwind-merge`**: **REQUIRED**. Utility to merge conflict classes (e.g., `className={cn("p-4", className)}`). Essential for reusable components.

### Animation
- **`tw-animate-css`**: **REQUIRED**. Provides animation utility classes.
  - *Usage*: Imported in `index.css` (`@import "tw-animate-css";`).
  - *Status*: Used instead of `tailwindcss-animate`.

### UI Primitives
- **`@radix-ui/*`**: **REQUIRED**. Headless components for Dialogs, Tabs, Selects, etc.
- **`clsx`**: **REQUIRED**. Conditional class logic, used with `tailwind-merge`.
- **`lucide-react`**: **REQUIRED**. Icon set.

---

## 🚫 Missing / Not Needed Plugins

The following common plugins are **NOT** installed, and **we do not need them** because we have custom implementations:

### 1. `tailwind-scrollbar-hide`
- **Status**: ❌ Not installed.
- **Why**: We use a custom utility in `index.css`:
  ```css
  .no-scrollbar::-webkit-scrollbar { display: none; }
  ```
- **Action**: Use `.no-scrollbar` class instead of `scrollbar-hide`.

### 2. `tailwindcss-safe-area`
- **Status**: ❌ Not installed.
- **Why**: We use custom CSS variables in `index.css`:
  ```css
  .pt-safe { padding-top: var(--safe-top); }
  ```
- **Action**: Continue using `.pt-safe` and `.pb-safe`.

### 3. `@tailwindcss/forms`
- **Status**: ❌ Not installed.
- **Why**: We are styling inputs manually with utility classes (e.g., `border-gray-300 focus:border-blue-500`).
- **Action**: Not needed unless we want to reset form styles globally (current custom styles are fine).

---

## ✅ Verdict

Your project setup is **clean and modern**. You are using Tailwind v4 (Bleeding Edge) which handles many things internally.

- **Do we need to install anything?** **NO.**
- **Do we need to remove anything?** **NO.**

Your current set of dependencies is lean and sufficient for the responsive design goals. The only "fix" needed is in your code usage (switching `scrollbar-hide` -> `.no-scrollbar`), not in `package.json`.
