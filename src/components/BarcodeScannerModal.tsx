import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { BarcodeFormat, DecodeHintType } from '@zxing/library';
import { X, Camera, ImageUp, Flashlight, SwitchCamera, Keyboard } from 'lucide-react';

interface BarcodeScannerModalProps {
  open: boolean;
  onClose: () => void;
  onDetected: (code: string) => void;
}

const SUPPORTED_FORMATS = [
  BarcodeFormat.EAN_13,
  BarcodeFormat.EAN_8,
  BarcodeFormat.UPC_A,
  BarcodeFormat.UPC_E,
  BarcodeFormat.CODE_128,
  BarcodeFormat.QR_CODE,
];

function createZxingReader(): BrowserMultiFormatReader {
  const hints = new Map();
  hints.set(DecodeHintType.POSSIBLE_FORMATS, SUPPORTED_FORMATS);
  hints.set(DecodeHintType.TRY_HARDER, true);
  return new BrowserMultiFormatReader(hints);
}

export function BarcodeScannerModal({ open, onClose, onDetected }: BarcodeScannerModalProps) {
  const [error, setError] = useState<string | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [statusText, setStatusText] = useState('Kamera başlatılıyor...');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectedRef = useRef(false);

  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => {
        try {
          t.stop();
        } catch {}
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setTorchOn(false);
    setTorchSupported(false);
  };

  useEffect(() => {
    if (!open) {
      stopStream();
      return;
    }
    let cancelled = false;
    detectedRef.current = false;
    setError(null);
    setStatusText('Kamera başlatılıyor...');

    let intervalId: number | null = null;
    const reader = createZxingReader();

    const finishWithCode = (code: string) => {
      if (detectedRef.current || cancelled) return;
      detectedRef.current = true;
      stopStream();
      onDetected(code.trim());
      onClose();
    };

    const startCamera = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('Tarayıcı kamera API’sini desteklemiyor.');
        }

        const constraints: MediaStreamConstraints = {
          audio: false,
          video: selectedDeviceId
            ? { deviceId: { exact: selectedDeviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
            : { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;

        const track = stream.getVideoTracks()[0];
        const caps = track?.getCapabilities?.() as MediaTrackCapabilities & { torch?: boolean };
        setTorchSupported(Boolean(caps?.torch));

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        const allDevices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = allDevices.filter((d) => d.kind === 'videoinput');
        setDevices(videoInputs);
        if (!selectedDeviceId && track?.getSettings?.().deviceId) {
          setSelectedDeviceId(track.getSettings().deviceId!);
        }

        setStatusText('Barkodu kırmızı çizgiye hizalayın (EAN-13 / EAN-8)...');

        // Offscreen canvas for dual-engine frame decoding (Native BarcodeDetector + ZXing)
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        const NativeDetector = (window as unknown as { BarcodeDetector?: new (opts: { formats: string[] }) => { detect: (src: CanvasImageSource) => Promise<Array<{ rawValue: string }>> } }).BarcodeDetector;
        const nativeDetector = NativeDetector
          ? new NativeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'qr_code'] })
          : null;

        intervalId = window.setInterval(async () => {
          if (cancelled || detectedRef.current) return;
          const video = videoRef.current;
          if (!video || video.readyState < 2 || video.videoWidth === 0 || !ctx) return;

          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

          // 1. Native hardware BarcodeDetector (instant on Android Chrome / Edge / Capacitor WebView)
          if (nativeDetector) {
            try {
              const hits = await nativeDetector.detect(canvas);
              if (hits.length > 0 && hits[0].rawValue) {
                finishWithCode(hits[0].rawValue);
                return;
              }
            } catch {}
          }

          // 2. ZXing MultiFormat TRY_HARDER fallback
          try {
            const res = reader.decodeFromCanvas(canvas);
            if (res && res.getText()) {
              finishWithCode(res.getText());
            }
          } catch {
            // NotFoundException on empty frames is expected
          }
        }, 160);
      } catch {
        if (!cancelled) {
          setError(
            'Canlı kamera izni verilmedi veya cihazda kamera bulunamadı. Aşağıdan fotoğraf seçerek veya barkod numarasını yazarak tarama yapabilirsin.'
          );
          setStatusText('Kamera kullanılamıyor');
        }
      }
    };

    void startCamera();

    return () => {
      cancelled = true;
      if (intervalId !== null) window.clearInterval(intervalId);
      stopStream();
    };
  }, [open, selectedDeviceId, onDetected, onClose]);

  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const next = !torchOn;
    try {
      await track.applyConstraints({ advanced: [{ torch: next } as MediaTrackConstraintSet] });
      setTorchOn(next);
    } catch {}
  };

  const handleFileScan = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setStatusText('Fotoğraf taranıyor...');

    try {
      const reader = createZxingReader();
      const img = new Image();
      const objUrl = URL.createObjectURL(file);
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Görsel yüklenemedi'));
        img.src = objUrl;
      });
      URL.revokeObjectURL(objUrl);

      const canvas = document.createElement('canvas');
      const maxDim = 1400;
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas hatası');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      // Try native BarcodeDetector first
      const NativeDetector = (window as unknown as { BarcodeDetector?: new (opts: { formats: string[] }) => { detect: (src: CanvasImageSource) => Promise<Array<{ rawValue: string }>> } }).BarcodeDetector;
      if (NativeDetector) {
        try {
          const nd = new NativeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'qr_code'] });
          const hits = await nd.detect(canvas);
          if (hits.length > 0 && hits[0].rawValue) {
            stopStream();
            onDetected(hits[0].rawValue);
            onClose();
            return;
          }
        } catch {}
      }

      // Try ZXing on full canvas, then high-contrast center crop
      try {
        const res = reader.decodeFromCanvas(canvas);
        if (res.getText()) {
          stopStream();
          onDetected(res.getText());
          onClose();
          return;
        }
      } catch {
        ctx.filter = 'contrast(160%) grayscale(100%)';
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const res2 = reader.decodeFromCanvas(canvas);
        if (res2.getText()) {
          stopStream();
          onDetected(res2.getText());
          onClose();
          return;
        }
      }
      throw new Error('Barkod bulunamadı');
    } catch {
      setError('Fotoğrafta barkod okunamadı. Barkodu yakından, net ve yatay çekip tekrar deneyin veya aşağıya numarasını yazın.');
      setStatusText('Barkod bulunamadı');
    } finally {
      e.target.value = '';
    }
  };

  const handleManualSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    stopStream();
    onDetected(manualCode.trim());
    onClose();
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#112A1E]/65 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Kamera ile barkod tarayıcı"
    >
      <div className="w-full max-w-md border-2 border-[#112A1E] bg-[#FFFEFA] p-5 shadow-2xl space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-[#0E5A36]" />
            <h2 className="font-serif-editorial text-2xl font-bold text-[#112A1E]">Barkod Okut</h2>
          </div>
          <button
            type="button"
            onClick={() => {
              stopStream();
              onClose();
            }}
            aria-label="Kapat"
            className="p-1.5 text-[#4B6155] hover:bg-[#F6F4EC] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Live Video Preview with Targeting Guide */}
        <div className="relative w-full h-56 bg-[#111827] border border-[#112A1E] overflow-hidden flex items-center justify-center">
          <video ref={videoRef} playsInline muted autoPlay className="w-full h-full object-cover" />
          <div className="pointer-events-none absolute inset-x-8 top-1/2 -translate-y-1/2 h-20 border-2 border-[#34D399]/80 rounded-sm">
            <div className="absolute inset-x-2 top-1/2 h-0.5 bg-rose-500/80" />
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 text-[11px] text-[#4B6155]">
          <span className="truncate">{statusText}</span>
          <div className="flex items-center gap-1.5 shrink-0">
            {torchSupported && (
              <button
                type="button"
                onClick={() => void toggleTorch()}
                className={`px-2 py-1 border text-[11px] font-bold flex items-center gap-1 cursor-pointer ${
                  torchOn ? 'bg-[#FFE600] border-[#111111] text-[#111111]' : 'border-[#112A1E]/25 bg-white'
                }`}
              >
                <Flashlight className="w-3.5 h-3.5" /> Flaş
              </button>
            )}
            {devices.length > 1 && (
              <button
                type="button"
                onClick={() => {
                  const idx = devices.findIndex((d) => d.deviceId === selectedDeviceId);
                  const next = devices[(idx + 1) % devices.length];
                  if (next) setSelectedDeviceId(next.deviceId);
                }}
                className="px-2 py-1 border border-[#112A1E]/25 bg-white text-[11px] font-bold flex items-center gap-1 cursor-pointer"
              >
                <SwitchCamera className="w-3.5 h-3.5" /> Lens Değiştir
              </button>
            )}
          </div>
        </div>

        <label className="w-full inline-flex items-center justify-center gap-2 border border-[#112A1E] bg-[#F6F4EC] px-4 py-2.5 text-xs font-bold text-[#112A1E] hover:bg-[#E7F5ED] cursor-pointer">
          <ImageUp className="w-4 h-4 text-[#0E5A36]" />
          Fotoğraftan Barkod Oku (Kamera / Galeri)
          <input type="file" accept="image/*" capture="environment" onChange={(e) => void handleFileScan(e)} className="hidden" />
        </label>

        <form onSubmit={handleManualSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <Keyboard className="w-3.5 h-3.5 text-[#4B6155] absolute left-2.5 top-2.5" />
            <input
              type="text"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder="Barkod numarası yaz (ör. 8690504...)"
              className="w-full border border-[#112A1E]/30 bg-white pl-8 pr-2.5 py-2 text-xs font-label-mono"
            />
          </div>
          <button type="submit" className="bg-[#0E5A36] px-3.5 py-2 text-xs font-bold text-white cursor-pointer">
            Ara
          </button>
        </form>

        {error && (
          <p className="border border-amber-400 bg-amber-50 p-2.5 text-xs text-amber-900">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
