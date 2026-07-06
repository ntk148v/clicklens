import { describe, expect, it, beforeEach } from "bun:test";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";

import { FieldsSidebar } from "./FieldsSidebar";

// Radix ScrollArea depends on ResizeObserver, which isn't in JSDOM
globalThis.ResizeObserver = class ResizeObserver {
  constructor() {}
  observe() {}
  unobserve() {}
  disconnect() {}
};

const columns = Array.from({ length: 60 }, (_, index) => ({
  name: `field_${index}`,
  type: "String",
  isNullable: false,
  defaultKind: "",
  comment: "",
}));

describe("FieldsSidebar", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  it("constrains the fields list so overflowing fields can scroll", () => {
    flushSync(() => {
      root.render(
        <FieldsSidebar
          columns={columns}
          timeColumns={[]}
          selectedColumns={[]}
          onSelectedColumnsChange={() => {}}
          onTimeColumnChange={() => {}}
          className="h-64"
        />,
      );
    });

    const scrollArea = container.querySelector('[data-slot="scroll-area"]');
    expect(scrollArea).toHaveClass("flex-1");
    expect(scrollArea).toHaveClass("min-h-0");
  });
});
