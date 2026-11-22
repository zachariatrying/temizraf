import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X, Camera } from 'lucide-react';

interface BarcodeScannerModalProps {
  open: boolean;
  onClose: () => void;
  onDetected: (code: string) => void;
}

export function BarcodeScannerModal({ open, onClose, onDetected }: BarcodeScannerModalProps) {
  const [error, setError] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setError(null);

    const startScanner = async () => {
      try {
        const scanner = new Html5Qrcode('temizraf-barcode-reader');
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 250, height: 120 } },
          (decodedText) => {
            if (!active) return;
            active = false;
            void scanner.stop().finally(() => {
              onDetected(decodedText);
              onClose();
            });
          },
          () => {
            // Ignore per-frame decode misses
          }
        );
      } catch {
        if (active) {
          setError(
            'Kamera izni alınamadı veya cihazda kamera bulunamadı. Barkodu elle girerek ya da hazır raf ürünlerinden seçerek anında test edebilirsin.'
          );
        }
      }
    };

    void startScanner();

    return () => {
      active = false;
      const inst = scannerRef.current;
      scannerRef.current = null;
      if (inst && inst.isScanning) {
        void inst.stop().catch(() => {});
      }
    };
  }, [open, onDetected, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#14281D]/55 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Kamera ile barkod tarayıcı"
    >
      <div className="w-full max-w-md rounded-3xl border border-[#E5E0D5] bg-[#FAF8F3] p-5 shadow-2xl">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-[#1B7F4B]" />
            <h2 className="font-serif-editorial text-xl font-bold text-[#14281D]">Barkod Okut</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Kapat"
            className="rounded-full p-2 text-[#526258] hover:bg-[#ECE7DC] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div
          id="temizraf-barcode-reader"
          className="w-full min-h-[240px] rounded-2xl overflow-hidden bg-[#14281D] border border-[#DCE4DE]"
        />

        {error && (
          <p className="mt-3 rounded-xl bg-[#FEF4E4] border border-[#F2D9AA] p-3 text-xs text-[#8A5306]">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
