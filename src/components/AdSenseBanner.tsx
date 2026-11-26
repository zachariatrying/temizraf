import { useEffect, useRef, useState } from 'react';
import { Check, Copy, Sparkles } from 'lucide-react';

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
  const [infoOpen, setInfoOpen] = useState(false);
  const [copied, setCopied] = useState(false);
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
      aria-label="Sponsorlu ürün ve reklam alanı"
      className="border border-[#0F7A47]/30 bg-gradient-to-br from-[#E6F5EC] to-[#F4FBF7] p-4 sm:p-5 space-y-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] font-label-mono uppercase tracking-wider text-[#0F7A47]">
        <span>SPONSORLU VİTRİN · TEMİZ İÇERİKLİ MARKA ALANI</span>
        <span className="px-2 py-0.5 bg-[#0F7A47] text-white font-bold">75+ Puan Şartı</span>
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
        <div className="border border-[#0F7A47]/25 bg-white/95 p-4 sm:p-5 space-y-2.5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1 max-w-xl">
              <div className="text-sm sm:text-base font-bold text-[#0D2E1E] flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-[#0F7A47] shrink-0" />
                <span>🌿 Burada Neden Sizin Ürününüz Olmasın?</span>
              </div>
              <p className="text-xs text-[#3B5E4C] leading-relaxed">
                Katkısız, doğal veya temiz içerikli <strong>{categoryHint || 'gıda ve kozmetik'}</strong> üretiyorsanız;
                tam bu kategoride barkod okutan bilinçli tüketicilerin karşısına doğrudan çıkın. Yalnızca TemizRaf
                puanı <strong>75 ve üzeri</strong> olan temiz ürünler bu vitrinde yer alabilir.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setInfoOpen((v) => !v)}
              className="shrink-0 px-3.5 py-2 bg-[#0F7A47] text-white text-xs font-bold hover:bg-[#0B5E36] transition-colors cursor-pointer"
            >
              {infoOpen ? 'Bilgiyi Gizle' : 'Sponsorlu Vitrin Başvurusu →'}
            </button>
          </div>

          {infoOpen && (
            <div className="border-t border-[#0F7A47]/20 pt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-[#0D2E1E]">
              <div className="space-y-0.5">
                <div className="font-bold">Kategori Bazlı Hedefleme · Doğrulanmış Temiz Etiket Güveni</div>
                <div className="text-[#3B5E4C]">
                  Aylık sabit vitrin veya tıklama bazlı model + otomatik Google AdSense (`VITE_ADSENSE_CLIENT`) desteği.
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText('sponsor@temizraf.app');
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1800);
                }}
                className="inline-flex items-center gap-1.5 border border-[#0F7A47] bg-[#E6F5EC] px-3 py-1.5 font-label-mono text-[11px] font-bold text-[#0F7A47] cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'E-posta Kopyalandı' : 'sponsor@temizraf.app'}
              </button>
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
