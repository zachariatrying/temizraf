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
  Plus,
  Store,
  X,
} from 'lucide-react';
import type { DietFilter, ProductDomain, ProductRecord } from './types';
import { TURKISH_PRODUCTS } from './data/turkishProducts';
import {
  analyzeProduct,
  downloadScoreCardPng,
  fetchOpenPriceTry,
  findCleanAlternatives,
  lookupBarcodeLive,
  searchProductsLive,
  type OpenPriceResult,
} from './utils/analyzer';
import { BarcodeScannerModal } from './components/BarcodeScannerModal';

const HISTORY_KEY = 'temizraf_history_v1';
const CUSTOM_PRODUCTS_KEY = 'temizraf_custom_products_v1';
const CUSTOM_MARKETS_KEY = 'temizraf_custom_markets_v1';

const BASE_MARKETS = [
  'BİM',
  'A101',
  'ŞOK',
  'Migros',
  'CarrefourSA',
  'File',
  'Tarım Kredi',
  'Gratis',
  'Watsons',
  'Rossmann',
];

const DIET_OPTIONS: Array<{ id: DietFilter; label: string }> = [
  { id: 'glutensiz', label: 'Glütensiz' },
  { id: 'palmiyesiz', label: 'Palmiye Yağsız' },
  { id: 'sekersiz', label: 'Şekersiz' },
  { id: 'laktozsuz', label: 'Laktozsuz' },
];

