# 🌌 Hava Durumu AI (Uzay Temalı)

Bu proje, gücünü **Google Gemini AI** ve **Open-Meteo API**'sinden alan; bilimkurgu, uzay ve siberpunk esintileri taşıyan fütüristik bir hava durumu uygulamasıdır. Klasik, sıkıcı mavi/beyaz hava durumu uygulamalarının aksine, bu uygulama sana adeta bir **uzay gemisinin HUD (Heads Up Display)** ekranındaymışsın hissi verir! 🚀

## 🚀 Özellikler

*   **🤖 Sistem Analizi (AI Yorumlama):** Gemini AI hava durumunu basitçe "Yağmurlu" demek yerine; *"Yağmur döngüsü tespit edildi, kalkanlarınızı aktif edin"* veya *"Çekirdek erime riski: Aşırı sıcak"* gibi siberpunk terminolojilerle yorumlar.
*   **🌌 Fütüristik Neon Tasarım:** Cam efektleri (Glassmorphism), neon camgöbeği (cyan) ve macenta parlamalar, derin uzay tonlarında karanlık mod arka planlar!
*   **👗 Akıllı Donanım ve Simülasyon Önerileri:** O anki hava durumuna uygun giysi ("Termal Zırh", "Optik Filtre") ve aktivite önerileri sunar.
*   **🌍 Gezegen İçi Navigasyon:** İster bulunduğun konumu GPS üzerinden çek, ister dünyanın herhangi bir şehrini ara ve favorilerine kaydet!
*   **⚡ Hızlı ve Güçlü:** Expo, React Native ve TypeScript kullanılarak geliştirilmiş olup, iOS, Android ve Web platformlarında kusursuz çalışır.

## 🛠️ Kurulum ve Çalıştırma

Projeyi kendi yerel (local) ortamında çalıştırmak için aşağıdaki adımları takip et.

### 1. Depoyu Klonla
```bash
git clone https://github.com/Oremine720/hava-durumu-ai.git
cd hava-durumu-ai
```

### 2. Gerekli Paketleri Yükle
```bash
npm install
```

### 3. Çevresel Değişkenleri Ayarla (.env)
Proje kök dizinine bir `.env` dosyası oluştur ve Gemini AI API anahtarını ekle:
```env
EXPO_PUBLIC_GEMINI_API_KEY=senin_api_anahtarin_buraya
```
*(Güvenliğin için `.env` dosyası `.gitignore` kuralları ile engellenmiştir ve Github'a asla yüklenmez!)*

### 4. Simülasyonu Başlat
```bash
npm start
```
Terminal ekranında çıkan karekodu **Expo Go** uygulaması ile (iOS veya Android) okutabilir, ya da `w` tuşuna basarak uygulamanın Web versiyonunu tarayıcında inceleyebilirsin!

## 📸 Ekran Görüntüleri
*(Buraya uygulamanın ekran görüntülerini yükleyebilirsin. Örneğin; neon detayları gösteren ana sayfa vb.)*

---

> **Uyarı:** Bu yazılım deneysel bir simülasyon sistemidir. Dış mekan görevlerine (sokağa) çıkmadan önce AI uyarılarını dikkatlice okuyunuz! 👾
