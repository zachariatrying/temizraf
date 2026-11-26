import type { DietFilter, ProductDomain, ProductRecord, ScoreBreakdown } from '../types';
import { ADDITIVE_RULES, TURKISH_PRODUCTS } from '../data/turkishProducts';

export function analyzeProduct(
  product: ProductRecord,
  activeFilters: DietFilter[]
): ScoreBreakdown {
  const lower = product.ingredientsText.toLocaleLowerCase('tr-TR');
  let score = 96;
  const findings: ScoreBreakdown['findings'] = [];
  const positives: string[] = [];
  const negatives: string[] = [];
  const dietAlerts: string[] = [];

  for (const rule of ADDITIVE_RULES) {
    if (rule.patterns.some((p) => lower.includes(p))) {
      score -= rule.penalty;
      findings.push({
        code: rule.code,
        name: rule.name,
        risk: rule.risk,
        reason: rule.reason,
      });
    }
  }

  // Nutritional adjustments for Food products
  if (product.domain === 'Gıda') {
    if (product.sugarPer100g !== undefined) {
      if (product.sugarPer100g >= 22) {
        score -= 22;
        negatives.push(`Çok yüksek şeker (${product.sugarPer100g}g / 100g)`);
      } else if (product.sugarPer100g >= 12) {
        score -= 10;
        negatives.push(`Yüksek şeker (${product.sugarPer100g}g / 100g)`);
      } else if (product.sugarPer100g <= 5) {
        positives.push(`Düşük şeker (${product.sugarPer100g}g / 100g)`);
      }
    }

    if (product.satFatPer100g !== undefined) {
      if (product.satFatPer100g >= 10) {
        score -= 12;
        negatives.push(`Yüksek doymuş yağ (${product.satFatPer100g}g / 100g)`);
      } else if (product.satFatPer100g <= 3) {
        positives.push(`Dengeli doymuş yağ (${product.satFatPer100g}g)`);
      }
    }

    if (product.saltPer100g !== undefined && product.saltPer100g >= 1.5) {
      score -= 10;
      negatives.push(`Yüksek tuz oranı (${product.saltPer100g}g / 100g)`);
    }

    if (product.proteinPer100g !== undefined && product.proteinPer100g >= 10) {
      score += 5;
      positives.push(`Güçlü protein kaynağı (${product.proteinPer100g}g / 100g)`);
    }

    if (product.fiberPer100g !== undefined && product.fiberPer100g >= 5) {
      score += 5;
      positives.push(`Yüksek lif içeriği (${product.fiberPer100g}g / 100g)`);
    }
  }

  if (findings.length === 0) {
    positives.push('Riskli katkı maddesi veya tartışmalı koruyucu tespit edilmedi');
  }

  // Personal Diet / Allergen Alerts
  if (
    activeFilters.includes('glutensiz') &&
    (lower.includes('buğday') || lower.includes('gluten') || lower.includes('arpa'))
  ) {
    dietAlerts.push('Glüten / buğday içeriği tespit edildi.');
  }
  if (activeFilters.includes('palmiyesiz') && (lower.includes('palm') || lower.includes('palmiye'))) {
    dietAlerts.push('Palm / palmiye yağı içeriyor.');
  }
  if (
    activeFilters.includes('sekersiz') &&
    (lower.includes('şeker') || lower.includes('glikoz') || (product.sugarPer100g ?? 0) > 5)
  ) {
    dietAlerts.push('İlave şeker veya yüksek şeker oranı içeriyor.');
  }
  if (
    activeFilters.includes('laktozsuz') &&
    (lower.includes('süt') || lower.includes('peynir altı') || lower.includes('laktoz'))
  ) {
    dietAlerts.push('Süt / laktoz bileşeni içeriyor.');
  }

  const finalScore = Math.max(4, Math.min(100, Math.round(score)));

  let grade: ScoreBreakdown['grade'] = 'Mükemmel';
  let color = '#1B7F4B';
  let bgColor = '#E7F5ED';

  if (finalScore < 35) {
    grade = 'Kaçın';
    color = '#C83E37';
    bgColor = '#FCECEA';
  } else if (finalScore < 55) {
    grade = 'Orta';
    color = '#D97706';
    bgColor = '#FEF4E4';
  } else if (finalScore < 75) {
    grade = 'İyi';
    color = '#5A9318';
    bgColor = '#EFF6E5';
  }

  return {
    score: finalScore,
    grade,
    color,
    bgColor,
    findings,
    positives,
    negatives,
    dietAlerts,
  };
}

