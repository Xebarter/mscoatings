'use client';

import { useEffect, useRef, useState } from 'react';
import { X, Camera } from 'lucide-react';

interface CameraScannerModalProps {
  open: boolean;
  onClose: () => void;
  onScan: (barcode: string) => void;
}

export default function CameraScannerModal({
  open,
  onClose,
  onScan,
}: CameraScannerModalProps) {
  const scannerRef = useRef<import('html5-qrcode').Html5Qrcode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const containerId = 'pos-camera-scanner';

  useEffect(() => {
    if (!open) return;

    let mounted = true;

    const startScanner = async () => {
      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        const scanner = new Html5Qrcode(containerId);
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: { width: 250, height: 150 },
            formatsToSupport: [
              0, // QR_CODE
              1, // AZTEC
              2, // CODABAR
              3, // CODE_39
              4, // CODE_93
              5, // CODE_128
              6, // DATA_MATRIX
              7, // MAXICODE
              8, // ITF
              9, // EAN_13
              10, // EAN_8
              11, // PDF_417
              12, // RSS_14
              13, // RSS_EXPANDED
              14, // UPC_A
              15, // UPC_E
              16, // UPC_EAN_EXTENSION
            ] as never,
          },
          (decodedText) => {
            if (!mounted) return;
            onScan(decodedText);
            void stopScanner();
            onClose();
          },
          () => {}
        );
      } catch (err) {
        console.error('Camera scanner error:', err);
        if (mounted) {
          setError(
            err instanceof Error
              ? err.message
              : 'Could not access camera. Check permissions.'
          );
        }
      }
    };

    const stopScanner = async () => {
      if (scannerRef.current?.isScanning) {
        try {
          await scannerRef.current.stop();
        } catch {
          // ignore stop errors
        }
      }
      scannerRef.current = null;
    };

    setError(null);
    void startScanner();

    return () => {
      mounted = false;
      void stopScanner();
    };
  }, [open, onClose, onScan]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <div className="flex items-center gap-2">
            <Camera size={20} className="text-blue-600" />
            <h3 className="font-semibold text-slate-900">Scan Barcode</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
            aria-label="Close scanner"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-4">
          {error ? (
            <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </p>
          ) : (
            <div
              id={containerId}
              className="overflow-hidden rounded-lg bg-slate-900"
            />
          )}
          <p className="mt-3 text-center text-xs text-slate-500">
            Point your camera at a product barcode
          </p>
        </div>
      </div>
    </div>
  );
}
