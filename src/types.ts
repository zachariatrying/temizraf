export type ProductDomain = 'Gıda' | 'Kozmetik';

export type RiskLevel = 'yuksek' | 'orta' | 'dusuk';

export type DietFilter = 'glutensiz' | 'palmiyesiz' | 'sekersiz' | 'laktozsuz';

export interface AdditiveRule {
  code: string;
  patterns: string[];
  name: string;
  risk: RiskLevel;
  penalty: number;
  reason: string;
}

export interface ProductRecord {
  barcode: string;
  name: string;
  brand: string;
  marketHint: string;
  domain: ProductDomain;
  category: string;
  ingredientsText: string;
  sugarPer100g?: number;
  satFatPer100g?: number;
  saltPer100g?: number;
  proteinPer100g?: number;
  fiberPer100g?: number;
  allergens: string[];
  source: 'Türkiye Raf Kataloğu' | 'Open Food Facts (Canlı)' | 'Etiket Analizi';
}

export interface ScoreBreakdown {
  score: number;
  grade: 'Mükemmel' | 'İyi' | 'Orta' | 'Kaçın';
  color: string;
  bgColor: string;
  findings: Array<{
    code: string;
    name: string;
    risk: RiskLevel;
    reason: string;
  }>;
  positives: string[];
  negatives: string[];
  dietAlerts: string[];
}