export default function App() {
  const [customMarkets, setCustomMarkets] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(CUSTOM_MARKETS_KEY);
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      return [];
    }
  });
  const [customProducts, setCustomProducts] = useState<ProductRecord[]>(() => {
    try {
      const raw = localStorage.getItem(CUSTOM_PRODUCTS_KEY);
      return raw ? (JSON.parse(raw) as ProductRecord[]) : [];
    } catch {
      return [];
    }
  });

  const allProducts = useMemo(() => [...customProducts, ...TURKISH_PRODUCTS], [customProducts]);
  const allMarkets = useMemo(() => [...BASE_MARKETS, ...customMarkets], [customMarkets]);
  const allBrands = useMemo(
    () => [...new Set(allProducts.map((p) => p.brand))].sort((a, b) => a.localeCompare(b, 'tr-TR')),
    [allProducts]
  );

  const [selectedProduct, setSelectedProduct] = useState<ProductRecord>(TURKISH_PRODUCTS[0]);
  const [compareProduct, setCompareProduct] = useState<ProductRecord | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchDomain, setSearchDomain] = useState<ProductDomain>('Gıda');
  const [liveResults, setLiveResults] = useState<ProductRecord[]>([]);
  const [loadingLive, setLoadingLive] = useState(false);
  const [liveError, setLiveError] = useState<string | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [kvkkOpen, setKvkkOpen] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [activeFilters, setActiveFilters] = useState<DietFilter[]>(['palmiyesiz']);
  const [mode, setMode] = useState<'raf' | 'etiket'>('raf');

  const [customName, setCustomName] = useState('');
  const [customDomain, setCustomDomain] = useState<ProductDomain>('Gıda');
  const [customLabel, setCustomLabel] = useState(
    'Şeker, palm yağı, buğday unu, glikoz-fruktoz şurubu, aroma artırıcı (E621), emülgatör (E471), yapay aroma verici.'
  );

  const [catalogDomainFilter, setCatalogDomainFilter] = useState<'Tümü' | ProductDomain>('Tümü');
  const [selectedMarket, setSelectedMarket] = useState<string>('Tümü');
  const [selectedBrand, setSelectedBrand] = useState<string>('Tümü');

  // Add Market / Product Modal State
  const [newMarketName, setNewMarketName] = useState('');
  const [newProdName, setNewProdName] = useState('');
  const [newProdBrand, setNewProdBrand] = useState('');
  const [newProdMarket, setNewProdMarket] = useState('Migros');
  const [newProdBarcode, setNewProdBarcode] = useState('');
  const [newProdDomain, setNewProdDomain] = useState<ProductDomain>('Gıda');
  const [newProdIngredients, setNewProdIngredients] = useState('');

  const [livePrice, setLivePrice] = useState<OpenPriceResult | null>(null);
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
    } catch {}
  }, [history]);

  useEffect(() => {
    try {
      localStorage.setItem(CUSTOM_MARKETS_KEY, JSON.stringify(customMarkets));
    } catch {}
  }, [customMarkets]);

  useEffect(() => {
    try {
      localStorage.setItem(CUSTOM_PRODUCTS_KEY, JSON.stringify(customProducts));
    } catch {}
  }, [customProducts]);

  useEffect(() => {
    let alive = true;
    setLivePrice(null);
    void fetchOpenPriceTry(selectedProduct.barcode).then((res) => {
      if (alive) setLivePrice(res);
    });
    return () => {
      alive = false;
    };
  }, [selectedProduct.barcode]);

  const breakdown = useMemo(() => analyzeProduct(selectedProduct, activeFilters), [selectedProduct, activeFilters]);
  const compareBreakdown = useMemo(() => (compareProduct ? analyzeProduct(compareProduct, activeFilters) : null), [compareProduct, activeFilters]);
  const alternatives = useMemo(() => findCleanAlternatives(selectedProduct, activeFilters), [selectedProduct, activeFilters]);

  const filteredCatalog = useMemo(() => {
    return allProducts.filter((p) => {
      if (catalogDomainFilter !== 'Tümü' && p.domain !== catalogDomainFilter) return false;
      if (selectedMarket !== 'Tümü' && !p.marketHint.toLocaleLowerCase('tr-TR').includes(selectedMarket.toLocaleLowerCase('tr-TR'))) {
        return false;
      }
      if (selectedBrand !== 'Tümü' && p.brand !== selectedBrand) return false;
      return true;
    });
  }, [allProducts, catalogDomainFilter, selectedMarket, selectedBrand]);

  const pushHistory = (prod: ProductRecord) => {
    setSelectedProduct(prod);
    setHistory((prev) => [prod, ...prev.filter((p) => p.barcode !== prod.barcode)].slice(0, 12));
  };

  const handleBarcodeSearch = async (rawCode: string) => {
    const query = rawCode.trim();
    if (!query) return;
    setLiveError(null);
    setLiveResults([]);

    const isNumericBarcode = /^\d{8,14}$/.test(query);
    if (isNumericBarcode) {
      const localMatch = allProducts.find((p) => p.barcode === query);
      if (localMatch) {
        pushHistory(localMatch);
        return;
      }
      setLoadingLive(true);
      try {
        const live = await lookupBarcodeLive(query);
        if (live) pushHistory(live);
        else setLiveError(`"${query}" barkodu bulunamadı.`);
      } finally {
        setLoadingLive(false);
      }
      return;
    }

    const qLower = query.toLowerCase();
    const localHits = allProducts.filter(
      (p) => p.name.toLowerCase().includes(qLower) || p.brand.toLowerCase().includes(qLower)
    );
    if (localHits.length > 0) pushHistory(localHits[0]);

    setLoadingLive(true);
    try {
      const liveHits = await searchProductsLive(query, searchDomain);
      const merged = [...localHits, ...liveHits.filter((l) => !localHits.some((x) => x.barcode === l.barcode))].slice(0, 8);
      if (merged.length > 0) {
        setLiveResults(merged);
        if (localHits.length === 0) pushHistory(merged[0]);
      } else if (localHits.length === 0) {
        setLiveError(`"${query}" için ürün bulunamadı.`);
      }
    } finally {
      setLoadingLive(false);
    }
  };

  const handleSearchSubmit = (e: FormEvent) => {
    e.preventDefault();
    void handleBarcodeSearch(searchQuery);
  };

  const handleAnalyzeCustomLabel = (e: FormEvent) => {
    e.preventDefault();
    if (!customLabel.trim()) return;
    pushHistory({
      barcode: `etiket-${Date.now()}`,
      name: customName.trim() || 'Özel Etiket Analizi',
      brand: 'Kullanıcı Etiketi',
      marketHint: 'Serbest Metin',
      domain: customDomain,
      category: customDomain === 'Gıda' ? 'Özel Gıda' : 'Özel Kozmetik',
      ingredientsText: customLabel.trim(),
      allergens: [],
      source: 'Etiket Analizi',
    });
  };

  const handleAddCustomMarket = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = newMarketName.trim();
    if (!trimmed) return;
    if (!allMarkets.some((m) => m.toLowerCase() === trimmed.toLowerCase())) {
      setCustomMarkets((prev) => [...prev, trimmed]);
    }
    setNewProdMarket(trimmed);
    setSelectedMarket(trimmed);
    setNewMarketName('');
  };

  const handleAddCustomProduct = (e: FormEvent) => {
    e.preventDefault();
    if (!newProdName.trim() || !newProdIngredients.trim()) return;
    const record: ProductRecord = {
      barcode: newProdBarcode.trim() || `869${Date.now().toString().slice(-10)}`,
      name: newProdName.trim(),
      brand: newProdBrand.trim() || 'Yerel Marka',
      marketHint: newProdMarket,
      domain: newProdDomain,
      category: newProdDomain === 'Gıda' ? 'Kullanıcı Gıda' : 'Kullanıcı Kozmetik',
      ingredientsText: newProdIngredients.trim(),
      allergens: [],
      source: 'Türkiye Raf Kataloğu',
    };
    setCustomProducts((prev) => [record, ...prev]);
    pushHistory(record);
    setNewProdName('');
    setNewProdBrand('');
    setNewProdBarcode('');
    setNewProdIngredients('');
    setAddModalOpen(false);
  };

  const toggleFilter = (id: DietFilter) => setActiveFilters((prev) => (prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]));

  const handleExportHistoryJson = () => {
    const blob = new Blob([JSON.stringify({ history, customMarkets, customProducts }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `temizraf-yedek-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePurgeHistory = () => {
    localStorage.removeItem(HISTORY_KEY);
    localStorage.removeItem(CUSTOM_MARKETS_KEY);
    localStorage.removeItem(CUSTOM_PRODUCTS_KEY);
    setHistory([TURKISH_PRODUCTS[0]]);
    setCustomMarkets([]);
    setCustomProducts([]);
    setSelectedProduct(TURKISH_PRODUCTS[0]);
    setCompareProduct(null);
    setConfirmDelete(false);
    setKvkkOpen(false);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F6F4EC] text-[#112A1E]">
      <header className="mx-auto max-w-6xl w-full px-4 sm:px-6 pt-5 pb-4 border-b border-[#112A1E]/20 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <img
            src={`${import.meta.env.BASE_URL}store-assets/temizraf_icon.png`}
            alt="TemizRaf"
            className="w-9 h-9 rounded-md border border-[#112A1E]/25 object-cover"
          />
          <div>
            <h1 className="font-serif-editorial text-2xl sm:text-3xl leading-none">TemizRaf</h1>
            <p className="font-label-mono text-[11px] text-[#4B6155] mt-1">
              {allProducts.length} TR Raf Ürünü · Çift Motorlu Kamera Barkod Okuyucu
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setAddModalOpen(true)}
            className="inline-flex items-center gap-1.5 border border-[#112A1E]/30 bg-[#FFFEFA] px-3 py-2 text-xs font-bold hover:border-[#112A1E] cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-[#0E5A36]" />
            Market / Ürün Ekle
          </button>
          <button
            type="button"
            onClick={() => setKvkkOpen(true)}
            className="inline-flex items-center gap-1.5 border border-[#112A1E]/30 bg-[#FFFEFA] px-3 py-2 text-xs font-semibold hover:border-[#112A1E] cursor-pointer"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-[#0E5A36]" />
            <span className="hidden sm:inline">KVKK</span>
          </button>
          <button
            type="button"
            onClick={() => setScannerOpen(true)}
            className="inline-flex items-center gap-1.5 bg-[#112A1E] px-4 py-2 text-xs font-bold text-[#F6F4EC] hover:bg-[#0E5A36] cursor-pointer"
          >
            <Camera className="w-4 h-4" />
            Barkod Tara
          </button>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-6xl px-4 sm:px-6 py-5 space-y-6">
        <section className="border border-[#112A1E]/20 bg-[#FFFEFA] p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex border border-[#112A1E]/25 bg-[#F6F4EC] p-0.5">
              <button
                type="button"
                onClick={() => setMode('raf')}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold cursor-pointer ${
                  mode === 'raf' ? 'bg-[#112A1E] text-white' : 'text-[#4B6155]'
                }`}
              >
                <Search className="w-3.5 h-3.5" /> Barkod &amp; Ürün Ara
              </button>
              <button
                type="button"
                onClick={() => setMode('etiket')}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold cursor-pointer ${
                  mode === 'etiket' ? 'bg-[#112A1E] text-white' : 'text-[#4B6155]'
                }`}
              >
                <FileText className="w-3.5 h-3.5" /> Etiket Yapıştır
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {DIET_OPTIONS.map((opt) => {
                const active = activeFilters.includes(opt.id);
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => toggleFilter(opt.id)}
                    className={`border px-2.5 py-1 text-[11px] font-bold cursor-pointer ${
                      active ? 'border-[#0E5A36] bg-[#E7F5ED] text-[#0E5A36]' : 'border-[#D8D3C5] bg-white text-[#4B6155]'
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
                className="border border-[#112A1E]/25 bg-[#F6F4EC] px-3 py-2 text-xs font-bold"
              >
                <option value="Gıda">Gıda (TR)</option>
                <option value="Kozmetik">Kozmetik (INCI)</option>
              </select>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="EAN-13 barkod veya ürün/marka adı (eti, dost, züber, cerave)..."
                className="flex-1 border border-[#112A1E]/25 bg-white px-3.5 py-2 text-xs sm:text-sm"
              />
              <button
                type="submit"
                disabled={loadingLive}
                className="bg-[#0E5A36] px-5 py-2 text-xs sm:text-sm font-bold text-white hover:bg-[#112A1E] cursor-pointer"
              >
                {loadingLive ? 'Aranıyor...' : 'Analiz Et'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleAnalyzeCustomLabel} className="space-y-2.5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input
                  type="text"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="Ürün adı"
                  className="sm:col-span-2 border border-[#112A1E]/25 bg-white px-3 py-2 text-sm"
                />
                <select
                  value={customDomain}
                  onChange={(e) => setCustomDomain(e.target.value as ProductDomain)}
                  className="border border-[#112A1E]/25 bg-[#F6F4EC] px-3 py-2 text-sm"
                >
                  <option value="Gıda">Gıda Ürünü</option>
                  <option value="Kozmetik">Kozmetik</option>
                </select>
              </div>
              <textarea
                rows={2}
                value={customLabel}
                onChange={(e) => setCustomLabel(e.target.value)}
                className="w-full border border-[#112A1E]/25 bg-white p-3 text-sm"
              />
              <button type="submit" className="inline-flex items-center gap-1.5 bg-[#0E5A36] px-4 py-2 text-xs font-bold text-white cursor-pointer">
                <Sparkles className="w-4 h-4" /> Etiketi Puanla
              </button>
            </form>
          )}

          {liveResults.length > 0 && (
            <div className="pt-2 border-t border-[#D8D3C5] flex gap-2 overflow-x-auto pb-1">
              {liveResults.map((hit) => {
                const hitRes = analyzeProduct(hit, activeFilters);
                return (
                  <button
                    key={hit.barcode}
                    type="button"
                    onClick={() => pushHistory(hit)}
                    className="shrink-0 flex items-center gap-2 border border-[#112A1E]/25 bg-[#F6F4EC] px-2.5 py-1 text-xs font-bold cursor-pointer"
                  >
                    <span className="truncate max-w-[160px]">{hit.name}</span>
                    <span className="font-label-mono px-1.5 py-0.5 text-white" style={{ backgroundColor: hitRes.color }}>
                      {hitRes.score}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {liveError && <p className="text-xs font-semibold text-[#92400E]">{liveError}</p>}
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT: Apothecary Nutrition Facts Label */}
          <section className="lg:col-span-7 space-y-5">
            <article className="border-2 border-[#112A1E] bg-[#FFFEFA] p-5 sm:p-6">
              <div className="border-b-8 border-[#112A1E] pb-4 flex flex-wrap items-end justify-between gap-4">
                <div className="flex-1 min-w-[200px]">
                  <div className="font-label-mono text-[11px] text-[#4B6155]">
                    {selectedProduct.domain} · {selectedProduct.category} · {selectedProduct.barcode}
                  </div>
                  <h2 className="font-serif-editorial text-3xl sm:text-4xl text-[#112A1E] mt-1 leading-tight">
                    {selectedProduct.name}
                  </h2>
                  <p className="text-xs text-[#4B6155] mt-1">
                    {selectedProduct.brand} · {selectedProduct.marketHint}
                  </p>
                  {livePrice && (
                    <div className="mt-1.5 inline-block font-label-mono text-[11px] bg-[#E7F5ED] px-2 py-0.5 text-[#0E5A36]">
                      Topluluk Fiyatı: {livePrice.price.toFixed(2)} {livePrice.currency}
                    </div>
                  )}
                </div>

                <div className="text-right">
                  <div className="font-label-mono text-4xl font-bold leading-none" style={{ color: breakdown.color }}>
                    {breakdown.score}
                    <span className="text-sm text-[#4B6155]">/100</span>
                  </div>
                  <div className="font-label-mono text-xs font-bold uppercase mt-1" style={{ color: breakdown.color }}>
                    {breakdown.grade}
                  </div>
                </div>
              </div>

              {selectedProduct.domain === 'Gıda' &&
                (selectedProduct.sugarPer100g !== undefined || selectedProduct.proteinPer100g !== undefined) && (
                  <div className="grid grid-cols-5 divide-x divide-[#112A1E]/20 border-b-2 border-[#112A1E] py-3 text-center">
                    {[
                      { label: 'Şeker', val: selectedProduct.sugarPer100g },
                      { label: 'Doy. Yağ', val: selectedProduct.satFatPer100g },
                      { label: 'Tuz', val: selectedProduct.saltPer100g },
                      { label: 'Protein', val: selectedProduct.proteinPer100g },
                      { label: 'Lif', val: selectedProduct.fiberPer100g },
                    ].map((n) => (
                      <div key={n.label} className="px-1">
                        <div className="font-label-mono text-sm font-bold">{n.val !== undefined ? `${n.val}g` : '—'}</div>
                        <div className="text-[10px] text-[#4B6155]">{n.label}</div>
                      </div>
                    ))}
                  </div>
                )}

              {breakdown.dietAlerts.length > 0 && (
                <div className="mt-4 border border-[#C83E37] bg-[#FCECEA] p-3 text-xs text-[#7D1F19] space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4" /> Kişisel Filtre Uyarısı
                  </div>
                  {breakdown.dietAlerts.map((a) => (
                    <div key={a}>• {a}</div>
                  ))}
                </div>
              )}

              <div className="mt-4 border-b border-[#112A1E]/20 pb-4">
                <h3 className="font-label-mono text-xs font-bold uppercase text-[#4B6155] mb-2">
                  Katkı &amp; İçerik Bulguları ({breakdown.findings.length})
                </h3>
                {breakdown.findings.length === 0 ? (
                  <div className="flex items-center gap-2 text-xs font-bold text-[#0E5A36]">
                    <ShieldCheck className="w-4 h-4" /> Riskli katkı maddesi, glikoz şurubu veya paraben saptanmadı.
                  </div>
                ) : (
                  <div className="divide-y divide-[#112A1E]/15">
                    {breakdown.findings.map((f) => (
                      <div key={f.code} className="py-2 flex items-start justify-between gap-2 text-xs">
                        <div>
                          <span className="font-bold">{f.name}</span>{' '}
                          <span className="font-label-mono text-[#4B6155]">[{f.code}]</span>
                          <p className="text-[#4B6155] mt-0.5">{f.reason}</p>
                        </div>
                        <span className="font-label-mono text-[10px] font-bold shrink-0 px-1.5 py-0.5 border border-[#112A1E]/30">
                          {f.risk === 'yuksek' ? 'Yüksek' : f.risk === 'orta' ? 'Orta' : 'Düşük'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-4 grid sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <div className="font-bold text-[#0E5A36] mb-1">Olumlu Yönler</div>
                  <ul className="space-y-1">
                    {breakdown.positives.length > 0 ? (
                      breakdown.positives.map((p) => (
                        <li key={p} className="flex items-start gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#0E5A36] shrink-0 mt-0.5" /> {p}
                        </li>
                      ))
                    ) : (
                      <li className="text-[#4B6155]">Öne çıkan artı yok.</li>
                    )}
                  </ul>
                </div>
                <div>
                  <div className="font-bold text-[#C83E37] mb-1">Dikkat Noktaları</div>
                  <ul className="space-y-1">
                    {breakdown.negatives.length > 0 ? (
                      breakdown.negatives.map((n) => <li key={n}>• {n}</li>)
                    ) : (
                      <li className="text-[#4B6155]">Şeker/tuz sınırlar içinde.</li>
                    )}
                  </ul>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-[#112A1E]/20 space-y-3">
                <p className="text-xs text-[#4B6155] leading-relaxed">
                  <strong className="text-[#112A1E]">İçindekiler:</strong> {selectedProduct.ingredientsText}
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => downloadScoreCardPng(selectedProduct, breakdown)}
                    className="inline-flex items-center gap-1.5 bg-[#112A1E] px-3.5 py-2 text-xs font-bold text-white cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" /> Skor Kartı PNG
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const altFirst = alternatives[0]?.product ?? allProducts.find((p) => p.barcode !== selectedProduct.barcode) ?? null;
                      setCompareProduct(altFirst);
                    }}
                    className="inline-flex items-center gap-1.5 border border-[#112A1E] bg-white px-3.5 py-2 text-xs font-bold cursor-pointer"
                  >
                    <ArrowLeftRight className="w-3.5 h-3.5" /> Alternatifle Karşılaştır
                  </button>
                </div>
              </div>
            </article>

            {alternatives.length > 0 && breakdown.score < 75 && (
              <section className="border border-[#0E5A36] bg-[#E7F5ED]/60 p-4 space-y-2.5">
                <h3 className="text-xs font-bold uppercase font-label-mono text-[#0E5A36]">
                  Daha Temiz Yerel Alternatifler
                </h3>
                <div className="grid sm:grid-cols-2 gap-2.5">
                  {alternatives.map(({ product, breakdown: alt }) => (
                    <button
                      key={product.barcode}
                      type="button"
                      onClick={() => pushHistory(product)}
                      className="flex items-center justify-between gap-2 border border-[#0E5A36]/30 bg-white p-3 text-left cursor-pointer"
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-bold truncate">{product.name}</div>
                        <div className="text-[11px] text-[#4B6155] truncate">{product.brand}</div>
                      </div>
                      <span className="font-label-mono px-2 py-1 text-xs font-bold text-white" style={{ backgroundColor: alt.color }}>
                        {alt.score}
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            )}
          </section>

          {/* RIGHT: Market & Brand Filtered Directory */}
          <aside className="lg:col-span-5 space-y-5">
            <section className="border border-[#112A1E]/25 bg-[#FFFEFA] p-4 space-y-3">
              <div className="flex items-center justify-between gap-2 pb-2 border-b border-[#112A1E]/15">
                <h3 className="font-label-mono text-xs font-bold uppercase text-[#4B6155]">
                  Market Raf İndeksi ({filteredCatalog.length})
                </h3>
                <div className="flex gap-1">
                  {(['Tümü', 'Gıda', 'Kozmetik'] as const).map((dom) => (
                    <button
                      key={dom}
                      type="button"
                      onClick={() => setCatalogDomainFilter(dom)}
                      className={`px-2 py-0.5 text-[11px] font-bold cursor-pointer ${
                        catalogDomainFilter === dom ? 'bg-[#112A1E] text-white' : 'text-[#4B6155]'
                      }`}
                    >
                      {dom}
                    </button>
                  ))}
                </div>
              </div>

              {/* Market Pills */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-bold text-[#4B6155]">
                  <span className="flex items-center gap-1"><Store className="w-3.5 h-3.5" /> Market Filtresi</span>
                  <button
                    type="button"
                    onClick={() => setAddModalOpen(true)}
                    className="text-[#0E5A36] underline cursor-pointer"
                  >
                    + Market Ekle
                  </button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {['Tümü', ...allMarkets].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setSelectedMarket(m)}
                      className={`px-2 py-0.5 text-[11px] border cursor-pointer ${
                        selectedMarket === m
                          ? 'bg-[#0E5A36] text-white border-[#0E5A36] font-bold'
                          : 'bg-white text-[#4B6155] border-[#D8D3C5]'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {/* Brand Filter */}
              <div>
                <label className="block text-[11px] font-bold text-[#4B6155] mb-1">Marka Filtresi</label>
                <select
                  value={selectedBrand}
                  onChange={(e) => setSelectedBrand(e.target.value)}
                  className="w-full border border-[#112A1E]/25 bg-[#F6F4EC] px-2.5 py-1.5 text-xs font-semibold"
                >
                  <option value="Tümü">Tüm Markalar ({allBrands.length})</option>
                  {allBrands.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>

              <ul className="divide-y divide-[#112A1E]/10 max-h-[360px] overflow-y-auto pr-1">
                {filteredCatalog.length === 0 ? (
                  <li className="py-6 text-center text-xs text-[#4B6155]">
                    Bu filtreye uygun ürün yok. "+ Market / Ürün Ekle" ile ekleyebilirsin.
                  </li>
                ) : (
                  filteredCatalog.map((prod) => {
                    const res = analyzeProduct(prod, activeFilters);
                    const active = selectedProduct.barcode === prod.barcode;
                    return (
                      <li key={prod.barcode} className="py-2 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => pushHistory(prod)}
                          className={`flex-1 flex items-center justify-between gap-2 text-left cursor-pointer min-w-0 ${
                            active ? 'font-bold text-[#0E5A36]' : ''
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="text-xs sm:text-sm truncate">{prod.name}</div>
                            <div className="text-[11px] text-[#4B6155] truncate">
                              {prod.brand} · {prod.marketHint}
                            </div>
                          </div>
                          <span className="font-label-mono text-xs font-bold px-2 py-0.5 text-white shrink-0" style={{ backgroundColor: res.color }}>
                            {res.score}
                          </span>
                        </button>
                        {prod.barcode !== selectedProduct.barcode && (
                          <button
                            type="button"
                            onClick={() => setCompareProduct(prod)}
                            className="p-1.5 border border-[#112A1E]/20 text-[#4B6155] hover:text-[#112A1E] cursor-pointer"
                            title="Karşılaştır"
                          >
                            <ArrowLeftRight className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </li>
                    );
                  })
                )}
              </ul>
            </section>

            <section className="border border-[#112A1E]/25 bg-[#FFFEFA] p-4">
              <h3 className="font-label-mono text-xs font-bold uppercase text-[#4B6155] flex items-center gap-1.5 mb-2">
                <History className="w-3.5 h-3.5" /> Son Taramalar ({history.length})
              </h3>
              <ul className="divide-y divide-[#112A1E]/10">
                {history.slice(0, 6).map((item) => {
                  const res = analyzeProduct(item, activeFilters);
                  return (
                    <li key={item.barcode} className="py-1.5">
                      <button
                        type="button"
                        onClick={() => setSelectedProduct(item)}
                        className="w-full flex items-center justify-between text-xs cursor-pointer"
                      >
                        <span className="truncate pr-2">{item.name}</span>
                        <span className="font-label-mono font-bold" style={{ color: res.color }}>
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

      <footer className="border-t border-[#112A1E]/20 py-4 text-center text-[11px] text-[#4B6155] px-4">
        TemizRaf bilgilendirme amaçlıdır; EFSA, IARC, SCCS ve Open Facts topluluk verilerine dayanır.
      </footer>

      <BarcodeScannerModal
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onDetected={(code) => {
          setSearchQuery(code);
          void handleBarcodeSearch(code);
        }}
      />

      {/* Add Market / Product Modal */}
      {addModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4">
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto border-2 border-[#112A1E] bg-[#FFFEFA] p-5 space-y-5">
            <div className="flex items-center justify-between border-b border-[#112A1E]/20 pb-3">
              <h2 className="font-serif-editorial text-xl font-bold">Market veya Ürün Ekle</h2>
              <button type="button" onClick={() => setAddModalOpen(false)} className="p-1 cursor-pointer"><X className="w-4 h-4" /></button>
            </div>

            <form onSubmit={handleAddCustomMarket} className="space-y-2 border-b border-[#112A1E]/15 pb-4">
              <label className="block font-label-mono text-xs font-bold uppercase text-[#4B6155]">
                1. Yeni Market Zinciri / Yerel Market Ekle
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newMarketName}
                  onChange={(e) => setNewMarketName(e.target.value)}
                  placeholder="Örn: Macrocenter, Onur Market, Bizim..."
                  className="flex-1 border border-[#112A1E]/30 bg-white px-3 py-2 text-xs"
                />
                <button type="submit" className="bg-[#0E5A36] px-4 py-2 text-xs font-bold text-white cursor-pointer">
                  Market Ekle
                </button>
              </div>
            </form>

            <form onSubmit={handleAddCustomProduct} className="space-y-3">
              <div className="font-label-mono text-xs font-bold uppercase text-[#4B6155]">
                2. Kendi Ürününü Raf İndeksine Ekle
              </div>
              <div className="grid sm:grid-cols-2 gap-2.5">
                <input
                  type="text"
                  required
                  value={newProdName}
                  onChange={(e) => setNewProdName(e.target.value)}
                  placeholder="Ürün adı *"
                  className="border border-[#112A1E]/30 bg-white px-3 py-2 text-xs"
                />
                <input
                  type="text"
                  value={newProdBrand}
                  onChange={(e) => setNewProdBrand(e.target.value)}
                  placeholder="Marka (ör. Torku, Eti, Dost)"
                  className="border border-[#112A1E]/30 bg-white px-3 py-2 text-xs"
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <select value={newProdMarket} onChange={(e) => setNewProdMarket(e.target.value)} className="border border-[#112A1E]/30 bg-[#F6F4EC] px-2.5 py-2 text-xs">
                  {allMarkets.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
                <select value={newProdDomain} onChange={(e) => setNewProdDomain(e.target.value as ProductDomain)} className="border border-[#112A1E]/30 bg-[#F6F4EC] px-2.5 py-2 text-xs">
                  <option value="Gıda">Gıda</option>
                  <option value="Kozmetik">Kozmetik</option>
                </select>
                <input
                  type="text"
                  value={newProdBarcode}
                  onChange={(e) => setNewProdBarcode(e.target.value)}
                  placeholder="Barkod (opsiyonel)"
                  className="border border-[#112A1E]/30 bg-white px-2.5 py-2 text-xs font-label-mono"
                />
              </div>
              <textarea
                rows={3}
                required
                value={newProdIngredients}
                onChange={(e) => setNewProdIngredients(e.target.value)}
                placeholder="İçindekiler listesini buraya yapıştır *"
                className="w-full border border-[#112A1E]/30 bg-white p-2.5 text-xs"
              />
              <button type="submit" className="w-full bg-[#112A1E] py-2.5 text-xs font-bold text-white cursor-pointer">
                Ürünü Kaydet ve Puanla
              </button>
            </form>
          </div>
        </div>
      )}

      {compareProduct && compareBreakdown && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4">
          <div className="w-full max-w-2xl max-h-[88vh] overflow-y-auto border-2 border-[#112A1E] bg-[#FFFEFA] p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-[#112A1E]/20 pb-3">
              <h2 className="font-serif-editorial text-xl font-bold">Yan Yana Etiket Karşılaştırması</h2>
              <button type="button" onClick={() => setCompareProduct(null)} className="p-1 cursor-pointer"><X className="w-4 h-4" /></button>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              {[
                { p: selectedProduct, b: breakdown },
                { p: compareProduct, b: compareBreakdown },
              ].map(({ p, b }) => (
                <div key={p.barcode} className="border border-[#112A1E]/30 bg-[#F6F4EC] p-4 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-sm">{p.name}</span>
                    <span className="font-label-mono px-2 py-0.5 text-white text-xs font-bold" style={{ backgroundColor: b.color }}>{b.score}/100</span>
                  </div>
                  <div className="text-xs text-[#4B6155]">Şeker: {p.sugarPer100g ?? '—'}g · Protein: {p.proteinPer100g ?? '—'}g</div>
                  <button type="button" onClick={() => { pushHistory(p); setCompareProduct(null); }} className="w-full border border-[#112A1E] bg-white py-1.5 text-xs font-bold cursor-pointer">
                    Bu Ürünü Seç
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {kvkkOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4">
          <div className="w-full max-w-md border-2 border-[#112A1E] bg-[#FFFEFA] p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-[#112A1E]/20 pb-2">
              <h2 className="font-serif-editorial text-lg font-bold">KVKK &amp; Tarama Geçmişi</h2>
              <button type="button" onClick={() => setKvkkOpen(false)} className="p-1 cursor-pointer"><X className="w-4 h-4" /></button>
            </div>
            <button type="button" onClick={handleExportHistoryJson} className="w-full bg-[#112A1E] py-2.5 text-xs font-bold text-white cursor-pointer">
              Geçmiş &amp; Özel Ürünleri JSON İndir
            </button>
            {!confirmDelete ? (
              <button type="button" onClick={() => setConfirmDelete(true)} className="w-full border border-[#C83E37] bg-[#FCECEA] py-2 text-xs font-bold text-[#C83E37] cursor-pointer">
                Geçmişi Kalıcı Temizle
              </button>
            ) : (
              <button type="button" onClick={handlePurgeHistory} className="w-full bg-[#C83E37] py-2 text-xs font-bold text-white cursor-pointer">
                Evet, Tüm Kayıtları Sil
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
