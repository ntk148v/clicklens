# ClickLens Style Guide

This document outlines the styling standards and best practices for the ClickLens codebase. Following these rules ensures consistency, maintainability, and a premium user experience.

## 1. Core Principles

- **Utility-First**: Use Tailwind CSS for all styling. Avoid custom CSS files unless creating shared utility classes in `globals.css`.
- **Component-Driven**: Build UIs using shared components from `src/components/ui` (shadcn/ui).
- **Dark Mode First**: Designs should look great in dark mode (default for ClickHouse-related tools), while supporting light mode.

## 2. Typography

We use `Geist Sans` for UI text and `Geist Mono` for data/code.

- **UI Text**: Use `font-sans` (default).
- **Data/Code**: Use `font-mono` for all database content, SQL queries, and technical values (IDs, hashes).

### Utility Classes

- `.data-table-cell`: Applied to table cells displaying database content.
  - Definition: `@apply py-1.5 px-4 font-mono text-sm;`

## 3. Colors & Theming

Theme variables are defined in `src/app/globals.css`. Do not hardcode hex values.

| Category   | Usage                      | Variable                                |
| ---------- | -------------------------- | --------------------------------------- |
| Background | Page background            | `bg-background`                         |
| Foreground | Primary text               | `text-foreground`                       |
| Muted      | Secondary text/backgrounds | `text-muted-foreground`, `bg-muted`     |
| Primary    | Main actions/highlights    | `bg-primary`, `text-primary-foreground` |
| Borders    | Component borders          | `border-border`                         |
| Input      | Input borders              | `border-input`                          |

## 4. Components

### Buttons

- **Do not use raw HTML `<button>` tags.**
- Use `import { Button } from "@/components/ui/button"`.
- Variants:
  - `default`: Primary actions.
  - `secondary`: Secondary actions.
  - `ghost`: Icon buttons or subtle actions.
  - `outline`: Bordered actions.
  - `destructive`: Delete/Remove actions.

### Tables

- Use `import { Table, ... } from "@/components/ui/table"`.
- Use `TableCell` with `.data-table-cell` for data rows to ensure consistent padding and font.
- For interactive rows, use `ClickableTableRow`.

### Icons

- Use `lucide-react` for all icons.
- Standard size: `w-4 h-4` (16px) for buttons, `w-3.5 h-3.5` (14px) for subtle indicators.

## 5. Spacing & Layout

- **Padding/Margin**: Use standard Tailwind spacing header (e.g., `p-4`, `m-2`).
- **Flexbox**: Prefer `flex` and `gap-*` over margins for component layouts.
- **Containers**: Use `container mx-auto` for page content wrappers.

## 6. Best Practices

- **Colocation**: Keep styles close to usage (Tailwind classes).
- **Avoid Inline Styles**: Do not use `style={{ ... }}` unless dynamic values are required (e.g., resizable widths).
- **Accessibility**: ensure interactive elements have `aria-label` if they contain only icons.

## 7. Example: Data Grid

```tsx
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table"

export function DataGrid({ data }) {
  return (
    <Table>
      <TableBody>
        {data.map((row) => (
          <TableRow key={row.id}>
            {/* Use global utility for consistent data cells */}
            <TableCell className="data-table-cell">{row.value}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
```
