import { useState, useCallback, useLayoutEffect } from 'react';

export interface Bounds {
  width: number;
  height: number;
  top: number;
  left: number;
}

const defaultBounds: Bounds = {
  width: 0,
  height: 0,
  top: 0,
  left: 0,
};

/**
 * Hook that measures a DOM element using ResizeObserver
 * Returns a ref callback and current bounds
 */
export function useMeasure(): [
  (node: HTMLElement | null) => void,
  Bounds
] {
  const [bounds, setBounds] = useState<Bounds>(defaultBounds);
  const [node, setNode] = useState<HTMLElement | null>(null);

  const ref = useCallback((newNode: HTMLElement | null) => {
    setNode(newNode);
  }, []);

  useLayoutEffect(() => {
    if (!node) return;

    // Get initial size
    const rect = node.getBoundingClientRect();
    setBounds({
      width: rect.width,
      height: rect.height,
      top: rect.top,
      left: rect.left,
    });

    // Watch for size changes
    const resizeObserver = new ResizeObserver((entries) => {
      if (entries[0]) {
        const { width, height, top, left } = entries[0].contentRect;
        setBounds({ width, height, top, left });
      }
    });

    resizeObserver.observe(node);

    return () => {
      resizeObserver.disconnect();
    };
  }, [node]);

  return [ref, bounds];
}
