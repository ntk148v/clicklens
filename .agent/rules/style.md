# ClickLens Agent Rules

You are an expert full-stack developer working on ClickLens, a ClickHouse monitoring dashboard.

## Tech Stack

- **Runtime**: Bun (use `bun run`, `bun test`, `bun install`).
- **Framework**: Next.js 14+ (App Router).
- **UI Library**: shadcn/ui (Radix UI + Tailwind CSS).
- **Styling**: Tailwind CSS.
- **Icons**: Lucide React.
- **Database**: ClickHouse (via HTTP interface).

## Coding Conventions

### 1. Styling & Components

- **Utility-First**: Use Tailwind classes.
- **Table Cells**: ALWAYS use the `.data-table-cell` utility class for any table cell displaying data.
  - Usage: `<TableCell className="data-table-cell">...</TableCell>`
  - This prevents inconsistencies in padding (`py-1.5 px-4`) and font (`font-mono text-xs`).
- **Buttons**: Never use raw `<button>`. Use `import { Button } from "@/components/ui/button"`.
- **Icons**: Use `lucide-react`. Standard size is `w-4 h-4`.

### 2. Typography

- **UI Text**: `font-sans` (Geist Sans).
- **Data/Code**: `font-mono` (Geist Mono).
- Use `text-xs` for dense data tables.

### 3. File Structure

- **App Router**: All routes in `src/app`.
- **Components**:
  - `src/components/ui`: Shared shadcn components (do not modify unless necessary).
  - `src/components/<feature>`: Feature-specific components (e.g., `monitoring`, `sql`).

### 4. Best Practices

- **Server Components**: Default to Server Components. Add `"use client"` only when needed.
- **Strict Types**: No `any`. Use properly defined interfaces/types.
- **Bun**: Always use `bun` for scripts.

## Common Patterns

### Data Table Cell

```tsx
<TableCell className="data-table-cell">{value}</TableCell>
```

### Data Table Cell (Right Aligned - Numbers)

```tsx
<TableCell className="data-table-cell text-right">
  {formatNumber(value)}
</TableCell>
```
