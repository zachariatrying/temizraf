# TemizRaf

Gıda ve kozmetik ürünleri için barkod/isim arama, içerik güvenliği analizi, 100g besin özeti ve yan yana ürün karşılaştırma uygulaması.

## 🌐 Web'de Kullan

- **Canlı Adres:** https://zachariatrying.github.io/temizraf/
- **Telefona PWA Olarak Ekleme:** Mobil tarayıcınızda **Ana Ekrana Ekle** seçeneğini kullanarak ana ekrandan doğrudan açabilirsiniz.

## 📱 Android APK İndir & Kur

1. [Build Android APK & Play AAB](https://github.com/zachariatrying/temizraf/actions/workflows/android-apk.yml) sayfasına gidin.
2. En üstteki yeşil (başarılı) iş akışı koşusuna tıklayın.
3. Sayfanın en altındaki **Artifacts** bölümünden **`temizraf-debug-apk`** dosyasını indirin.
4. İnen `.zip` dosyasını açıp içindeki `app-debug.apk` dosyasını Android telefonunuza aktarın.
5. Android'de **Bilinmeyen kaynaklardan uygulama yükleme** iznini verip kurulumu tamamlayın.

> Google Play Store için aynı sayfada **`temizraf-release-aab`** (`app-release.aab`, R8 küçültmeli) paketi de üretilmektedir.

## ✨ Öne Çıkan Özellikler

- **Canlı Open Food Facts & Open Beauty Facts Arama:** Barkod veya ürün adıyla gerçek zamanlı içerik sorgulama.
- **25 Ürünlü Türkiye Market & Kozmetik Kataloğu:** Çevrimdışı anında inceleme ve skorlama.
- **Yan Yana Karşılaştırma & 100g Besin Özeti:** İki ürünün içerik temizliği ve besin değerlerini tek ekranda kıyaslama.
- **KVKK Veri Kontrolü:** Hesap zorunluluğu yok; cihaz içi JSON yedekleme/geri yükleme ve kalıcı silme.

## 🛠️ Yerel Geliştirme & Mobil Derleme

```bash
npm install
npm run dev        # Yerel geliştirme sunucusu
npm run build      # Üretim derlemesi (dist/)
npx cap sync       # Android & iOS projelerini güncelleme
```
