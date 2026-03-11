import { beforeEach, expect } from "bun:test";
import { JSDOM } from "jsdom";
import * as matchers from "@testing-library/jest-dom/matchers";

const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>");
global.window = dom.window as unknown as typeof globalThis.window;
global.document = dom.window.document;
global.navigator = dom.window.navigator;

// Expose getComputedStyle
global.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);

// Polyfill requestAnimationFrame
global.requestAnimationFrame = (callback: FrameRequestCallback) => {
  return setTimeout(callback, 0) as unknown as number;
};

// Polyfill cancelAnimationFrame
global.cancelAnimationFrame = (id: number) => {
  clearTimeout(id);
};

expect.extend(matchers);

beforeEach(() => {
  document.body.innerHTML = "";
});