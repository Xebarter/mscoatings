import { useEffect, useRef, useState } from 'react';
import { Camera, X } from 'lucide-react';

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
  const containerId = 'desktop-camera-scanner';

  useEffect(() => {
    if (!open) return;

    let mounted = true;

    const stopScanner = async () => {
      if (scannerRef.current?.isScanning) {
        try {
          await scannerRef.current.stop();
        } catch {
          /* ignore */
        }
      }
      scannerRef.current = null;
    };

    const startScanner = async () => {
      try {
        setError(null);
        const { Html5Qrcode } = await import('html5-qrcode');
        const scanner = new Html5Qrcode(containerId);
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: { width: 250, height: 150 },
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

    void startScanner();

    return () => {
      mounted = false;
      void stopScanner();
    };
  }, [open, onClose, onScan]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/70 p-0 sm:items-center sm:p-4">
      <div className="w-full max-w-md overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <div className="flex items-center gap-2">
            <Camera size={18} className="text-blue-600" />
            <h3 className="font-semibold text-slate-900">Scan barcode</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        <div className="p-4">
          {error ? (
            <p className="rounded-lg bg-red-50 px-3 py-8 text-center text-sm text-red-700">
              {error}
            </p>
          ) : (
            <div id={containerId} className="overflow-hidden rounded-xl" />
          )}
          <p className="mt-3 text-center text-xs text-slate-500">
            Point the camera at a barcode or QR code
          </p>
        </div>
      </div>
    </div>
  );
}
