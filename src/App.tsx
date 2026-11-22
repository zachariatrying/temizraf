import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  Camera,
  Search,
  ShieldCheck,
  AlertTriangle,
  Sparkles,
  FileText,
  Download,
  History,
  CheckCircle2,
  ArrowLeftRight,
  Trash2,
  X,
  Globe2,
} from 'lucide-react';
import type { DietFilter, ProductDomain, ProductRecord } from './types';
import { TURKISH_PRODUCTS } from './data/turkishProducts';
import {
  analyzeProduct,
  downloadScoreCardPng,
  findCleanAlternatives,
  lookupBarcodeLive,
  searchProductsLive,
} from './utils/analyzer';
import { BarcodeScannerModal } from './components/BarcodeScannerModal';

const HISTORY_KEY = 'temizraf_history_v1';

const DIET_OPTIONS: Array<{ id: DietFilter; label: string }> = [
  { id: 'glutensiz', label: 'Glütensiz' },
  { id: 'palmiyesiz', label: 'Palmiye Yağsız' },
  { id: 'sekersiz', label: 'Şekersiz' },
  { id: 'laktozsuz', label: 'Laktozsuz' },
];

export default function App() {
  const [selectedProduct, setSelectedProduct] = useState<ProductRecord>(TURKISH_PRODUCTS[0]);
  const [compareProduct, setCompareProduct] = useState<ProductRecord | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchDomain, setSearchDomain] = useState<ProductDomain>('Gıda');
  const [liveResults, setLiveResults] = useState<ProductRecord[]>([]);
  const [loadingLive, setLoadingLive] = useState(false);
  const [liveError, setLiveError] = useState<string | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [kvkkOpen, setKvkkOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [activeFilters, setActiveFilters] = useState<DietFilter[]>(['palmiyesiz']);
  const [mode, setMode] = useState<'raf' | 'etiket'>('raf');
  const [customName, setCustomName] = useState('');
  const [customDomain, setCustomDomain] = useState<ProductDomain>('Gıda');
  const [customLabel, setCustomLabel] = useState(
    'Şeker, palm yağı, buğday unu, glikoz-fruktoz şurubu, aroma artırıcı (E621), emülgatör (E471), yapay aroma verici.'
  );
  const [catalogDomainFilter, setCatalogDomainFilter] = useState<'Tümü' | ProductDomain>('Tümü');
  const [history, setHistory] = useState<ProductRecord[]>(() => {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      return raw ? (JSON.parse(raw) as ProductRecord[]) : [TURKISH_PRODUCTS[0], TURKISH_PRODUCTS[3]];
    } catch {
      return [TURKISH_PRODUCTS[0]];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 12)));
    } catch {
      // Ignore storage errors
    }
  }, [history]);

  const breakdown = useMemo(
    () => analyzeProduct(selectedProduct, activeFilters),
    [selectedProduct, activeFilters]
  );

  const compareBreakdown = useMemo(
    () => (compareProduct ? analyzeProduct(compareProduct, activeFilters) : null),
    [compareProduct, activeFilters]
  );

  const alternatives = useMemo(
    () => findCleanAlternatives(selectedProduct, activeFilters),
    [selectedProduct, activeFilters]
  );

  const filteredCatalog = useMemo(() => {
    if (catalogDomainFilter === 'Tümü') return TURKISH_PRODUCTS;
    return TURKISH_PRODUCTS.filter((p) => p.domain === catalogDomainFilter);
  }, [catalogDomainFilter]);

  const pushHistory = (prod: ProductRecord) => {
    setSelectedProduct(prod);
    setHistory((prev) => [prod, ...prev.filter((p) => p.barcode !== prod.barcode)].slice(0, 12));
  };

  const handleBarcodeSearch = async (rawCode: string) => {
    const trimmed = rawCode.trim();
    if (!trimmed) return;
    setLiveError(null);
    setLiveResults([]);

    // 1. Check local curated Turkish market catalog first
    const byName = TURKISH_PRODUCTS.find(
      (p) =>
        p.name.toLocaleLowerCase('tr-TR').includes(trimmed.toLocaleLowerCase('tr-TR')) ||
        p.barcode === trimmed
    );
    if (byName) {
      pushHistory(byName);
      return;
    }

    // 2. Barcode lookup via Open Food Facts v2
    if (/^\d{8,14}$/.test(trimmed)) {
      setLoadingLive(true);
      const liveProduct = await lookupBarcodeLive(trimmed);
      setLoadingLive(false);
      if (liveProduct) {
        pushHistory(liveProduct);
      } else {
        setLiveError(
          `Barkod (${trimmed}) Open Food Facts’te bulunamadı. "İçindekiler Etiketi Analizörü" sekmesinden içindekileri yapıştırarak anında puanlayabilirsin.`
        );
      }
      return;
    }

    // 3. Live product name search on Open Food Facts TR / Open Beauty Facts
    setLoadingLive(true);
    const matches = await searchProductsLive(trimmed, searchDomain);
    setLoadingLive(false);
    if (matches.length > 0) {
      setLiveResults(matches);
      pushHistory(matches[0]);
    } else {
      setLiveError(
        `"${trimmed}" için canlı ${searchDomain} sonucu bulunamadı. Farklı bir ürün adı, 13 haneli barkod veya Etiket Analizörü’nü deneyebilirsin.`
      );
    }
  };

  const handleSearchSubmit = (e: FormEvent) => {
    e.preventDefault();
    void handleBarcodeSearch(searchQuery);
  };

  const handleAnalyzeCustomLabel = (e: FormEvent) => {
    e.preventDefault();
    if (!customLabel.trim()) return;
    const record: ProductRecord = {
      barcode: `ETIKET-${Date.now().toString().slice(-5)}`,
      name: customName.trim() || 'Özel Etiket Analizi',
      brand: 'Kullanıcı Taraması',
      marketHint: 'Arka Etiket Analizi',
      domain: customDomain,
      category: customDomain === 'Gıda' ? 'Özel Gıda' : 'Özel Kozmetik',
      ingredientsText: customLabel.trim(),
      allergens: [],
      source: 'Etiket Analizi',
    };
    pushHistory(record);
  };

  const toggleFilter = (id: DietFilter) => {
    setActiveFilters((prev) => (prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]));
  };

  const handleExportHistoryJson = () => {
    const blob = new Blob([JSON.stringify(history, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `temizraf-tarama-gecmisi-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePurgeHistory = () => {
    localStorage.removeItem(HISTORY_KEY);
    setHistory([TURKISH_PRODUCTS[0]]);
    setSelectedProduct(TURKISH_PRODUCTS[0]);
    setCompareProduct(null);
    setConfirmDelete(false);
    setKvkkOpen(false);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F5F7F6]">
      {/* Header — Clinical Botanical Trust Operate Mode */}
      <header className="sticky top-0 z-30 border-b border-[#0A462A] bg-[#0E5A36] text-white">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 h-15 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <img src="/favicon.svg" alt="" className="w-7 h-7 rounded-lg" />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-extrabold tracking-tight">TemizRaf</h1>
                <span className="hidden sm:inline-block rounded bg-white/15 px-2 py-0.5 text-[10px] font-bold text-[#D1FAE5] tabular-nums">
                  {TURKISH_PRODUCTS.length}+ TR Raf & Canlı OFF
                </span>
              </div>
              <p className="hidden md:block text-[11px] text-[#D1FAE5]/90">
                Reklamsız Türkçe gıda & kozmetik barkod ve içindekiler laboratuvarı
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setKvkkOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white/12 hover:bg-white/20 px-3 py-2 text-xs font-bold text-white transition-colors cursor-pointer"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">KVKK & Yedek</span>
            </button>
            <button
              type="button"
              onClick={() => setScannerOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3.5 py-2 text-xs font-extrabold text-[#0E5A36] hover:bg-[#E7F5ED] transition-colors cursor-pointer"
            >
              <Camera className="w-4 h-4" />
              Kamera ile Tara
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-6xl px-4 sm:px-6 py-5">
        {/* Search / Label Input Bar + Diet Preferences */}
        <section className="rounded-xl border border-[#E2E8E5] bg-white p-4 sm:p-5 mb-5">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="inline-flex rounded-lg bg-[#EFF3F1] p-1 border border-[#E2E8E5]">
              <button
                type="button"
                onClick={() => setMode('raf')}
                className={`inline-flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-xs font-bold cursor-pointer ${
                  mode === 'raf' ? 'bg-white text-[#0E5A36] shadow-2xs' : 'text-[#52635A]'
                }`}
              >
                <Search className="w-3.5 h-3.5" />
                Barkod & Canlı Ürün Ara
              </button>
              <button
                type="button"
                onClick={() => setMode('etiket')}
                className={`inline-flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-xs font-bold cursor-pointer ${
                  mode === 'etiket' ? 'bg-white text-[#0E5A36] shadow-2xs' : 'text-[#52635A]'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                İçindekiler Etiketi Analizörü
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-bold text-[#52635A] mr-1">Kişisel Filtre:</span>
              {DIET_OPTIONS.map((opt) => {
                const active = activeFilters.includes(opt.id);
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => toggleFilter(opt.id)}
                    className={`rounded-md border px-2.5 py-1 text-[11px] font-bold transition-colors cursor-pointer ${
                      active
                        ? 'border-[#0E5A36] bg-[#E7F5ED] text-[#0E5A36]'
                        : 'border-[#E2E8E5] bg-[#F8FAF9] text-[#52635A] hover:border-[#0E5A36]'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {mode === 'raf' ? (
            <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-2">
              <select
                value={searchDomain}
                onChange={(e) => setSearchDomain(e.target.value as ProductDomain)}
                aria-label="Arama kategorisi"
                className="rounded-lg border border-[#D4DDD8] bg-[#F8FAF9] px-3 py-2 text-xs font-bold text-[#0F1F17]"
              >
                <option value="Gıda">Gıda (TR)</option>
                <option value="Kozmetik">Kozmetik (INCI)</option>
              </select>
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-[#52635A] absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="EAN-13 barkod (ör. 3017620422003) veya ürün adı yaz (eti, üker, şampuan, krem)..."
                  className="w-full rounded-lg border border-[#D4DDD8] bg-[#F8FAF9] pl-9 pr-3 py-2 text-xs sm:text-sm text-[#0F1F17] focus:border-[#0E5A36] focus:bg-white focus:outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={loadingLive}
                className="rounded-lg bg-[#0E5A36] px-5 py-2 text-xs sm:text-sm font-bold text-white hover:bg-[#0A462A] transition-colors cursor-pointer disabled:opacity-60"
              >
                {loadingLive ? 'Aranıyor...' : 'Analiz Et'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleAnalyzeCustomLabel} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <input
                  type="text"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="Ürün adı (örn. X Marka Bisküvi)"
                  className="sm:col-span-2 rounded-lg border border-[#D4DDD8] bg-[#F8FAF9] px-3.5 py-2 text-sm text-[#0F1F17]"
                />
                <select
                  value={customDomain}
                  onChange={(e) => setCustomDomain(e.target.value as ProductDomain)}
                  className="rounded-lg border border-[#D4DDD8] bg-[#F8FAF9] px-3 py-2 text-sm text-[#0F1F17]"
                >
                  <option value="Gıda">Gıda Ürünü</option>
                  <option value="Kozmetik">Kozmetik / Kişisel Bakım</option>
                </select>
              </div>
              <textarea
                rows={3}
                value={customLabel}
                onChange={(e) => setCustomLabel(e.target.value)}
                placeholder="Ürünün arkasındaki içindekiler metnini buraya yapıştır (E-kodları, yağlar, paraben/SLS otomatik taranır)..."
                className="w-full rounded-lg border border-[#D4DDD8] bg-[#F8FAF9] p-3 text-sm text-[#0F1F17] focus:border-[#0E5A36] focus:bg-white focus:outline-none"
              />
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-lg bg-[#0E5A36] px-5 py-2 text-xs sm:text-sm font-bold text-white hover:bg-[#0A462A] cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                Etiketi Puanla (0–100)
              </button>
            </form>
          )}

          {liveResults.length > 0 && (
            <div className="mt-3 pt-3 border-t border-[#E2E8E5]">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#0E5A36] mb-2">
                <Globe2 className="w-3.5 h-3.5" />
                Canlı Open Facts Arama Sonuçları ({liveResults.length})
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {liveResults.map((hit) => {
                  const hitRes = analyzeProduct(hit, activeFilters);
                  return (
                    <button
                      key={hit.barcode}
                      type="button"
                      onClick={() => pushHistory(hit)}
                      className="shrink-0 flex items-center gap-2 rounded-lg border border-[#D4DDD8] bg-[#F8FAF9] px-3 py-1.5 text-left hover:border-[#0E5A36] cursor-pointer"
                    >
                      <div className="max-w-[170px] truncate text-xs font-bold text-[#0F1F17]">
                        {hit.name}
                      </div>
                      <span
                        className="rounded px-1.5 py-0.5 text-[11px] font-extrabold text-white tabular-nums"
                        style={{ backgroundColor: hitRes.color }}
                      >
                        {hitRes.score}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {liveError && (
            <p className="mt-3 rounded-lg bg-[#FEF4E4] border border-[#F0D6A6] px-3.5 py-2 text-xs font-semibold text-[#8A5306]">
              {liveError}
            </p>
          )}
        </section>

        {/* Main 2-Column Audit View */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Left: Detailed Score & Breakdown */}
          <section className="lg:col-span-7 space-y-5">
            <article className="rounded-xl border border-[#E2E8E5] bg-white p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-[#E2E8E5]">
                <div className="flex-1 min-w-[200px]">
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold text-[#52635A] mb-1.5">
                    <span className="rounded bg-[#EFF3F1] px-2 py-0.5 text-[#0E5A36]">
                      {selectedProduct.domain}
                    </span>
                    <span>{selectedProduct.category}</span>
                    <span>·</span>
                    <span>{selectedProduct.source}</span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-extrabold text-[#0F1F17] tracking-tight">
                    {selectedProduct.name}
                  </h2>
                  <p className="text-xs text-[#52635A] mt-1">
                    {selectedProduct.brand} · {selectedProduct.marketHint} · Barkod:{' '}
                    <span className="tabular-nums font-mono">{selectedProduct.barcode}</span>
                  </p>
                </div>

                {/* Big 0-100 Score Pill */}
                <div
                  className="flex flex-col items-center justify-center rounded-xl border-2 px-5 py-2.5 min-w-[110px]"
                  style={{ borderColor: breakdown.color, backgroundColor: breakdown.bgColor }}
                >
                  <span
                    className="text-4xl font-extrabold tabular-nums leading-none"
                    style={{ color: breakdown.color }}
                  >
                    {breakdown.score}
                  </span>
                  <span
                    className="text-[11px] font-extrabold uppercase tracking-wider mt-1"
                    style={{ color: breakdown.color }}
                  >
                    {breakdown.grade}
                  </span>
                </div>
              </div>

              {/* 100g Nutritional Snapshot Bar (when Food nutrients exist) */}
              {selectedProduct.domain === 'Gıda' &&
                (selectedProduct.sugarPer100g !== undefined ||
                  selectedProduct.proteinPer100g !== undefined) && (
                  <div className="mt-4 grid grid-cols-5 gap-1.5 text-center">
                    {[
                      { label: 'Şeker', val: selectedProduct.sugarPer100g, unit: 'g' },
                      { label: 'Doymuş Yağ', val: selectedProduct.satFatPer100g, unit: 'g' },
                      { label: 'Tuz', val: selectedProduct.saltPer100g, unit: 'g' },
                      { label: 'Protein', val: selectedProduct.proteinPer100g, unit: 'g' },
                      { label: 'Lif', val: selectedProduct.fiberPer100g, unit: 'g' },
                    ].map((n) => (
                      <div
                        key={n.label}
                        className="rounded-lg border border-[#E2E8E5] bg-[#F8FAF9] py-2 px-1"
                      >
                        <div className="text-xs sm:text-sm font-extrabold text-[#0F1F17] tabular-nums">
                          {n.val !== undefined ? `${n.val}${n.unit}` : '—'}
                        </div>
                        <div className="text-[10px] font-semibold text-[#52635A]">{n.label}</div>
                      </div>
                    ))}
                  </div>
                )}

              {/* Personal Diet Alerts */}
              {breakdown.dietAlerts.length > 0 && (
                <div className="mt-4 rounded-lg bg-[#FCECEA] border border-[#F2C6C3] p-3.5 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-extrabold text-[#A52922]">
                    <AlertTriangle className="w-4 h-4" />
                    Kişisel Filtre Uyarısı
                  </div>
                  {breakdown.dietAlerts.map((alert) => (
                    <p key={alert} className="text-xs text-[#7D1F19]">
                      • {alert}
                    </p>
                  ))}
                </div>
              )}

              {/* Additives & Risk Findings */}
              <div className="mt-5">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#52635A] mb-2.5">
                  Katkı Maddesi & İçerik Bulguları ({breakdown.findings.length})
                </h3>
                {breakdown.findings.length === 0 ? (
                  <div className="flex items-center gap-2 rounded-lg bg-[#E7F5ED] border border-[#C4E7D2] p-3 text-xs font-bold text-[#0E5A36]">
                    <ShieldCheck className="w-4 h-4 shrink-0" />
                    Etikette yüksek riskli katkı maddesi, glikoz şurubu veya paraben tespit edilmedi.
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {breakdown.findings.map((f) => (
                      <li
                        key={f.code}
                        className="rounded-lg border border-[#E2E8E5] bg-[#F8FAF9] p-3"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs sm:text-sm font-bold text-[#0F1F17]">
                            {f.name}{' '}
                            <span className="text-xs font-mono text-[#52635A]">({f.code})</span>
                          </span>
                          <span
                            className={`rounded px-2 py-0.5 text-[10px] font-extrabold ${
                              f.risk === 'yuksek'
                                ? 'bg-[#FCECEA] text-[#C83E37]'
                                : f.risk === 'orta'
                                  ? 'bg-[#FEF4E4] text-[#B45309]'
                                  : 'bg-[#EFF3F1] text-[#52635A]'
                            }`}
                          >
                            {f.risk === 'yuksek' ? 'Yüksek Risk' : f.risk === 'orta' ? 'Orta Risk' : 'Düşük'}
                          </span>
                        </div>
                        <p className="text-xs text-[#52635A] mt-1">{f.reason}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Positives & Negatives */}
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-lg bg-[#F4FAF6] border border-[#DCEEE3] p-3.5">
                  <div className="text-xs font-extrabold text-[#0E5A36] mb-1.5">Olumlu Yönler</div>
                  <ul className="space-y-1 text-xs text-[#0F1F17]">
                    {breakdown.positives.length > 0 ? (
                      breakdown.positives.map((p) => (
                        <li key={p} className="flex items-start gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#0E5A36] shrink-0 mt-0.5" />
                          <span>{p}</span>
                        </li>
                      ))
                    ) : (
                      <li className="text-[#52635A]">Öne çıkan besinsel artı bulunmadı.</li>
                    )}
                  </ul>
                </div>

                <div className="rounded-lg bg-[#FFF8F6] border border-[#F3DDD9] p-3.5">
                  <div className="text-xs font-extrabold text-[#C83E37] mb-1.5">Dikkat Noktaları</div>
                  <ul className="space-y-1 text-xs text-[#0F1F17]">
                    {breakdown.negatives.length > 0 ? (
                      breakdown.negatives.map((n) => <li key={n}>• {n}</li>)
                    ) : (
                      <li className="text-[#52635A]">Şeker, tuz ve doymuş yağ sınırlar içinde.</li>
                    )}
                  </ul>
                </div>
              </div>

              {/* Raw Ingredients & Action Buttons */}
              <div className="mt-5 pt-4 border-t border-[#E2E8E5] space-y-3">
                <p className="text-xs text-[#52635A] leading-relaxed">
                  <strong className="text-[#0F1F17]">İçindekiler:</strong> {selectedProduct.ingredientsText}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => downloadScoreCardPng(selectedProduct, breakdown)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#0E5A36] px-3.5 py-2 text-xs font-bold text-white hover:bg-[#0A462A] cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Skor Kartı (PNG)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const altFirst = alternatives[0]?.product ?? TURKISH_PRODUCTS.find((p) => p.barcode !== selectedProduct.barcode) ?? null;
                      setCompareProduct(altFirst);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[#0E5A36] bg-white px-3.5 py-2 text-xs font-bold text-[#0E5A36] hover:bg-[#E7F5ED] cursor-pointer"
                  >
                    <ArrowLeftRight className="w-3.5 h-3.5" />
                    Alternatifle Karşılaştır
                  </button>
                </div>
              </div>
            </article>

            {/* Clean Local Alternatives */}
            {alternatives.length > 0 && breakdown.score < 75 && (
              <section className="rounded-xl border border-[#C6E5D3] bg-[#F2FAF5] p-5">
                <h3 className="text-sm font-extrabold text-[#0E5A36] mb-3">
                  Aynı Raftan Daha Temiz Yerel Alternatifler
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {alternatives.map(({ product, breakdown: alt }) => (
                    <div
                      key={product.barcode}
                      className="rounded-lg border border-[#CFE7D9] bg-white p-3.5 flex items-center justify-between gap-2"
                    >
                      <button
                        type="button"
                        onClick={() => pushHistory(product)}
                        className="text-left min-w-0 flex-1 cursor-pointer"
                      >
                        <div className="text-xs sm:text-sm font-bold text-[#0F1F17] truncate">
                          {product.name}
                        </div>
                        <div className="text-[11px] text-[#52635A] truncate">
                          {product.brand} · {product.marketHint}
                        </div>
                      </button>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => setCompareProduct(product)}
                          title="Yan yana karşılaştır"
                          className="rounded border border-[#D4DDD8] p-1.5 text-[#0E5A36] hover:bg-[#E7F5ED] cursor-pointer"
                        >
                          <ArrowLeftRight className="w-3.5 h-3.5" />
                        </button>
                        <span
                          className="rounded-lg px-2.5 py-1 text-xs font-extrabold tabular-nums text-white"
                          style={{ backgroundColor: alt.color }}
                        >
                          {alt.score}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </section>

          {/* Right: Ready Turkish Shelf Catalog + Scan History */}
          <aside className="lg:col-span-5 space-y-5">
            <section className="rounded-xl border border-[#E2E8E5] bg-white p-5">
              <div className="flex items-center justify-between gap-2 mb-3">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#52635A]">
                  Türkiye Market Rafları ({filteredCatalog.length})
                </h3>
                <div className="flex gap-1">
                  {(['Tümü', 'Gıda', 'Kozmetik'] as const).map((dom) => (
                    <button
                      key={dom}
                      type="button"
                      onClick={() => setCatalogDomainFilter(dom)}
                      className={`rounded px-2 py-0.5 text-[11px] font-bold cursor-pointer ${
                        catalogDomainFilter === dom
                          ? 'bg-[#0E5A36] text-white'
                          : 'bg-[#F5F7F6] text-[#52635A]'
                      }`}
                    >
                      {dom}
                    </button>
                  ))}
                </div>
              </div>
              <ul className="space-y-1.5 max-h-[390px] overflow-y-auto pr-1">
                {filteredCatalog.map((prod) => {
                  const res = analyzeProduct(prod, activeFilters);
                  const active = selectedProduct.barcode === prod.barcode;
                  return (
                    <li key={prod.barcode} className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => pushHistory(prod)}
                        className={`flex-1 flex items-center justify-between gap-3 rounded-lg border p-2.5 text-left transition-colors cursor-pointer min-w-0 ${
                          active
                            ? 'border-[#0E5A36] bg-[#E7F5ED]/60'
                            : 'border-[#E2E8E5] bg-[#F8FAF9] hover:border-[#0E5A36]/50'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="text-xs sm:text-sm font-bold text-[#0F1F17] truncate">
                            {prod.name}
                          </div>
                          <div className="text-[11px] text-[#52635A] truncate">
                            {prod.category} · {prod.marketHint}
                          </div>
                        </div>
                        <span
                          className="shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-xs font-extrabold tabular-nums text-white"
                          style={{ backgroundColor: res.color }}
                        >
                          {res.score}
                        </span>
                      </button>
                      {prod.barcode !== selectedProduct.barcode && (
                        <button
                          type="button"
                          onClick={() => setCompareProduct(prod)}
                          title="Seçili ürünle karşılaştır"
                          className="shrink-0 rounded-lg border border-[#E2E8E5] bg-white p-2.5 text-[#52635A] hover:text-[#0E5A36] hover:border-[#0E5A36] cursor-pointer"
                        >
                          <ArrowLeftRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>

            <section className="rounded-xl border border-[#E2E8E5] bg-white p-5">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#52635A] flex items-center gap-1.5 mb-2.5">
                <History className="w-3.5 h-3.5" />
                Son Taramaların ({history.length})
              </h3>
              <ul className="space-y-1.5">
                {history.slice(0, 6).map((item) => {
                  const res = analyzeProduct(item, activeFilters);
                  return (
                    <li key={item.barcode}>
                      <button
                        type="button"
                        onClick={() => setSelectedProduct(item)}
                        className="w-full flex items-center justify-between text-xs rounded-lg bg-[#F8FAF9] border border-[#E2E8E5] px-3 py-2 hover:border-[#0E5A36] cursor-pointer"
                      >
                        <span className="font-semibold text-[#0F1F17] truncate pr-2">{item.name}</span>
                        <span className="font-extrabold tabular-nums" style={{ color: res.color }}>
                          {res.score}/100
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          </aside>
        </div>
      </main>

      <footer className="border-t border-[#E2E8E5] bg-white py-3.5 text-center text-xs text-[#52635A] px-4">
        TemizRaf tamamen reklamsız bilgilendirme amaçlı etiket analizi sunar; tıbbi teşhis veya diyetisyen tavsiyesi değildir.
      </footer>

      <BarcodeScannerModal
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onDetected={(code) => {
          setSearchQuery(code);
          void handleBarcodeSearch(code);
        }}
      />

      {/* Side-by-Side Comparison Modal (Yan Yana Ürün Karşılaştırma) */}
      {compareProduct && compareBreakdown && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-[2px] p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Yan Yana Ürün Karşılaştırması"
        >
          <div className="w-full max-w-2xl max-h-[88vh] overflow-y-auto rounded-xl border border-[#E2E8E5] bg-white shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8E5]">
              <div className="flex items-center gap-2">
                <ArrowLeftRight className="w-4 h-4 text-[#0E5A36]" />
                <h2 className="text-base font-extrabold text-[#0F1F17]">
                  Yan Yana Laboratuvar Karşılaştırması
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setCompareProduct(null)}
                aria-label="Kapat"
                className="rounded-lg p-1.5 text-[#52635A] hover:bg-[#F5F7F6] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { p: selectedProduct, b: breakdown, badge: 'İncelenen Ürün' },
                { p: compareProduct, b: compareBreakdown, badge: 'Karşılaştırılan Ürün' },
              ].map(({ p, b, badge }) => (
                <div
                  key={p.barcode}
                  className="rounded-xl border border-[#E2E8E5] bg-[#F8FAF9] p-4 space-y-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#0E5A36]">
                      {badge}
                    </span>
                    <span
                      className="rounded-lg px-2.5 py-1 text-sm font-extrabold text-white tabular-nums"
                      style={{ backgroundColor: b.color }}
                    >
                      {b.score}/100 ({b.grade})
                    </span>
                  </div>
                  <div>
                    <div className="text-sm font-extrabold text-[#0F1F17]">{p.name}</div>
                    <div className="text-xs text-[#52635A]">
                      {p.brand} · {p.category}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 text-center text-[11px]">
                    <div className="rounded bg-white border border-[#E2E8E5] p-1.5">
                      <div className="font-extrabold text-[#0F1F17] tabular-nums">
                        {p.sugarPer100g ?? '—'}g
                      </div>
                      <div className="text-[#52635A]">Şeker</div>
                    </div>
                    <div className="rounded bg-white border border-[#E2E8E5] p-1.5">
                      <div className="font-extrabold text-[#0F1F17] tabular-nums">
                        {p.proteinPer100g ?? '—'}g
                      </div>
                      <div className="text-[#52635A]">Protein</div>
                    </div>
                    <div className="rounded bg-white border border-[#E2E8E5] p-1.5">
                      <div className="font-extrabold text-[#C83E37] tabular-nums">
                        {b.findings.length}
                      </div>
                      <div className="text-[#52635A]">Katkı</div>
                    </div>
                  </div>
                  <div className="text-xs space-y-1">
                    {b.findings.length === 0 ? (
                      <div className="font-bold text-[#0E5A36]">✓ Riskli katkı tespit edilmedi</div>
                    ) : (
                      b.findings.map((f) => (
                        <div key={f.code} className="text-[#C83E37] font-semibold">
                          • [{f.code}] {f.name}
                        </div>
                      ))
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      pushHistory(p);
                      setCompareProduct(null);
                    }}
                    className="w-full rounded-lg border border-[#0E5A36] bg-white py-1.5 text-xs font-bold text-[#0E5A36] hover:bg-[#E7F5ED] cursor-pointer"
                  >
                    Bu Ürünü Seç
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* KVKK & Local Data Control Modal (Apple 5.1.1(v)) */}
      {kvkkOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-[2px] p-4"
          role="dialog"
          aria-modal="true"
          aria-label="KVKK ve Veri Kontrolü"
        >
          <div className="w-full max-w-md rounded-xl border border-[#E2E8E5] bg-white shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8E5]">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#0E5A36]" />
                <h2 className="text-base font-extrabold text-[#0F1F17]">KVKK & Tarama Geçmişi</h2>
              </div>
              <button
                type="button"
                onClick={() => setKvkkOpen(false)}
                aria-label="Kapat"
                className="rounded-lg p-1.5 text-[#52635A] hover:bg-[#F5F7F6] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4 text-xs text-[#52635A]">
              <p className="leading-relaxed">
                TemizRaf tarama geçmişin yalnızca cihazında tutulur; kişisel verilerin üçüncü parti reklam
                ağlarıyla paylaşılmaz.
              </p>
              <button
                type="button"
                onClick={handleExportHistoryJson}
                className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#0E5A36] py-2.5 font-bold text-white hover:bg-[#0A462A] cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                Tarama Geçmişini JSON İndir
              </button>
              <div className="rounded-lg border border-[#FECACA] bg-[#FEF2F2] p-3.5 space-y-2">
                <div className="font-bold text-[#991B1B]">Tüm Tarama Geçmişini Sil</div>
                {!confirmDelete ? (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#DC2626] px-3 py-1.5 font-bold text-white cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Geçmişi Kalıcı Temizle
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handlePurgeHistory}
                      className="rounded-lg bg-[#DC2626] px-3 py-1.5 font-bold text-white cursor-pointer"
                    >
                      Evet, Sil
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      className="rounded-lg border border-[#D4DDD8] bg-white px-3 py-1.5 font-bold text-[#0F1F17] cursor-pointer"
                    >
                      Vazgeç
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
