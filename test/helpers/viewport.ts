export interface ViewportOptions {
  width?: number;
  height?: number;
  scrollY?: number;
  scrollX?: number;
}

export function createMockViewport(options: ViewportOptions = {}): {
  width: number;
  height: number;
  scrollY: number;
  scrollX: number;
} {
  const { width = 1024, height = 768, scrollY = 0, scrollX = 0 } = options;
  return { width, height, scrollY, scrollX };
}

export function setupViewportMock(options: ViewportOptions = {}) {
  const viewport = createMockViewport(options);
  
  Object.defineProperty(window, "innerWidth", { value: viewport.width });
  Object.defineProperty(window, "innerHeight", { value: viewport.height });
  Object.defineProperty(window, "scrollY", { value: viewport.scrollY, writable: true });
  Object.defineProperty(window, "scrollX", { value: viewport.scrollX, writable: true });
  
  return viewport;
}

export function simulateScroll(scrollY: number, scrollX: number = 0) {
  Object.defineProperty(window, "scrollY", { value: scrollY, writable: true });
  Object.defineProperty(window, "scrollX", { value: scrollX, writable: true });
}

export function createMockElement(offsetParent?: Element | null): Partial<HTMLElement> {
  return {
    offsetTop: 0,
    offsetLeft: 0,
    offsetWidth: 100,
    offsetHeight: 50,
    clientTop: 0,
    clientLeft: 0,
    getBoundingClientRect(): DOMRect {
      return {
        top: 0,
        left: 0,
        right: 100,
        bottom: 50,
        width: 100,
        height: 50,
        x: 0,
        y: 0,
        toJSON: () => "",
      };
    },
    offsetParent: offsetParent ?? null,
  };
}