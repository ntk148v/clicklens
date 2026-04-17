# ClickLens Design System (DESIGN.md)

ClickLens follows a Vercel-inspired design system focused on "Software as Infrastructure." The aesthetic is minimalist, precise, and engineered, using shadows for depth and typography for identity.

## 1. Overview

ClickLens is a technical monitoring platform that prioritizes "gallery-like emptiness" to reduce cognitive load. The atmosphere is **Invisible Infrastructure** — a design system where every unnecessary token is stripped away.

- **Tone**: Minimalist, Engineering-Grade, Transparent, Urgent.
- **Philosophy**: Structure over decoration. Shadows over borders. Typography over color.
- **Voice**: A technical tool that rewards precision and clarity.

## 2. Color Palette & Roles

The system is primarily achromatic, using a grayscale palette to establish depth and focus. **Yellow** serves as the primary brand accent in Dark mode, while **Gray 600** is the primary action color in Light mode.

### Base Colors

- **Background**: `#ffffff` (Light) / `#0a0a0a` (Dark)
- **Foreground**: `#171717` (Light) / `#fafafa` (Dark)
- **Primary Action**: `#4d4d4d` (Light) / `#faff69` (Dark - Neon Yellow)
- **Secondary**: `#fafafa` (Light) / `#171717` (Dark)
- **Muted**: `#fafafa` (Light) / `#171717` (Dark)
- **Border/Shadow**: `rgba(0,0,0,0.08)` (Light) / `rgba(255,255,255,0.14)` (Dark)

### Semantic Roles

- **Status OK**: `#22c55e` (Green 500)
- **Status Warning**: `#f59e0b` (Yellow 500)
- **Status Critical**: `#ef4444` (Red 500)
- **Link**: `#0072f5` (Vercel Blue)
- **Focus Ring**: `hsla(212, 100%, 48%, 1)` (Accessibility Blue)

## 3. Typography Rules

Uses the **Geist** font family globally. Typography is treated as "compressed infrastructure."

| Level       | Size | Weight | Tracking | Usage                                    |
| :---------- | :--- | :----- | :------- | :--------------------------------------- |
| **Display** | 48px | 600    | -0.05em  | Hero headlines, major metrics            |
| **Heading** | 32px | 600    | -0.04em  | Page sections, card titles               |
| **Title**   | 24px | 600    | -0.02em  | Sub-sections, component headers          |
| **Body**    | 16px | 400    | normal   | Standard reading text                    |
| **UI**      | 14px | 500    | normal   | Buttons, navigation, labels              |
| **Mini**    | 12px | 500    | +0.02em  | Badges, metadata (often uppercase)       |
| **Mono**    | 14px | 400    | normal   | Code blocks, SQL queries, technical data |

- **Ligatures**: Enabled globally (`font-feature-settings: "liga" 1`).
- **Tabular Numbers**: Used for timestamps and metrics (`font-feature-settings: "tnum" 1`).

## 4. Spacing & Layout

The layout uses a **4px/8px incremental scale** to ensure geometric alignment.

- **Base Unit**: `4px`
- **Scale**: `4px`, `8px`, `12px`, `16px`, `32px`, `48px`, `64px`, `80px`
- **Container**: Max content width centered at `1200px`.
- **Vertical Spacing**: High whitespace between sections (`80px+`) to communicate "gallery emptiness."
- **Grid**: 2 or 3-column system for feature cards.

## 5. Component Styling

Components avoid traditional `border` properties in favor of the **Shadow-as-Border** technique.

### General Standards

- **Radius**: `6px` for small elements (buttons, inputs), `8px` for cards, `full` for badges.
- **Shadow (Border)**: `0 0 0 1px var(--shadow-border)`.
- **Shadow (Stack)**: Multi-layer depth for cards: `border + soft elevation + ambient depth`.

### Specific Components

- **Buttons**: `6px` radius. Outline variant uses `shadow-border`. Primary uses solid background.
- **Cards**: `8px` radius. Always use `shadow-stack` for depth.
- **Inputs**: `6px` radius. `shadow-border` by default. `2px` focus ring with accessibility blue.
- **Badges**: Pill shape (`9999px` radius). Tinted backgrounds (`10%` opacity of status color).

## 6. Do's and Don'ts

Constraints to ensure AI agents maintain design integrity.

| Do                                            | Don't                                          |
| :-------------------------------------------- | :--------------------------------------------- |
| Use negative tracking on headings.            | Don't use weight 700 (bold) on body text.      |
| Use `shadow-border` instead of CSS `border`.  | Don't use warm colors (orange) in UI chrome.   |
| Use lowercase for navigation links.           | Don't use pill radius for primary CTA buttons. |
| Keep vertical space generous (80px sections). | Don't skip `font-feature-settings` for Geist.  |
| Use `#171717` instead of `#000000` for text.  | Don't use heavy shadows (> 0.15 opacity).      |

## 7. Responsive Behavior

Components must scale gracefully across breakpoints.

- **Mobile (<640px)**: Stacked layouts. Section spacing reduces to `32px`. Typography scales down but maintains relative tracking.
- **Tablet (640px-1024px)**: 2-column grids start. Padding expands to `24px`.
- **Desktop (>1024px)**: Full 3-column grids. Max container width enforced. Generous margins.
