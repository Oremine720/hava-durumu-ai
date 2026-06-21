// Hava durumuna göre algoritmik kıyafet, aktivite ve uyarı önerileri.
// Dış API gerektirmez — tamamen yerel hesaplama.

import type { WeatherResult } from "./weather";

export interface DailySuggestions {
  /** Ne giymeli? */
  clothing: string;
  /** Yapılabilecek aktiviteler */
  activities: string[];
  /** Önemli uyarılar */
  alerts: string[];
}

/**
 * Mevcut hava verilerine göre kıyafet, aktivite ve uyarı önerileri üretir.
 */
export function getSuggestions(weather: WeatherResult): DailySuggestions {
  const { current, daily } = weather;
  const code = current.weatherCode;
  const temp = current.temperature;
  const feels = current.apparentTemperature;
  const effective = Math.min(temp, feels); // hissedilen veya gerçek, hangisi düşükse
  const uv = daily[0]?.uvIndex ?? 0;
  const wind = current.windSpeed;

  // Hava kategorisi flag'leri
  const isRainy =
    (code >= 51 && code <= 67) || (code >= 80 && code <= 99);
  const isSnowy = code >= 71 && code <= 86;
  const isFoggy = code === 45 || code === 48;
  const isClear = code <= 1;
  const isStormy = code >= 95;
  const isWindy = wind >= 35;

  // ── Kıyafet önerisi ──────────────────────────────────────────────────────
  let clothing: string;
  if (isSnowy) {
    clothing = "🧥 Termal zırh, yalıtımlı bere ve kış botları (❄️ Ekstrem Soğuk)";
  } else if (effective < 0) {
    clothing = "🧥 Ağır izolasyonlu katmanlar ve eldivenler (🧊 Dondurucu Soğuk)";
  } else if (effective < 5) {
    clothing = "🧥 Kalın kalkan (mont) ve ısı korumalı atkı (🌬️ Çok Soğuk)";
  } else if (effective < 10) {
    clothing = "🧥 Kışlık ceket ve termal modüller (🥶 Soğuk)";
  } else if (effective < 15) {
    clothing = "🧣 Hafif savunma katmanı (Hırka/Ceket)";
  } else if (effective < 20) {
    clothing = "👕 Standart mod: Uzun kollu tişört ve ince zırh";
  } else if (effective < 25) {
    clothing = "👕 Minimum katman: Tişört veya ince gömlek";
  } else if (effective < 30) {
    clothing = "🩴 Soğutma modu: Tişört ve şort";
  } else {
    clothing = "🔥 Kritik Isı! Maksimum havalandırmalı açık kıyafetler ve H2O takviyesi";
  }

  // ── Aktivite önerileri ───────────────────────────────────────────────────
  const activities: string[] = [];

  if (isStormy) {
    activities.push("⚠️ SİSTEM UYARISI: Fırtına tespit edildi — üsse dön");
    activities.push("🏠 İç mekan simülasyonları tavsiye edilir");
  } else if (isSnowy) {
    activities.push("🏂 Düşük sürtünmeli yüzey görevleri (Kayak/Kızak)");
    activities.push("❄️ Kriyojenik mimari (Kardan Adam)");
    activities.push("☕ Sıcak enerji ikmali (Çay/Çikolata)");
  } else if (isRainy) {
    activities.push("🏠 Üs içi operasyonlar için ideal döngü");
    activities.push("📚 Veri aktarımı (Kitap/Film) tavsiye edilir");
    activities.push("☕ Sıcak modül aktivasyonu");
  } else if (isFoggy) {
    activities.push("🛸 Navigasyon tehlikesi: Görüş mesafesi minimumda");
    activities.push("🚶 Optik sensörleri maksimumda kullan, yavaş ilerle");
  } else if (isWindy && !isRainy) {
    activities.push("🪁 Atmosferik test uçuşları (Uçurtma) uygun");
    activities.push("🚴 Rüzgar direnci yüksek — efor sarfiyatı artacak");
  } else if (isClear && temp > 28) {
    activities.push("🏖️ Su gezegenine geçiş (Plaj/Havuz) için optimum");
    activities.push("🍦 Kriyojenik gıda takviyesi (Dondurma) şart");
    activities.push("🌅 Yıldız doğarken erken egzersiz rotası");
  } else if (isClear && temp >= 20) {
    activities.push("🚶 Yüzey keşfi için kusursuz döngü");
    activities.push("🌿 Biyosfer alanlarında (Piknik) reşarj ol");
    activities.push("🚴 Mobilite araçlarıyla (Bisiklet) tarama yap");
  } else if (isClear && temp >= 12) {
    activities.push("🏃 Hızlı keşif (Koşu) için uygun termal denge");
    activities.push("📸 Optik kayıtlar (Fotoğraf) için mükemmel foton yayılımı");
  } else if (temp < 5) {
    activities.push("☕ Üs içinde sıcak enerji dolumu");
    activities.push("🎮 Sanal gerçeklik veya oyun sistemlerine geçiş");
  } else {
    activities.push("🌤️ Yüzey taraması için makul atmosfer şartları");
    activities.push("🛍️ Kaynak toplama görevi (Alışveriş)");
  }

  // ── Uyarılar ──────────────────────────────────────────────────────────────
  const alerts: string[] = [];

  if (isRainy || isStormy) {
    alerts.push("🛡️ Enerji kalkanı (Şemsiye/Yağmurluk) donatmayı unutma.");
  }
  if (isSnowy) {
    alerts.push("⚠️ Zemin sürtünmesi düşük. Stabilite sistemlerini kontrol et.");
  }
  if (uv >= 11) {
    alerts.push("☢️ RADYASYON UYARISI: UV İndeksi Tehlikeli Boyutta! Dışarı çıkma.");
  } else if (uv >= 8) {
    alerts.push("☢️ UV İndeksi Yüksek: Level 50+ nano-krem uygulayın.");
  } else if (uv >= 6) {
    alerts.push("☀️ Solar radyasyon orta seviyede, kalkan kullanın.");
  }
  if (uv >= 6 && isClear) {
    alerts.push("🕶️ Optik filtre (Güneş Gözlüğü) tavsiye edilir.");
  }
  if (wind >= 60) {
    alerts.push("🌪️ KASIRGA RİSKİ: Rüzgar hızı kritik seviyeyi aştı!");
  } else if (wind >= 40) {
    alerts.push("💨 Yüksek türbülans: Dış görevleri ertelemeyi düşün.");
  }
  if (temp > 35) {
    alerts.push("🔥 Çekirdek Erime Riski: Aşırı sıcak. Derhal soğutucu sıvı al!");
  } else if (temp > 30) {
    alerts.push("💧 Yüksek sıcaklık: Hidrasyon seviyelerini koru.");
  }
  if (effective < -5) {
    alerts.push("🧊 Sistem Donma Riski: Organik yapılar için tehlikeli ısı düşüşü.");
  }
  if (isFoggy) {
    alerts.push("🌫️ Sensör Arızası: Yoğun sis sebebiyle navigasyon kısıtlı.");
  }

  return { clothing, activities, alerts };
}