export function findCleanAlternatives(
  product: ProductRecord,
  activeFilters: DietFilter[]
): Array<{ product: ProductRecord; breakdown: ScoreBreakdown }> {
  const sameCategory = TURKISH_PRODUCTS.filter(
    (p) => p.barcode !== product.barcode && p.category === product.category
  )
    .map((p) => ({ product: p, breakdown: analyzeProduct(p, activeFilters) }))
    .filter((entry) => entry.breakdown.score >= 75)
    .sort((a, b) => b.breakdown.score - a.breakdown.score);

  if (sameCategory.length >= 3) {
    return sameCategory.slice(0, 3);
  }

  const seen = new Set(sameCategory.map((e) => e.product.barcode));
  seen.add(product.barcode);

  const sameDomainFallback = TURKISH_PRODUCTS.filter(
    (p) => !seen.has(p.barcode) && p.domain === product.domain
  )
    .map((p) => ({ product: p, breakdown: analyzeProduct(p, activeFilters) }))
    .filter((entry) => entry.breakdown.score >= 82)
    .sort((a, b) => b.breakdown.score - a.breakdown.score);

  return [...sameCategory, ...sameDomainFallback].slice(0, 3);
}

/**
 * Fetches live product data from Open Food Facts API v2 when barcode isn't in local TR catalog.
 */
