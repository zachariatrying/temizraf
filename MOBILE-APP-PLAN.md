# TemizRaf — iOS & Android Mobil Uygulama Lansman Planı

**Paket Kimliği (Bundle ID / Application ID):** `com.temizraf.app`  
**Mimari:** Capacitor 7 (React 19 + Vite + Clinical Lab UI + Open Food Facts / Open Beauty Facts + Türkiye Piyasa Kataloğu)  
**Hedef Pazar:** Türkiye Bilinçli Tüketici, Ebeveyn & Kozmetik İçerik Okuyucuları

---

## 1. Mağaza Görselleri ve Marka Kimliği

- **Uygulama İkonu (`1024x1024`):** `public/store-assets/temizraf_icon.png` — Klinik Botanik Zümrüt (`#0E5A36`) ve beyaz zemin üzerinde yaprak + temiz raf barkod/damla amblemi.
- **Tanıtım Banner (`1600x900`):** `public/store-assets/temizraf_promo.png` — 25+ yerli market & kozmetik ürünü, E-kodu/INCI analiz motoru ve yan yana ürün karşılaştırma ekranı.

---

## 2. Capacitor 7 Yerel Entegrasyon Mimarisi

```bash
npm install @capacitor/core @capacitor/cli @capacitor/ios @capacitor/android
npm install @capacitor-mlkit/barcode-scanning @capacitor/haptics @capacitor/share @capacitor/preferences
npx cap init "TemizRaf" "com.temizraf.app" --web-dir dist
npx cap add ios && npx cap add android
```

### Eklenti Eşlemesi
| Web Özelliği | Capacitor 7 Doğal API | Kullanım Amacı |
| :--- | :--- | :--- |
| Süpermarket Barkod Okuma | `@capacitor-mlkit/barcode-scanning` | BİM/A101/ŞOK/Migros/Gratis raflarında 0.3 sn EAN-13 barkod tarama |
| Dokunsal Risk Uyarısı | `@capacitor/haptics` | Yüksek riskli katkı/alerjen tespitinde ince titreşim geri bildirimi |
| Geçmiş & Favoriler | `@capacitor/preferences` | İnternetsiz rafta yerel tarama geçmişi ve temiz alternatif kataloğu |
| Ürün Özeti Paylaşımı | `@capacitor/share` | Aile veya arkadaş grubuna temiz skor & içerik uyarısı gönderme |

---

## 3. Doğal İzinler (`Info.plist` & `AndroidManifest.xml`)

### iOS (`ios/App/App/Info.plist`)
- `NSCameraUsageDescription`: *"Market ve kozmetik ürünlerinin barkodlarını ve içerik etiketlerini taramak için kamera erişimi gereklidir."*

### Android (`android/app/src/main/AndroidManifest.xml`)
- `android.permission.INTERNET` (Open Food Facts / Open Beauty Facts sorguları için)
- `android.permission.CAMERA` (Anlık EAN-13 barkod tarama için)

---

## 4. App Store & Google Play Uyumluluk Kapıları

1. **Sağlık & Tıbbi Feragatname (Apple 1.4 / Google Health):**
   - TemizRaf tıbbi teşhis koymaz; tüm analiz sonuçlarında EFSA, FDA, Türk Gıda Kodeksi ve AB Kozmetik Tüzüğü referanslı bilgilendirme etiketi gösterilir.
2. **Apple Guideline 5.1.1(v) — KVKK & Yerel Kontrol:**
   - Hesap açmadan tam kullanım sunulur.
   - Ayarlar/KVKK penceresinden tarama geçmişi JSON olarak dışa aktarılabilir ve tek dokunuşla cihazdan silinebilir.
3. **Veri Gizliliği (Privacy Nutrition Label):**
   - Barkod/ürün arama sorguları anonim olarak Open Food Facts / Open Beauty Facts API'lerine gider; kişisel profil veya reklam izleme verisi toplanmaz.

---

## 5. Türkçe ASO (App Store Optimization) & Gelir Modeli

- **Başlık (30 kr):** `TemizRaf: İçerik & Barkod`
- **Alt Başlık (30 kr):** `Gıda ve Kozmetik Etiket Analizi`
- **Anahtar Kelimeler (100 kr):** `içerik,barkod,e kodu,katkı maddesi,kozmetik,inci,paraben,temiz gıda,alerjen,helal,vegan,bebek`

### RevenueCat / TL PPP Fiyatlandırma Katmanları
| Katman | Fiyat (TRY) | Kapsam |
| :--- | :--- | :--- |
| **Ücretsiz (Temel Tarayıcı)** | ₺0 | Sınırsız barkod/isim arama, 25+ yerel market ürünü, içerik puanı, yan yana karşılaştırma |
| **TemizRaf Aile Plus (Aylık)** | ₺49,99 / ay | Kişisel alerjen profili (Glüten/Süt/Fıstık/SLS uyarıları) + çevrimdışı dev Türkiye kataloğu |
| **TemizRaf Aile Plus (Yıllık)** | ₺349,99 / yıl | %41 indirim + aile içi 4 profil paylaşımı |

---

## 6. 6 Haftalık Lansman Yol Haritası

| Hafta | Odak | Çıktı |
| :--- | :--- | :--- |
| **Hafta 1** | Capacitor 7 & MLKit Kurulumu | Android/iOS barkod tarayıcı native modülü |
| **Hafta 2** | Yerel Katalog & Çevrimdışı Önbellek | 500+ en çok aranan Türkiye market ürününün paketlenmesi |
| **Hafta 3** | Store Görselleri & Ekran Görüntüleri | 1024x1024 ikon, yan yana karşılaştırma vitrinleri |
| **Hafta 4** | Saha Market Testi | BİM, Migros, Gratis ürünlerinde gerçek barkod hız testi |
| **Hafta 5** | Mağaza Uyumu & Feragatname İncelemesi | Privacy policy, tıbbi feragatname, Apple review notları |
| **Hafta 6** | Lansman | App Store & Google Play yayını + ebeveyn/sağlıklı yaşam duyurusu |
