import { beforeEach, expect } from "bun:test";
import { JSDOM } from "jsdom";
import * as matchers from "@testing-library/jest-dom/matchers";

const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>");
global.window = dom.window as unknown as typeof globalThis.window;
global.document = dom.window.document;
global.navigator = dom.window.navigator;
global.DocumentFragment = dom.window.DocumentFragment;
global.MutationObserver = dom.window.MutationObserver;

// Mock localStorage for Zustand persist middleware
const mockStorage = new Map<string, string>();
global.localStorage = {
  getItem: (key: string) => mockStorage.get(key) || null,
  setItem: (key: string, value: string) => mockStorage.set(key, value),
  removeItem: (key: string) => mockStorage.delete(key),
  clear: () => mockStorage.clear(),
  get length() { return mockStorage.size; },
  key: (index: number) => Array.from(mockStorage.keys())[index] || null,
} as Storage;

global.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);

global.requestAnimationFrame = (callback: FrameRequestCallback) => {
  return setTimeout(callback, 0) as unknown as number;
};

global.cancelAnimationFrame = (id: number) => {
  clearTimeout(id);
};

expect.extend(matchers);

beforeEach(() => {
  document.body.innerHTML = "";
});