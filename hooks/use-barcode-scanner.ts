'use client';

import { useCallback, useEffect, useRef } from 'react';

interface UseBarcodeScannerOptions {
  onScan: (barcode: string) => void;
  enabled?: boolean;
  minLength?: number;
  maxGapMs?: number;
}

export function useBarcodeScanner({
  onScan,
  enabled = true,
  minLength = 4,
  maxGapMs = 50,
}: UseBarcodeScannerOptions) {
  const bufferRef = useRef('');
  const lastKeyTimeRef = useRef(0);
  const onScanRef = useRef(onScan);

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  const resetBuffer = useCallback(() => {
    bufferRef.current = '';
    lastKeyTimeRef.current = 0;
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isInput =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable;

      if (isInput && target?.dataset?.barcodeInput !== 'true') {
        return;
      }

      const now = Date.now();
      const gap = now - lastKeyTimeRef.current;

      if (lastKeyTimeRef.current > 0 && gap > maxGapMs) {
        bufferRef.current = '';
      }

      if (event.key === 'Enter') {
        const code = bufferRef.current.trim();
        resetBuffer();
        if (code.length >= minLength) {
          event.preventDefault();
          onScanRef.current(code);
        }
        return;
      }

      if (event.key.length === 1) {
        bufferRef.current += event.key;
        lastKeyTimeRef.current = now;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled, maxGapMs, minLength, resetBuffer]);

  return { resetBuffer };
}
