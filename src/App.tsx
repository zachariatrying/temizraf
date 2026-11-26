import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Download,
  History,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import type { DietFilter, ProductRecord } from './types';
import { TURKISH_PRODUCTS } from './data/turkishProducts';
import {
  analyzeProduct,
  downloadScoreCardPng,
  findCleanAlternatives,
  lookupBarcodeLive,
} from './utils/analyzer';
import { BarcodeScannerModal } from './components/BarcodeScannerModal';
import { AdSenseBanner } from './components/AdSenseBanner';

const HISTORY_KEY = 'temizraf_history_v1';

const DIET_OPTIONS: Array<{ id: DietFilter; label: string }> = [
  { id: 'palmiyesiz', label: 'Palmiye Yağsız' },
  { id: 'sekersiz', label: 'Şekersiz' },
  { id: 'glutensiz', label: 'Glütensiz' },
  { id: 'laktozsuz', label: 'Laktozsuz' },
];

export default function App() {
  const sampleRisky = useMemo(() => TURKISH_PRODUCTS[0], []);
  const sampleCleanFood = useMemo(
    () =>
      TURKISH_PRODUCTS.find(
        (p) => p.domain === 'Gıda' && analyzeProduct(p, []).score >= 82
      ) || TURKISH_PRODUCTS[1],
    []
  );
  const sampleCosmetic = useMemo(
    () => TURKISH_PRODUCTS.find((p) => p.domain === 'Kozmetik') || TURKISH_PRODUCTS[2],
    []
  );

  const [selectedProduct, setSelectedProduct] = useState<ProductRecord | null>(null);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [loadingLive, setLoadingLive] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [kvkkOpen, setKvkkOpen] = useState(false);
  const [showRawLabel, setShowRawLabel] = useState(false);
  const [activeFilters, setActiveFilters] = useState<DietFilter[]>(['palmiyesiz']);

  const [history, setHistory] = useState<ProductRecord[]>(() => {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      return raw ? (JSON.parse(raw) as ProductRecord[]) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 10)));
    } catch {}
  }, [history]);

  const pushHistory = (prod: ProductRecord) => {
    setSelectedProduct(prod);
    setShowRawLabel(false);
    setHistory((prev) => [prod, ...prev.filter((p) => p.barcode !== prod.barcode)].slice(0, 10));
  };

  const handleBarcodeLookup = async (rawCode: string) => {
    const cleaned = rawCode.replace(/\D/g, '');
    if (cleaned.length < 8) {
      setLookupError('Lütfen 8–14 haneli geçerli bir barkod numarası okutun veya yazın.');
      return;
    }
    setLookupError(null);
    setBarcodeInput(cleaned);

    const localMatch = TURKISH_PRODUCTS.find((p) => p.barcode === cleaned);
    if (localMatch) {
      pushHistory(localMatch);
      return;
    }

    setLoadingLive(true);
    try {
      const live = await lookupBarcodeLive(cleaned);
      if (live) {
        pushHistory(live);
      } else {
        setLookupError(`"${cleaned}" barkodu Türkiye raf kataloğunda ve Open Food Facts veritabanında bulunamadı.`);
      }
    } finally {
      setLoadingLive(false);
    }
  };

  // Deep-link support: ?barkod=869...
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('barkod');
    if (code) {
      void handleBarcodeLookup(code);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFormSubmit = (e: FormEvent) => {
    e.preventDefault();
    void handleBarcodeLookup(barcodeInput);
  };

  const breakdown = useMemo(
    () => (selectedProduct ? analyzeProduct(selectedProduct, activeFilters) : null),
    [selectedProduct, activeFilters]
  );

  const alternatives = useMemo(
    () => (selectedProduct ? findCleanAlternatives(selectedProduct, activeFilters) : []),
    [selectedProduct, activeFilters]
  );

  const verdict = useMemo(() => {
    if (!breakdown) return null;
    if (breakdown.score >= 75) {
      return {
        label: 'TEMİZ İÇERİK',
        summary: 'Bu ürün temel katkı maddesi ve besin dengesi açısından temiz grupta yer alıyor.',
        bg: '#E7F5ED',
        border: '#1B7F4B',
        text: '#114A2B',
        Icon: ShieldCheck,
      };
    }
    if (breakdown.score >= 50) {
      return {
        label: 'ŞÜPHELİ / ORTA RİSK',
        summary: 'Bazı tartışmalı bileşenler veya yüksek şeker/tuz içeriği barındırıyor; daha temiz alternatiflere göz atabilirsin.',
        bg: '#FEF4E4',
        border: '#D97706',
        text: '#7C4106',
        Icon: AlertTriangle,
      };
    }
    return {
      label: 'TEMİZ DEĞİL — KAÇINILMASI ÖNERİLİR',
      summary: 'Yüksek riskli katkı maddesi, yoğun şeker/palm yağı veya hassasiyet uyarısı tespit edildi.',
      bg: '#FCECEA',
      border: '#C83E37',
      text: '#7D201B',
      Icon: ShieldAlert,
    };
  }, [breakdown]);

  const toggleFilter = (id: DietFilter) =>
    setActiveFilters((prev) => (prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]));

  return (
    <div className="min-h-screen flex flex-col bg-[#EDF6F0] text-[#0D2E1E]">
      <div className="h-1.5 w-full bg-gradient-to-r from-[#0B5E36] via-[#0F7A47] to-[#10B981]" />
      {/* Minimal Focused Header */}
      <header className="mx-auto max-w-4xl w-full px-4 sm:px-6 pt-5 pb-4 border-b border-[#0F7A47]/20 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <img
            src={`${import.meta.env.BASE_URL}store-assets/temizraf_icon.png`}
            alt="TemizRaf"
            className="w-9 h-9 rounded-md border border-[#0F7A47]/30 object-cover"
          />
          <div>
            <h1 className="font-serif-editorial text-2xl sm:text-3xl leading-none text-[#0B4D2D]">TemizRaf</h1>
            <p className="font-label-mono text-[11px] text-[#3B5E4C] mt-1">
              Barkod Okut · Temiz mi Değil mi? · Sebep &amp; Temiz Alternatif
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setKvkkOpen(true)}
          className="inline-flex items-center gap-1.5 border border-[#0F7A47]/30 bg-white px-3 py-1.5 text-xs font-semibold text-[#0D2E1E] hover:border-[#0F7A47] cursor-pointer"
        >
          <ShieldCheck className="w-3.5 h-3.5 text-[#0F7A47]" />
          KVKK
        </button>
      </header>

      <main className="flex-1 mx-auto w-full max-w-4xl px-4 sm:px-6 py-6 space-y-6">
        {/* Scanner-First Hero */}
        <section className="border border-[#0F7A47]/25 bg-white p-5 sm:p-6 space-y-4 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="font-serif-editorial text-2xl text-[#0B4D2D]">Barkodla İçerik Analizi</h2>
              <p className="text-xs sm:text-sm text-[#3B5E4C] mt-1">
                Ürünün barkodunu kamerayla okut veya numarasını yaz; neden temiz ya da riskli olduğunu ve daha temiz
                alternatiflerini hemen gör.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setScannerOpen(true)}
              className="shrink-0 inline-flex items-center justify-center gap-2 bg-[#0F7A47] px-5 py-3 text-sm font-bold text-white hover:bg-[#0B5E36] transition-colors cursor-pointer"
            >
              <Camera className="w-4 h-4" />
              Kamerayla Barkodu Okut
            </button>
          </div>

          <form onSubmit={handleFormSubmit} className="flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-[#0F7A47] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                inputMode="numeric"
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                placeholder="Barkod numarasını yazın (örn. 8690526090214)"
                className="w-full border border-[#0F7A47]/25 bg-[#E6F3EB] pl-10 pr-4 py-2.5 text-sm font-label-mono focus:outline-none focus:border-[#0F7A47]"
              />
            </div>
            <button
              type="submit"
              disabled={loadingLive}
              className="px-5 py-2.5 border border-[#0F7A47] bg-[#E6F3EB] text-[#0B4D2D] text-xs sm:text-sm font-bold hover:bg-[#0F7A47] hover:text-white transition-colors cursor-pointer disabled:opacity-50"
            >
              {loadingLive ? 'Sorgulanıyor...' : 'Barkodu Sorgula'}
            </button>
          </form>

          {/* Personal Sensitivity Toggles + Sample Barcodes */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#0F7A47]/15">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-label-mono text-[#3B5E4C] mr-1">Hassasiyetin:</span>
              {DIET_OPTIONS.map((opt) => {
                const active = activeFilters.includes(opt.id);
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => toggleFilter(opt.id)}
                    className={`px-2.5 py-1 text-[11px] font-semibold border cursor-pointer ${
                      active
                        ? 'border-[#0F7A47] bg-[#0F7A47] text-white'
                        : 'border-[#0F7A47]/25 bg-[#EDF6F0] text-[#3B5E4C]'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-label-mono text-[#3B5E4C]">Örnek Dene:</span>
              {[
                { label: 'Katkılı Ürün', prod: sampleRisky },
                { label: 'Temiz Gıda', prod: sampleCleanFood },
                { label: 'Kozmetik', prod: sampleCosmetic },
              ].map((s) => (
                <button
                  key={s.prod.barcode}
                  type="button"
                  onClick={() => void handleBarcodeLookup(s.prod.barcode)}
                  className="px-2.5 py-1 text-[11px] font-semibold border border-[#0F7A47]/25 bg-[#F4FBF7] text-[#0B4D2D] hover:border-[#0F7A47] cursor-pointer"
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {lookupError && (
            <div className="border border-[#C83E37]/40 bg-[#FCECEA] px-4 py-2.5 text-xs text-[#7D201B] font-medium">
              {lookupError}
            </div>
          )}
        </section>

        {/* Empty State before first scan */}
        {!selectedProduct && (
          <section className="border border-dashed border-[#112A1E]/25 bg-[#FFFEFA] p-6 text-center space-y-2">
            <div className="text-sm font-bold">Analiz için bir barkod okutun veya yukarıdan örnek bir barkod seçin</div>
            <p className="text-xs text-[#4B6155] max-w-lg mx-auto">
              Türkiye raf kataloğu ve Open Food Facts canlı verisi üzerinden E-kodları, şeker/palm yağı yükü ve temiz
              alternatifler anında listelenir.
            </p>
          </section>
        )}

        {/* Verdict + Reasons + Clean Alternatives + AdSense */}
        {selectedProduct && breakdown && verdict && (
          <div className="space-y-5">
            {/* 1. Clear Verdict Card */}
            <section
              className="border-2 p-5 sm:p-6 flex flex-wrap items-center justify-between gap-4"
              style={{ backgroundColor: verdict.bg, borderColor: verdict.border }}
            >
              <div className="flex items-start gap-3.5 max-w-xl">
                <verdict.Icon className="w-8 h-8 shrink-0 mt-0.5" style={{ color: verdict.border }} />
                <div>
                  <div className="font-label-mono text-[11px] font-bold uppercase" style={{ color: verdict.text }}>
                    {verdict.label}
                  </div>
                  <h2 className="font-serif-editorial text-2xl sm:text-3xl leading-tight mt-0.5">
                    {selectedProduct.name}
                  </h2>
                  <p className="font-label-mono text-[11px] text-[#4B6155] mt-1">
                    {selectedProduct.brand} · Barkod: {selectedProduct.barcode} · {selectedProduct.marketHint}
                  </p>
                  <p className="text-xs sm:text-sm mt-2 leading-relaxed" style={{ color: verdict.text }}>
                    {verdict.summary}
                  </p>
                </div>
              </div>

              <div className="flex flex-col items-end gap-2">
                <div
                  className="px-4 py-2 bg-[#FFFEFA] border text-center"
                  style={{ borderColor: verdict.border }}
                >
                  <div className="font-label-mono text-[10px] text-[#4B6155]">TEMİZLİK PUANI</div>
                  <div className="font-label-mono text-2xl font-bold" style={{ color: verdict.border }}>
                    {breakdown.score}
                    <span className="text-xs font-normal text-[#4B6155]">/100</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => downloadScoreCardPng(selectedProduct, breakdown)}
                  className="inline-flex items-center gap-1.5 border border-[#112A1E]/25 bg-[#FFFEFA] px-3 py-1.5 text-[11px] font-bold hover:border-[#112A1E] cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" /> Rapor PNG İndir
                </button>
              </div>
            </section>

            {/* 2. Reasons: Why Clean or Why Not Clean? */}
            <section className="border border-[#112A1E]/20 bg-[#FFFEFA] p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#112A1E]/10 pb-3">
                <h3 className="font-serif-editorial text-xl">Neden Bu Puanı Aldı? (Sebepleriyle)</h3>
                <button
                  type="button"
                  onClick={() => setShowRawLabel((v) => !v)}
                  className="text-xs font-semibold underline text-[#4B6155] hover:text-[#112A1E] cursor-pointer"
                >
                  {showRawLabel ? 'Etiket Metnini Gizle' : 'Ham İçindekiler Metnini Gör'}
                </button>
              </div>

              {breakdown.dietAlerts.length > 0 && (
                <div className="border border-[#C83E37]/40 bg-[#FCECEA] p-3 space-y-1">
                  <div className="text-xs font-bold text-[#7D201B]">Kişisel Hassasiyet Uyarın</div>
                  {breakdown.dietAlerts.map((a, idx) => (
                    <div key={idx} className="text-xs text-[#7D201B]">• {a}</div>
                  ))}
                </div>
              )}

              {breakdown.findings.length > 0 && (
                <div className="space-y-2">
                  <div className="font-label-mono text-[11px] font-bold text-[#C83E37] uppercase">
                    Tespit Edilen Katkı Maddeleri &amp; Riskler ({breakdown.findings.length})
                  </div>
                  <div className="grid sm:grid-cols-2 gap-2.5">
                    {breakdown.findings.map((f, i) => (
                      <div key={i} className="border border-[#112A1E]/15 bg-[#F6F4EC] p-3 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold">{f.code} · {f.name}</span>
                          <span
                            className={`text-[10px] font-label-mono px-1.5 py-0.5 font-bold ${
                              f.risk === 'yuksek'
                                ? 'bg-[#FCECEA] text-[#C83E37]'
                                : 'bg-[#FEF4E4] text-[#D97706]'
                            }`}
                          >
                            {f.risk === 'yuksek' ? 'Yüksek Risk' : f.risk === 'orta' ? 'Orta Risk' : 'Düşük Risk'}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#4B6155] leading-relaxed">{f.reason}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid sm:grid-cols-2 gap-3">
                {breakdown.negatives.length > 0 && (
                  <div className="border border-[#D97706]/30 bg-[#FEF4E4]/60 p-3 space-y-1.5">
                    <div className="text-xs font-bold text-[#7C4106]">Besin / İçerik Uyarıları</div>
                    {breakdown.negatives.map((n, i) => (
                      <div key={i} className="text-xs text-[#7C4106]">• {n}</div>
                    ))}
                  </div>
                )}

                {breakdown.positives.length > 0 && (
                  <div className="border border-[#1B7F4B]/30 bg-[#E7F5ED]/60 p-3 space-y-1.5">
                    <div className="text-xs font-bold text-[#114A2B] flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Olumlu Yönler
                    </div>
                    {breakdown.positives.map((pos, i) => (
                      <div key={i} className="text-xs text-[#114A2B]">• {pos}</div>
                    ))}
                  </div>
                )}
              </div>

              {showRawLabel && (
                <div className="border border-[#112A1E]/15 bg-[#F6F4EC] p-3 text-xs text-[#4B6155] leading-relaxed">
                  <strong>İçindekiler:</strong> {selectedProduct.ingredientsText}
                </div>
              )}
            </section>

            {/* 3. Clean Alternatives + AdSense Monetization Slot */}
            <section className="border border-[#0F7A47]/25 bg-white p-5 space-y-4 shadow-sm">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#0F7A47]" />
                <h3 className="font-serif-editorial text-xl text-[#0B4D2D]">Daha Temiz Alternatif Önerileri</h3>
              </div>

              <div className="grid sm:grid-cols-3 gap-3">
                {alternatives.map(({ product: alt, breakdown: altScore }) => (
                  <button
                    key={alt.barcode}
                    type="button"
                    onClick={() => void handleBarcodeLookup(alt.barcode)}
                    className="text-left border border-[#0F7A47]/25 bg-[#EDF6F0] p-3.5 hover:border-[#0F7A47] hover:bg-[#E2F3E9] transition-colors space-y-2 cursor-pointer"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-label-mono text-[10px] px-2 py-0.5 bg-[#0F7A47] text-white font-bold">
                        TEMİZ · {altScore.score}/100
                      </span>
                      <span className="font-label-mono text-[10px] text-[#3B5E4C]">{alt.brand}</span>
                    </div>
                    <div className="text-xs font-bold leading-snug text-[#0D2E1E]">{alt.name}</div>
                    <div className="text-[11px] text-[#3B5E4C]">
                      {altScore.positives[0] || alt.marketHint}
                    </div>
                  </button>
                ))}
              </div>

              <AdSenseBanner categoryHint={selectedProduct.category} />
            </section>
          </div>
        )}

        {/* AdSense also visible below scanner when idle */}
        {!selectedProduct && <AdSenseBanner categoryHint="Gıda ve Kozmetik" />}

        {/* Recent Scanned Barcodes */}
        {history.length > 0 && (
          <section className="border border-[#112A1E]/15 bg-[#FFFEFA] p-4 space-y-2.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#4B6155]">
              <History className="w-3.5 h-3.5" /> Son Okutulan Barkodlar
            </div>
            <div className="flex flex-wrap gap-2">
              {history.map((h) => (
                <button
                  key={h.barcode}
                  type="button"
                  onClick={() => void handleBarcodeLookup(h.barcode)}
                  className="px-3 py-1.5 border border-[#112A1E]/20 bg-[#F6F4EC] text-xs font-semibold hover:border-[#112A1E] cursor-pointer"
                >
                  {h.name} <span className="font-label-mono text-[10px] text-[#4B6155]">({h.barcode})</span>
                </button>
              ))}
            </div>
          </section>
        )}
      </main>

      <BarcodeScannerModal
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onDetected={(code) => {
          setScannerOpen(false);
          void handleBarcodeLookup(code);
        }}
      />

      {kvkkOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="max-w-md w-full border border-[#112A1E] bg-[#FFFEFA] p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-serif-editorial text-xl">KVKK &amp; Şeffaflık</h3>
              <button type="button" onClick={() => setKvkkOpen(false)} className="p-1 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-[#4B6155] leading-relaxed">
              Barkod geçmişiniz ve hassasiyet tercihleriniz yalnızca kendi cihazınızda saklanır. Kamera görüntüsü hiçbir
              sunucuya yüklenmez.
            </p>
            <button
              type="button"
              onClick={() => {
                localStorage.removeItem(HISTORY_KEY);
                setHistory([]);
                setKvkkOpen(false);
              }}
              className="w-full py-2 border border-[#C83E37] text-xs font-bold text-[#C83E37] hover:bg-[#FCECEA] cursor-pointer"
            >
              Tarama Geçmişini Temizle
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
