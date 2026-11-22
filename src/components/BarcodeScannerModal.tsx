import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { X, Camera, ImageUp } from 'lucide-react';

interface BarcodeScannerModalProps {
  open: boolean;
  onClose: () => void;
  onDetected: (code: string) => void;
}

const SUPPORTED_FORMATS = [
  Html5QrcodeSupportedFormats.EAN_13,
  Html5QrcodeSupportedFormats.EAN_8,
  Html5QrcodeSupportedFormats.UPC_A,
  Html5QrcodeSupportedFormats.UPC_E,
  Html5QrcodeSupportedFormats.CODE_128,
  Html5QrcodeSupportedFormats.QR_CODE,
];

export function BarcodeScannerModal({ open, onClose, onDetected }: BarcodeScannerModalProps) {
  const [error, setError] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setError(null);

    const startScanner = async () => {
      try {
        const scanner = new Html5Qrcode('temizraf-barcode-reader', {
          formatsToSupport: SUPPORTED_FORMATS,
          experimentalFeatures: { useBarCodeDetectorIfSupported: true },
          verbose: false,
        });
        scannerRef.current = scanner;

        const config = {
          fps: 12,
          qrbox: { width: 260, height: 130 },
          aspectRatio: 1.5,
        };

        const onSuccess = (decodedText: string) => {
          if (!active) return;
          active = false;
          void scanner.stop().finally(() => {
            onDetected(decodedText);
            onClose();
          });
        };

        try {
          await scanner.start({ facingMode: 'environment' }, config, onSuccess, () => {});
        } catch {
          const cameras = await Html5Qrcode.getCameras();
          if (!cameras || cameras.length === 0) {
            throw new Error('Kamera bulunamadı');
          }
          const backCam =
            cameras.find((c) => /back|rear|environment/i.test(c.label)) ?? cameras[0];
          await scanner.start(backCam.id, config, onSuccess, () => {});
        }
      } catch {
        if (active) {
          setError(
            'Canlı kamera başlatılamadı (izin veya kamera eksik). Aşağıdan "Fotoğraftan Barkod Oku" ile ürün barkodunun fotoğrafını seçebilir veya barkodu elle girebilirsin.'
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

  const handleFileScan = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    try {
      const current = scannerRef.current;
      if (current && current.isScanning) {
        await current.stop().catch(() => {});
      }
      const fileScanner = new Html5Qrcode('temizraf-barcode-reader', {
        formatsToSupport: SUPPORTED_FORMATS,
        verbose: false,
      });
      const decoded = await fileScanner.scanFile(file, true);
      onDetected(decoded);
      onClose();
    } catch {
      setError('Fotoğrafta barkod okunamadı. Barkodun net ve iyi aydınlatılmış olduğundan emin olun.');
    }
  };

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

        <label className="mt-3 w-full inline-flex items-center justify-center gap-2 rounded-xl border border-[#1B7F4B]/30 bg-white px-4 py-2.5 text-xs font-bold text-[#14281D] hover:bg-[#E7F5ED] cursor-pointer">
          <ImageUp className="w-4 h-4 text-[#1B7F4B]" />
          Fotoğraftan Barkod Oku (Kamera / Galeri)
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => void handleFileScan(e)}
            className="hidden"
          />
        </label>

        {error && (
          <p className="mt-3 rounded-xl bg-[#FEF4E4] border border-[#F2D9AA] p-3 text-xs text-[#8A5306]">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
