import { useEffect, useState } from 'react';
import { BookOpen, FileText, Filter, ScanBarcode, Search, X } from 'lucide-react';

const GUIDE_STEPS = [
  {
    icon: ScanBarcode,
    badge: '01 · ÜÇLÜ BARKOD OKUYUCU',
    title: 'Kamera, Yakınlaştırma & Net Fotoğraf',
    desc: 'Barkod Okut butonuna basın; 1x/1.5x/2x yakınlaştırma ile canlı tarayın. Parlamalı veya zor odaklanan ambalajlarda "Net Fotoğraf Çek" seçeneği en yüksek doğruluğu verir.',
  },
  {
    icon: Search,
    badge: '02 · ÜRÜN & MARKET FİLTRESİ',
    title: 'Ürün Adı veya Markayla Ara',
    desc: 'Yanınızda ürün yoksa arama kutusundan ürün adı, marka veya barkod numarası yazın; market ve kategori filtreleriyle rafları hızlıca tarayın.',
  },
  {
    icon: FileText,
    badge: '03 · ETİKET & E-KODU ANALİZİ',
    title: 'İçindekiler Metnini Anında Çözümle',
    desc: 'Ürün etiketindeki içindekiler listesini yapıştırın; E-kodlarını, glikoz-fruktoz şurubunu, palmiye yağını ve katkı yoğunluğu puan kırılımını görün.',
  },
  {
    icon: Filter,
    badge: '04 · TEMİZ ALTERNATİFLER',
    title: 'Hassasiyet Filtreleri & Yerel Öneriler',
    desc: 'Palmiyesiz, katkısız veya şeker ilavesiz filtrelerini aktif edin; puanı düşük ürünlerin yerine daha temiz yerel alternatifleri kıyaslayın.',
  },
];

export function GuideWidget() {
  const [open, setOpen] = useState(() => {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    return params.get('rehber') === '1' || window.location.hash === '#rehber';
  });

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="TemizRaf kullanım rehberini aç"
        className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-full border border-[#0D2E1E] bg-[#0F7A47] hover:bg-[#0B5E36] text-white px-4 py-2.5 text-xs font-bold shadow-md cursor-pointer transition-colors focus-visible:ring-2 focus-visible:ring-[#0F7A47] focus-visible:ring-offset-2"
      >
        <BookOpen className="w-4 h-4" />
        <span>Rehber</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="app-guide-title"
        >
          <div
            className="w-full max-w-lg max-h-[88vh] overflow-y-auto border-2 border-[#0D2E1E] bg-[#FFFEFA] text-[#0D2E1E] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b-2 border-[#0D2E1E] bg-[#EDF6F0] px-5 py-4">
              <div>
                <div className="font-label-mono text-[10px] font-bold uppercase tracking-wider text-[#3B5E4C]">
                  TemizRaf Kullanım Rehberi
                </div>
                <h2 id="app-guide-title" className="font-serif-editorial text-2xl font-normal">
                  Etiket Okuma &amp; Barkod Kılavuzu
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Rehberi kapat"
                className="p-1.5 border border-[#0D2E1E]/25 bg-white hover:bg-[#EDF6F0] cursor-pointer focus-visible:ring-2 focus-visible:ring-[#0F7A47]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3">
              {GUIDE_STEPS.map((step) => {
                const Icon = step.icon;
                return (
                  <div
                    key={step.badge}
                    className="border border-[#0D2E1E]/20 bg-white p-3.5 flex items-start gap-3"
                  >
                    <div className="shrink-0 bg-[#EDF6F0] border border-[#0F7A47]/30 text-[#0F7A47] p-2">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="space-y-1">
                      <div className="font-label-mono text-[10px] font-bold text-[#0F7A47]">
                        {step.badge}
                      </div>
                      <h3 className="text-sm font-bold">{step.title}</h3>
                      <p className="text-xs text-[#3B5E4C] leading-relaxed">{step.desc}</p>
                    </div>
                  </div>
                );
              })}

              <div className="border border-[#0F7A47]/30 bg-[#EDF6F0] px-3.5 py-2.5 text-[11px] text-[#0D2E1E]">
                Bilgilendirme: Kamera görüntüsü hiçbir sunucuya gönderilmez; barkod ve içerik analizi tamamen cihazınızda çalışır.
              </div>
            </div>

            <div className="border-t border-[#0D2E1E]/20 px-5 py-3 flex justify-end bg-[#EDF6F0]">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="bg-[#0F7A47] hover:bg-[#0B5E36] text-white px-4 py-2 text-xs font-bold cursor-pointer focus-visible:ring-2 focus-visible:ring-[#0D2E1E]"
              >
                Anladım
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