/**
 * Hava verilerinden doğal Türkçe hava yorumu üretir.
 * Tamamen algoritmik — dış API gerektirmez.
 * Her çağırda şablonlar arasından farklı seçenekler sunulur.
 */
export function generateWeatherStory(weather: WeatherResult): string {
  const { current, daily, location } = weather;
  const city = location.name;
  const code = current.weatherCode;
  const temp = Math.round(current.temperature);
  const feels = Math.round(current.apparentTemperature);
  const humidity = current.humidity;
  const wind = Math.round(current.windSpeed);
  const today = daily[0];
  const tomorrow = daily[1];
  const uv = today?.uvIndex ?? 0;

  // Rastgele şablon seçimi
  const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

  // Hava kategorileri
  const isStormy = code >= 95;
  const isSnowy = !isStormy && code >= 71 && code <= 86;
  const isRainy =
    !isStormy &&
    !isSnowy &&
    ((code >= 51 && code <= 67) || (code >= 80 && code <= 99));
  const isFoggy = code === 45 || code === 48;
  const isClear = code <= 1;
  const isCloudy = code === 3;

  // ── 1. Cümle: Ana durum + sıcaklık ───────────────────────────
  let s1: string;
  if (isStormy) {
    s1 = pick([
      `⚡ SİSTEM ALARMI: ${city} sektöründe yüksek voltajlı fırtına döngüsü tespit edildi.`,
      `⛈️ ${city} atmosferinde gök gürültülü fırtına reaksiyonları izleniyor, dikkatli olun.`,
    ]);
  } else if (isSnowy) {
    s1 = pick([
      `❄️ ${city} koordinatlarında buzlanma var, sıcaklık ${temp}° seviyesine geriledi.`,
      `🧊 ${city} bölgesinde kar tanesi anomalisine rastlandı! Yüzey kaygan.`,
    ]);
  } else if (isRainy) {
    s1 = pick([
      `☔ ${city} sektörüne sıvı yağışı düşüyor, kalkanlarınızı aktif edin.`,
      `🌧️ Sistem ${city} için ${temp}° ile yağmurlu bir döngü öngörüyor.`,
      `💧 ${city} atmosferi nem yüklü, sıvı partikül tespiti aktif.`,
    ]);
  } else if (isFoggy) {
    s1 = pick([
      `🌫️ ${city} üzerinde yoğun buhar tabakası var, görüş sensörleri kısıtlandı.`,
      `☁️ Sistem ${city} bölgesinde sis tabakası raporluyor. İlerlerken dikkat edin.`,
    ]);
  } else if (isClear && temp >= 32) {
    s1 = pick([
      `🔥 ${city} çekirdeğinde aşırı ısınma! Termal sensörler ${temp}° ile kırmızı seviyede.`,
      `☀️ ${city} koordinatlarında kavurucu yıldız radyasyonu — ${temp}° sistemleri zorlayacak.`,
    ]);
  } else if (isClear && temp >= 24) {
    s1 = pick([
      `🌟 ${city} yıldızı optimal ışınım yapıyor! Bugün koşullar kusursuz.`,
      `☀️ ${city} yüzeyinde ${temp}° ile net bir güneş enerjisi döngüsü yaşanıyor.`,
      `🌌 Yapay Zeka Onayı: ${city} üzerinde çok dengeli ve açık bir hava var.`,
    ]);
  } else if (isClear && temp >= 15) {
    s1 = pick([
      `🌤️ ${city} atmosferi net, ancak termal okumalar ${temp}° ile serin.`,
      `🚀 ${city} için operasyon onayı verildi — açık hava, ${temp}° sıcaklık.`,
    ]);
  } else if (isClear) {
    s1 = pick([
      `🌌 ${city} üzerinde bulut örtüsü yok ama sıcaklık kritik derecede soğuk (${temp}°).`,
      `❄️ Yıldız parlıyor ancak ısı yaymıyor. ${city}'de soğuk bir uzay havası var!`,
    ]);
  } else if (isCloudy) {
    s1 = pick([
      `☁️ ${city} göklerinde yoğun bulut kümeleri var, güneş bloklanıyor (${temp}°).`,
      `🛸 ${city} atmosferi gri kütlelerle örtülü, sıcaklık stabil (${temp}°).`,
    ]);
  } else {
    s1 = pick([
      `⛅ ${city} üzerinde ${temp}° ile stabil olmayan parçalı bulut tabakası var.`,
      `🛰️ Atmosfer taraması: ${city} bölgesinde değişen bulut oluşumları gözlemleniyor.`,
    ]);
  }

  // ── 2. Cümle: Dikkat çekici detay ─────────────────────────────────
  const details: string[] = [];

  if (feels < temp - 4) {
    details.push(
      pick([
        `🌬️ Dinamik rüzgar faktörü sıcaklığı ${feels}° gibi hissettirecek.`,
        `🥶 Biyolojik algı seviyesi: ${feels}° (Rüzgar soğutması devrede).`,
      ])
    );
  } else if (feels > temp + 4) {
    details.push(
      pick([
        `🔥 Atmosferik nem, biyosferde ${feels}° gibi baskıcı bir etki yaratıyor.`,
        `💧 Sera etkisi: Termal hissiyat ${feels}° seviyesinde.`,
      ])
    );
  }

  if (uv >= 8 && isClear) {
    details.push(pick([`☢️ Radyasyon yoğunluğu kritik! Nano-kalkan (güneş kremi) kullan.`, `☀️ Solar alevlenme seviyesi ${Math.round(uv)} — SPF zırhı zorunlu.`]));
  } else if (uv >= 6 && isClear) {
    details.push(`🕶️ Yüksek UV tespiti, optik filtreleri aktif et.`);
  }

  if (wind >= 45) {
    details.push(`🌪️ Kinetik rüzgar akımları ${wind} km/s hıza ulaştı.`);
  }

  if (humidity >= 82 && !isRainy && !isSnowy) {
    details.push(`💧 Nem %${humidity} seviyesinde, hava partiküllerinde yoğunlaşma yüksek.`);
  }

  if (temp > 33) {
    details.push(`🚰 Sistem Uyarısı: Sıcak çarpması (System Overheat) riski! Sıvı ikmali yapın.`);
  }

  const s2 = details.length > 0 ? details[0] : null;

  // ── 3. Cümle: Yarın öngörüsü ─────────────────────────────────────
  let s3: string | null = null;
  if (tomorrow) {
    const tc = tomorrow.weatherCode;
    const tMax = Math.round(tomorrow.tempMax);
    const tIsRainy =
      (tc >= 51 && tc <= 67) || (tc >= 80 && tc <= 99);
    const tIsSnowy = tc >= 71 && tc <= 86;
    const tIsClear = tc <= 1;
    const diff = tomorrow.tempMax - (today?.tempMax ?? temp);

    if (tIsRainy && !isRainy) {
      s3 = pick([
        `☔ Yarınki döngüde sıvı yağışı olasılığı %100, hazırlıklı olun.`,
        `🌧️ Gelecek rotasyon yağmur getiriyor.`,
      ]);
    } else if (tIsSnowy && !isSnowy) {
      s3 = `❄️ Gelecek döngüde kar fırtınası hesaplanıyor!`;
    } else if (tIsClear && (isRainy || isCloudy || isStormy)) {
      s3 = pick([
        `✨ Analiz: Yarın bulut örtüsü dağılıyor! Termal okumalar ${tMax}° seviyesine çıkacak.`,
        `🚀 Uzay durumu: Yarın yıldız tekrar parlayacak.`,
      ]);
    } else if (diff >= 6) {
      s3 = `🔥 Simülasyon, yarın ${tMax}° ile ciddi bir ısı artışı öngörüyor.`;
    } else if (diff <= -6) {
      s3 = `🧊 Yarın gezegen serinleyecek, maksimum ısı ${tMax}° hesaplandı.`;
    }
  }

  return [s1, s2, s3].filter(Boolean).join(" ");
}

/**
 * Gün doğumu/batımı ISO string'ini "06:23" formatına çevirir.
 */
export function formatSunTime(isoString: string | undefined): string {
  if (!isoString) return "—";
  try {
    const d = new Date(isoString);
    return d.toLocaleTimeString("tr-TR", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch {
    return "—";
  }
}
