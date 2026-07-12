import '@testing-library/jest-dom/vitest'

// jsdom 没有 ResizeObserver（EditorCanvas 用它跟随容器宽度）
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}