export async function lookupBarcodeLive(barcode: string): Promise<ProductRecord | null> {
  const cleaned = barcode.replace(/\D/g, '');
  if (!cleaned) return null;

  const localHit = TURKISH_PRODUCTS.find((p) => p.barcode === cleaned);
  if (localHit) return localHit;

  try {
    const res = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(cleaned)}.json`
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      status?: number;
      product?: {
        product_name_tr?: string;
        product_name?: string;
        brands?: string;
        ingredients_text_tr?: string;
        ingredients_text?: string;
        categories?: string;
        nutriments?: {
          sugars_100g?: number;
          'saturated-fat_100g'?: number;
          salt_100g?: number;
          proteins_100g?: number;
          fiber_100g?: number;
        };
      };
    };
    if (data.status !== 1 || !data.product) return null;
    const p = data.product;
    return {
      barcode: cleaned,
      name: p.product_name_tr || p.product_name || `Barkod ${cleaned}`,
      brand: p.brands || 'Bilinmeyen Marka',
      marketHint: 'Open Food Facts',
      domain: 'Gıda',
      category: p.categories?.split(',')[0]?.trim() || 'Genel Gıda',
      ingredientsText:
        p.ingredients_text_tr || p.ingredients_text || 'İçindekiler metni veritabanında kayıtlı değil.',
      sugarPer100g: p.nutriments?.sugars_100g,
      satFatPer100g: p.nutriments?.['saturated-fat_100g'],
      saltPer100g: p.nutriments?.salt_100g,
      proteinPer100g: p.nutriments?.proteins_100g,
      fiberPer100g: p.nutriments?.fiber_100g,
      allergens: [],
      source: 'Open Food Facts (Canlı)',
    };
  } catch {
    return null;
  }
}

/**
 * Searches Open Food Facts (tr.openfoodfacts.org) or Open Beauty Facts (world.openbeautyfacts.org)
 * by product name when a text query does not match the local Turkish catalog.
 */
export async function searchProductsLive(
  query: string,
  domain: ProductDomain = 'Gıda'
): Promise<ProductRecord[]> {
  const cleaned = query.trim();
  if (cleaned.length < 2) return [];

  const host = domain === 'Kozmetik' ? 'world.openbeautyfacts.org' : 'tr.openfoodfacts.org';
  const url = `https://${host}/cgi/search.pl?search_terms=${encodeURIComponent(
    cleaned
  )}&search_simple=1&action=process&json=1&page_size=${domain === 'Kozmetik' ? 8 : 10}`;

  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = (await res.json()) as {
      products?: Array<{
        code?: string;
        product_name_tr?: string;
        product_name?: string;
        brands?: string;
        ingredients_text_tr?: string;
        ingredients_text?: string;
        categories?: string;
        nutriments?: {
          sugars_100g?: number;
          'saturated-fat_100g'?: number;
          salt_100g?: number;
          proteins_100g?: number;
          fiber_100g?: number;
        };
      }>;
    };

    const hits: ProductRecord[] = [];
    for (const p of data.products ?? []) {
      const name = (p.product_name_tr || p.product_name || '').trim();
      const ing = (p.ingredients_text_tr || p.ingredients_text || '').trim();
      if (!name || !p.code) continue;
      hits.push({
        barcode: p.code,
        name,
        brand: p.brands || 'Bilinmeyen Marka',
        marketHint: domain === 'Kozmetik' ? 'Open Beauty Facts' : 'Open Food Facts',
        domain,
        category: p.categories?.split(',')[0]?.trim() || (domain === 'Kozmetik' ? 'Cilt Bakımı' : 'Genel Gıda'),
        ingredientsText: ing || 'İçindekiler metni Open Facts veritabanında eksik.',
        sugarPer100g: p.nutriments?.sugars_100g,
        satFatPer100g: p.nutriments?.['saturated-fat_100g'],
        saltPer100g: p.nutriments?.salt_100g,
        proteinPer100g: p.nutriments?.proteins_100g,
        fiberPer100g: p.nutriments?.fiber_100g,
        allergens: [],
        source: 'Open Food Facts (Canlı)',
      });
    }
    return hits.slice(0, 8);
  } catch {
    return [];
  }
}

/**
 * Generates a clean 1080x1350 PNG Score Card ready for TikTok / Instagram Reels sharing.
 */
export function downloadScoreCardPng(product: ProductRecord, breakdown: ScoreBreakdown): void {
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1350;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.fillStyle = '#FAF8F3';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Top Header Strip
  ctx.fillStyle = '#14281D';
  ctx.font = '700 42px Georgia, serif';
  ctx.fillText('TemizRaf', 80, 120);
  ctx.fillStyle = '#526258';
  ctx.font = '500 28px sans-serif';
  ctx.fillText('Bağımsız Gıda & Kozmetik Etiket Analizi', 80, 165);

  // Score Circle
  ctx.beginPath();
  ctx.arc(540, 440, 175, 0, Math.PI * 2);
  ctx.fillStyle = breakdown.bgColor;
  ctx.fill();
  ctx.lineWidth = 16;
  ctx.strokeStyle = breakdown.color;
  ctx.stroke();

  ctx.fillStyle = breakdown.color;
  ctx.textAlign = 'center';
  ctx.font = '700 132px sans-serif';
  ctx.fillText(String(breakdown.score), 540, 465);
  ctx.font = '700 38px sans-serif';
  ctx.fillText(`${breakdown.grade.toUpperCase()} / 100`, 540, 530);

  // Product Name & Brand
  ctx.fillStyle = '#14281D';
  ctx.font = '700 48px Georgia, serif';
  ctx.fillText(product.name.slice(0, 34), 540, 730);
  ctx.fillStyle = '#526258';
  ctx.font = '500 30px sans-serif';
  ctx.fillText(`${product.brand} · ${product.category}`, 540, 785);

  // Findings Box
  ctx.textAlign = 'left';
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(80, 845, 920, 360);
  ctx.strokeStyle = '#E5E0D5';
  ctx.lineWidth = 3;
  ctx.strokeRect(80, 845, 920, 360);

  ctx.fillStyle = '#14281D';
  ctx.font = '700 30px sans-serif';
  ctx.fillText('Öne Çıkan Bulgular:', 120, 910);

  const lines = [
    ...breakdown.findings.slice(0, 3).map((f) => `• [${f.code}] ${f.name}`),
    ...breakdown.positives.slice(0, 2).map((p) => `✓ ${p}`),
  ].slice(0, 5);

  ctx.font = '500 28px sans-serif';
  lines.forEach((line, idx) => {
    ctx.fillStyle = line.startsWith('✓') ? '#1B7F4B' : '#C83E37';
    ctx.fillText(line.slice(0, 56), 120, 975 + idx * 46);
  });

  ctx.fillStyle = '#738278';
  ctx.textAlign = 'center';
  ctx.font = '500 24px sans-serif';
  ctx.fillText('temizraf · Reklamsız, bağımsız Türkçe etiket analizi', 540, 1285);

  const link = document.createElement('a');
  link.download = `temizraf-${product.barcode || 'analiz'}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

export interface OpenPriceResult {
  price: number;
  currency: string;
  location?: string;
  date?: string;
}

export async function fetchOpenPriceTry(barcode: string): Promise<OpenPriceResult | null> {
  const clean = barcode.trim();
  if (!/^\d{8,14}$/.test(clean)) return null;
  try {
    const res = await fetch(
      `https://prices.openfoodfacts.org/api/v1/prices?product_code=${encodeURIComponent(clean)}&size=5`
    );
    if (!res.ok) return null;
    const json = (await res.json()) as {
      items?: Array<{
        price?: number;
        currency?: string;
        date?: string;
        location?: { osm_name?: string; osm_address_city?: string };
      }>;
    };
    const items = json.items ?? [];
    if (items.length === 0) return null;
    const best = items.find((i) => i.currency === 'TRY') ?? items[0];
    if (typeof best.price !== 'number') return null;
    return {
      price: best.price,
      currency: best.currency || 'TRY',
      location: best.location?.osm_name || best.location?.osm_address_city,
      date: best.date,
    };
  } catch {
    return null;
  }
}
