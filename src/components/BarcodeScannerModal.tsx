import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { Capacitor } from '@capacitor/core';
import {
  CapacitorBarcodeScanner,
  CapacitorBarcodeScannerCameraDirection,
  CapacitorBarcodeScannerTypeHint,
} from '@capacitor/barcode-scanner';
import {
  Camera,
  Flashlight,
  ImageUp,
  Keyboard,
  Smartphone,
  SwitchCamera,
  X,
  ZoomIn,
} from 'lucide-react';
import {
  decodeImageDataMultiPass,
  decodeImageElementRobust,
  decodeWithNativeDetector,
  ensureBarcodeWasm,
  isValidBarcodeText,
} from '../utils/barcodeEngine';

interface BarcodeScannerModalProps {
  open: boolean;
  onClose: () => void;
  onDetected: (code: string) => void;
}

export function BarcodeScannerModal({ open, onClose, onDetected }: BarcodeScannerModalProps) {
  const [error, setError] = useState<string | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceIndex, setDeviceIndex] = useState<number>(-1);
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [zoomRange, setZoomRange] = useState<{ min: number; max: number } | null>(null);
  const [zoomValue, setZoomValue] = useState<number>(1);
  const [manualCode, setManualCode] = useState('');
  const [statusText, setStatusText] = useState('WASM barkod motoru hazırlanıyor...');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectedRef = useRef(false);
  const onDetectedRef = useRef(onDetected);
  const onCloseRef = useRef(onClose);
  onDetectedRef.current = onDetected;
  onCloseRef.current = onClose;

  const isNative = Capacitor.isNativePlatform();

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
    setZoomRange(null);
    setZoomValue(1);
  };

  const completeScan = (rawCode: string) => {
    const clean = rawCode.trim();
    if (!clean || detectedRef.current) return;
    detectedRef.current = true;
    if (navigator.vibrate) {
      try {
        navigator.vibrate(45);
      } catch {}
    }
    stopStream();
    onDetectedRef.current(clean);
    onCloseRef.current();
  };

  const applyZoom = async (targetZoom: number) => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track || !zoomRange) return;
    const clamped = Math.max(zoomRange.min, Math.min(zoomRange.max, targetZoom));
    try {
      await track.applyConstraints({ advanced: [{ zoom: clamped } as MediaTrackConstraintSet] });
      setZoomValue(clamped);
    } catch {}
  };

  const handleNativeScan = async () => {
    setError(null);
    try {
      const result = await CapacitorBarcodeScanner.scanBarcode({
        hint: CapacitorBarcodeScannerTypeHint.ALL,
        cameraDirection: CapacitorBarcodeScannerCameraDirection.BACK,
        scanInstructions: 'Barkodu çerçeve içine hizalayın',
        scanButton: false,
      });
      if (result.ScanResult && isValidBarcodeText(result.ScanResult)) {
        completeScan(result.ScanResult);
      }
    } catch {
      setError('Native kamera tarayıcısı başlatılamadı; aşağıdan fotoğraf çekerek veya canlı akıştan deneyebilirsin.');
    }
  };

  useEffect(() => {
    if (!open) {
      stopStream();
      return;
    }
    let cancelled = false;
    detectedRef.current = false;
    setError(null);
    setStatusText('Yüksek netlikte kamera başlatılıyor...');
    ensureBarcodeWasm();

    let timerId: number | null = null;
    let scanning = false;
    let tickCount = 0;

    const startCamera = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('Tarayıcı kamera API’sini desteklemiyor.');
        }

        const chosenDeviceId = deviceIndex >= 0 ? devices[deviceIndex]?.deviceId : undefined;
        const videoConstraints: MediaTrackConstraints = chosenDeviceId
          ? { deviceId: { exact: chosenDeviceId }, width: { ideal: 1920 }, height: { ideal: 1080 } }
          : { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } };

        const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: videoConstraints });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;

        const track = stream.getVideoTracks()[0];
        const caps = track?.getCapabilities?.() as MediaTrackCapabilities & {
          torch?: boolean;
          zoom?: { min: number; max: number };
          focusMode?: string[];
        };

        setTorchSupported(Boolean(caps?.torch));

        // Request continuous autofocus & slight macro zoom where supported
        const adv: Array<Record<string, unknown>> = [];
        if (caps?.focusMode?.includes('continuous')) adv.push({ focusMode: 'continuous' });
        if (caps?.zoom && caps.zoom.max >= 1.4) {
          const initialZoom = Math.min(caps.zoom.max, Math.max(caps.zoom.min, 1.4));
          adv.push({ zoom: initialZoom });
          setZoomRange({ min: caps.zoom.min, max: caps.zoom.max });
          setZoomValue(initialZoom);
        } else {
          setZoomRange(null);
        }
        if (adv.length > 0) {
          try {
            await track.applyConstraints({ advanced: adv as unknown as MediaTrackConstraintSet[] });
          } catch {}
        }

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        const allDevices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = allDevices.filter((d) => d.kind === 'videoinput');
        setDevices(videoInputs);

        setStatusText('Barkodu yeşil alana yaklaştırın (yatay veya dikey)...');

        const roiCanvas = document.createElement('canvas');
        const roiCtx = roiCanvas.getContext('2d', { willReadFrequently: true });
        const fullCanvas = document.createElement('canvas');
        const fullCtx = fullCanvas.getContext('2d', { willReadFrequently: true });

        timerId = window.setInterval(async () => {
          if (cancelled || detectedRef.current || scanning) return;
          const video = videoRef.current;
          if (!video || video.readyState < 2 || video.videoWidth === 0 || !roiCtx || !fullCtx) return;

          scanning = true;
          tickCount++;
          try {
            const vw = video.videoWidth;
            const vh = video.videoHeight;

            // Pass 1: Center Barcode Band ROI at native resolution
            const rw = Math.round(vw * 0.86);
            const rh = Math.round(vh * 0.48);
            const rx = Math.round((vw - rw) / 2);
            const ry = Math.round((vh - rh) / 2);
            roiCanvas.width = rw;
            roiCanvas.height = rh;
            roiCtx.drawImage(video, rx, ry, rw, rh, 0, 0, rw, rh);

            const nativeHit = await decodeWithNativeDetector(roiCanvas);
            if (nativeHit) {
              completeScan(nativeHit);
              return;
            }

            const roiData = roiCtx.getImageData(0, 0, rw, rh);
            const roiHit = await decodeImageDataMultiPass(roiData, 'LocalAverage');
            if (roiHit) {
              completeScan(roiHit);
              return;
            }

            // Pass 2 (every 2nd tick): Full frame scan for off-center or rotated barcodes
            if (tickCount % 2 === 0) {
              const scale = Math.min(1, 1280 / vw);
              fullCanvas.width = Math.round(vw * scale);
              fullCanvas.height = Math.round(vh * scale);
              fullCtx.drawImage(video, 0, 0, fullCanvas.width, fullCanvas.height);
              const fullData = fullCtx.getImageData(0, 0, fullCanvas.width, fullCanvas.height);
              const fullHit = await decodeImageDataMultiPass(fullData, 'LocalAverage');
              if (fullHit) {
                completeScan(fullHit);
              }
            }
          } finally {
            scanning = false;
          }
        }, 110);
      } catch {
        if (!cancelled) {
          setError(
            'Canlı kamera izni verilmedi veya cihazda kamera bulunamadı. Aşağıdan fotoğraf çekerek, galeriden seçerek veya barkod numarasını yazarak devam edebilirsin.'
          );
          setStatusText('Kamera kullanılamıyor');
        }
      }
    };

    void startCamera();

    return () => {
      cancelled = true;
      if (timerId !== null) window.clearInterval(timerId);
      stopStream();
    };
    // Intentionally depend only on open and explicit deviceIndex switch
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, deviceIndex]);

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
    setStatusText('Fotoğraf WASM motoruyla taranıyor...');

    try {
      const img = new Image();
      const objUrl = URL.createObjectURL(file);
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Görsel yüklenemedi'));
        img.src = objUrl;
      });
      URL.revokeObjectURL(objUrl);

      const decoded = await decodeImageElementRobust(img);
      if (decoded) {
        completeScan(decoded);
        return;
      }
      throw new Error('Barkod bulunamadı');
    } catch {
      setError('Fotoğrafta barkod okunamadı. Barkodu net ve ışıklı bir açıdan çekip tekrar deneyin veya aşağıya numarasını yazın.');
      setStatusText('Barkod bulunamadı');
    } finally {
      e.target.value = '';
    }
  };

  const handleManualSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    completeScan(manualCode);
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0D2E1E]/70 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Kamera ile barkod tarayıcı"
    >
      <div className="w-full max-w-md border-2 border-[#0F7A47] bg-white p-5 shadow-2xl space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-[#0F7A47]" />
            <h2 className="font-serif-editorial text-2xl font-bold text-[#0B4D2D]">Barkod Okut</h2>
          </div>
          <button
            type="button"
            onClick={() => {
              stopStream();
              onClose();
            }}
            aria-label="Kapat"
            className="p-1.5 text-[#3B5E4C] hover:bg-[#EDF6F0] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {isNative && (
          <button
            type="button"
            onClick={() => void handleNativeScan()}
            className="w-full inline-flex items-center justify-center gap-2 bg-[#0F7A47] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#0B5E36] cursor-pointer"
          >
            <Smartphone className="w-4 h-4" />
            Tam Ekran Native Kamera ile Tara
          </button>
        )}

        {/* Live Video Preview with Targeting Guide */}
        <div className="relative w-full h-56 bg-[#0B1F16] border border-[#0F7A47]/40 overflow-hidden flex items-center justify-center">
          <video ref={videoRef} playsInline muted autoPlay className="w-full h-full object-cover" />
          <div className="pointer-events-none absolute inset-x-7 top-1/2 -translate-y-1/2 h-24 border-2 border-[#34D399]/90 rounded-sm">
            <div className="absolute inset-x-2 top-1/2 h-0.5 bg-rose-500/80" />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#3B5E4C]">
          <span className="truncate">{statusText}</span>
          <div className="flex items-center gap-1.5 shrink-0">
            {zoomRange && (
              <div className="inline-flex items-center border border-[#0F7A47]/30 bg-[#EDF6F0]">
                <ZoomIn className="w-3 h-3 text-[#0F7A47] ml-1.5" />
                {[1, 1.5, 2]
                  .filter((z) => z <= zoomRange.max + 0.05)
                  .map((z) => (
                    <button
                      key={z}
                      type="button"
                      onClick={() => void applyZoom(z)}
                      className={`px-1.5 py-0.5 text-[10px] font-label-mono font-bold cursor-pointer ${
                        Math.abs(zoomValue - z) < 0.2 ? 'bg-[#0F7A47] text-white' : 'text-[#0B4D2D]'
                      }`}
                    >
                      {z}x
                    </button>
                  ))}
              </div>
            )}
            {torchSupported && (
              <button
                type="button"
                onClick={() => void toggleTorch()}
                className={`px-2 py-1 border text-[11px] font-bold flex items-center gap-1 cursor-pointer ${
                  torchOn ? 'bg-[#FFE600] border-[#111111] text-[#111111]' : 'border-[#0F7A47]/30 bg-white'
                }`}
              >
                <Flashlight className="w-3.5 h-3.5" /> Flaş
              </button>
            )}
            {devices.length > 1 && (
              <button
                type="button"
                onClick={() => setDeviceIndex((prev) => (prev + 1) % devices.length)}
                className="px-2 py-1 border border-[#0F7A47]/30 bg-white text-[11px] font-bold flex items-center gap-1 cursor-pointer"
              >
                <SwitchCamera className="w-3.5 h-3.5" /> Lens
              </button>
            )}
          </div>
        </div>

        {/* Distinct Native OS Camera Shot vs Gallery Upload */}
        <div className="grid grid-cols-2 gap-2">
          <label className="inline-flex items-center justify-center gap-1.5 border border-[#0F7A47] bg-[#E6F3EB] px-3 py-2.5 text-[11px] font-bold text-[#0B4D2D] hover:bg-[#D4ECDD] cursor-pointer">
            <Camera className="w-3.5 h-3.5 text-[#0F7A47]" />
            Net Fotoğraf Çek
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => void handleFileScan(e)}
              className="hidden"
            />
          </label>
          <label className="inline-flex items-center justify-center gap-1.5 border border-[#0F7A47]/35 bg-[#EDF6F0] px-3 py-2.5 text-[11px] font-bold text-[#0D2E1E] hover:bg-[#E2F3E9] cursor-pointer">
            <ImageUp className="w-3.5 h-3.5 text-[#0F7A47]" />
            Galeriden Seç
            <input
              type="file"
              accept="image/*"
              onChange={(e) => void handleFileScan(e)}
              className="hidden"
            />
          </label>
        </div>

        <form onSubmit={handleManualSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <Keyboard className="w-3.5 h-3.5 text-[#3B5E4C] absolute left-2.5 top-2.5" />
            <input
              type="text"
              inputMode="numeric"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder="Barkod numarası yaz (ör. 8690504...)"
              className="w-full border border-[#0F7A47]/30 bg-[#EDF6F0] pl-8 pr-2.5 py-2 text-xs font-label-mono"
            />
          </div>
          <button type="submit" className="bg-[#0F7A47] px-3.5 py-2 text-xs font-bold text-white hover:bg-[#0B5E36] cursor-pointer">
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
