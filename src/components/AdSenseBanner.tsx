import { useEffect, useRef } from 'react';

interface AdSenseBannerProps {
  slotId?: string;
  categoryHint?: string;
}

declare global {
  interface Window {
    adsbygoogle?: Array<Record<string, unknown>>;
  }
}

export function AdSenseBanner({ slotId, categoryHint }: AdSenseBannerProps) {
  const clientId = import.meta.env.VITE_ADSENSE_CLIENT as string | undefined;
  const pushedRef = useRef(false);
  const isConfigured = Boolean(clientId && clientId.startsWith('ca-pub-'));

  useEffect(() => {
    if (!isConfigured || pushedRef.current) return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      pushedRef.current = true;
    } catch {
      // Ignore duplicate push in StrictMode or blocked ad scripts
    }
  }, [isConfigured]);

  return (
    <aside
      aria-label="Reklam alanı"
      className="border border-[#112A1E]/20 bg-[#F9F8F2] p-4 space-y-2.5"
    >
      <div className="flex items-center justify-between text-[10px] font-label-mono uppercase tracking-wider text-[#4B6155]">
        <span>REKLAM · SPONSORLU ÖNERİ ALANI</span>
        <span>Google AdSense</span>
      </div>

      {isConfigured ? (
        <ins
          className="adsbygoogle"
          style={{ display: 'block' }}
          data-ad-client={clientId}
          data-ad-slot={slotId || 'auto'}
          data-ad-format="auto"
          data-full-width-responsive="true"
        />
      ) : (
        <div className="border border-dashed border-[#112A1E]/25 bg-[#FFFEFA] px-4 py-5 text-center space-y-1.5">
          <div className="text-xs font-bold text-[#112A1E]">
            Google AdSense · Doğal &amp; Temiz İçerikli {categoryHint || 'Ürün'} Reklam Yuvası
          </div>
          <p className="text-[11px] text-[#4B6155] max-w-xl mx-auto leading-relaxed">
            Bu alan taranan ürün kategorisine göre temiz içerikli marka ve market reklamlarını göstermek için
            hazırlandı. <code className="font-label-mono bg-[#F6F4EC] px-1">VITE_ADSENSE_CLIENT</code> ve{' '}
            <code className="font-label-mono bg-[#F6F4EC] px-1">public/ads.txt</code> tanımlandığında otomatik
            gelir üretmeye başlar.
          </p>
        </div>
      )}
    </aside>
  );
}
