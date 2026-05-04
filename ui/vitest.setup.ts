import '@testing-library/jest-dom';

// Mock ResizeObserver for Recharts and other libraries
if (typeof window !== 'undefined') {
  (window as any).ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
