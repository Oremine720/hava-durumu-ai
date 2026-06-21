// Open-Meteo tabanlı hava durumu veri katmanı. API anahtarı gerektirmez.
// Dokümanlar: https://open-meteo.com/en/docs

import { TTLCache } from "./cache";
import { TR_PROVINCES } from "./tr-cities";

// ─── Tipler ──────────────────────────────────────────────────────────────────

export type GeoLocation = {
  name: string;
  latitude: number;
  longitude: number;
  country?: string;
  admin1?: string;
  admin2?: string;
};

export type CurrentWeather = {
  temperature: number;
  apparentTemperature: number;
  humidity: number;
  windSpeed: number;
  /** Rüzgar yönü (derece, 0-360). */
  windDirection: number;
  weatherCode: number;
};

export type DailyForecast = {
  date: string;
  weatherCode: number;
  tempMax: number;
  tempMin: number;
  /** Günün maksimum UV indeksi. */
  uvIndex: number;
  /** Gün doğumu saati (ISO string, yerel saat). */
  sunrise: string;
  /** Gün batımı saati (ISO string, yerel saat). */
  sunset: string;
};

export type HourlyForecast = {
  time: string;
  label: string;
  temperature: number;
  weatherCode: number;
};

export type WeatherResult = {
  location: GeoLocation;
  current: CurrentWeather;
  /**
   * Günlük saatlik veriler: hourlyByDay[i] → daily[i] günü için 24 saat.
   * Bugün (index 0) için geçerli saat "Şimdi" olarak etiketlenir.
   */
  hourlyByDay: HourlyForecast[][];
  daily: DailyForecast[];
};

// ─── Sabitler ────────────────────────────────────────────────────────────────

const GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search";
const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";

/** Öneriler listesinde tek bir il için gösterilecek maksimum ilçe sayısı.
 *  UX: İstanbul gibi büyük şehirlerde listenin çok uzamasını önler. */
const MAX_DISTRICTS_PER_PROVINCE = 8;

/** Aynı koordinat 10 dakika içinde yeniden sorgulanırsa API'ye gidilmez. */
const forecastCache = new TTLCache<WeatherResult>(10 * 60 * 1000);

// ─── Geocoding ───────────────────────────────────────────────────────────────

/** Şehir adından konum bilgisi (tek sonuç, geocoding). */
export async function geocodeCity(city: string): Promise<GeoLocation> {
  const query = city.trim();
  if (!query) {
    throw new Error("Lütfen bir şehir adı girin.");
  }

  const geoRes = await fetch(
    `${GEOCODE_URL}?name=${encodeURIComponent(query)}&count=1&language=tr&format=json`
  );
  if (!geoRes.ok) {
    throw new Error("Konum servisine ulaşılamadı.");
  }
  const geoJson = await geoRes.json();
  const place = geoJson?.results?.[0];
  if (!place) {
    throw new Error(`"${query}" için sonuç bulunamadı.`);
  }

  return {
    name: place.name,
    latitude: place.latitude,
    longitude: place.longitude,
    country: place.country,
    admin1: place.admin1,
  };
}

/** Şehir/ilçe araması için çoklu sonuç (autocomplete). */
export async function searchCities(query: string): Promise<GeoLocation[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const res = await fetch(
    `${GEOCODE_URL}?name=${encodeURIComponent(q)}&count=10&language=tr&format=json`
  );
  if (!res.ok) return [];
  const json = await res.json();

  return ((json.results ?? []) as Record<string, unknown>[]).map((p) => ({
    name: p.name as string,
    latitude: p.latitude as number,
    longitude: p.longitude as number,
    admin1: p.admin1 as string | undefined,
    admin2: p.admin2 as string | undefined,
    country: p.country as string | undefined,
  }));
}

// ─── Yerel Türkiye Araması ───────────────────────────────────────────────────

/** Türkçe arama için harf normalleştirme (büyük/küçük + aksan). */
function normalizeTr(s: string): string {
  return s
    .toLocaleLowerCase("tr")
    .replace(/ı/g, "i")
    .replace(/ş/g, "s")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .trim();
}

/**
 * Yerleşik Türkiye il/ilçe veri setinde ara.
 * - İl adı eşleşirse: il merkezi + MAX_DISTRICTS_PER_PROVINCE ilçesi.
 * - Eşleşme yoksa: ilçe adlarında arar.
 */
export function searchLocalTR(query: string): GeoLocation[] {
  const q = normalizeTr(query);
  if (q.length < 2) return [];

  const out: GeoLocation[] = [];

  for (const prov of TR_PROVINCES) {
    if (normalizeTr(prov.name).startsWith(q)) {
      // İl merkezi en başa
      out.push({
        name: prov.name,
        latitude: prov.lat,
        longitude: prov.lon,
        admin1: prov.name,
        admin2: "Merkez",
        country: "Türkiye",
      });
      // FIX: Tüm ilçeleri değil, MAX_DISTRICTS_PER_PROVINCE kadarını ekle.
      const limited = prov.districts.slice(0, MAX_DISTRICTS_PER_PROVINCE);
      for (const d of limited) {
        out.push({
          name: d.name,
          latitude: d.lat,
          longitude: d.lon,
          admin1: prov.name,
          country: "Türkiye",
        });
      }
    }
  }

  // İl adı eşleşmediyse ilçe adlarında ara.
  if (out.length === 0) {
    for (const prov of TR_PROVINCES) {
      for (const d of prov.districts) {
        if (normalizeTr(d.name).startsWith(q)) {
          out.push({
            name: d.name,
            latitude: d.lat,
            longitude: d.lon,
            admin1: prov.name,
            country: "Türkiye",
          });
        }
      }
    }
  }

  return out;
}

/** Önce yerel TR veri seti; sonuç yoksa dünya geneli Open-Meteo. */
export async function searchPlaces(query: string): Promise<GeoLocation[]> {
  const local = searchLocalTR(query);
  if (local.length > 0) return local.slice(0, 20);
  return searchCities(query);
}

// ─── Etiket Yardımcıları ─────────────────────────────────────────────────────

/** Açılır listede/kartta gösterilecek tam adres etiketi. */
export function locationLabel(loc: GeoLocation): string {
  return [loc.name, loc.admin1, loc.country].filter(Boolean).join(", ");
}

/** Sadece bölge satırı (ad hariç): "Samsun İli, Türkiye". */
export function regionLabel(loc: GeoLocation): string {
  return [loc.admin2, loc.admin1, loc.country]
    .filter((part) => part && part !== loc.name)
    .join(", ");
}

// ─── Geocoding (Koordinat → İsim) ────────────────────────────────────────────

/**
 * Koordinattan yer adı (reverse geocoding). Web + native'de çalışır, key gerekmez.
 * FIX: 5 saniyelik AbortController timeout eklendi.
 *      Timeout veya hata durumunda koordinatla devam eder, uygulama çökmez.
 */
export async function reverseGeocode(
  latitude: number,
  longitude: number
): Promise<GeoLocation> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=tr`,
      { signal: controller.signal }
    );
    clearTimeout(timeoutId);

    if (!res.ok) {
      return { name: "Konumum", latitude, longitude };
    }
    const j = await res.json();
    const name: string =
      j.city || j.locality || j.principalSubdivision || "Konumum";
    return {
      name,
      latitude,
      longitude,
      admin1: j.principalSubdivision || undefined,
      country: j.countryName || undefined,
    };
  } catch {
    // Timeout (AbortError) veya ağ hatası: koordinatla devam et.
    clearTimeout(timeoutId);
    return { name: "Konumum", latitude, longitude };
  }
}

// ─── Hava Durumu Verisi ───────────────────────────────────────────────────────

/**
 * Koordinattan hava durumu + tüm günlerin saatlik + 7 günlük tahmin.
 * Cache destekli: aynı koordinat 10 dakika içinde tekrar sorgulanmaz.
 */
export async function fetchForecast(
  location: GeoLocation
): Promise<WeatherResult> {
  // Cache anahtarı: lat/lon 2 ondalık → ~1 km hassasiyet
  const key = `${location.latitude.toFixed(2)},${location.longitude.toFixed(2)}`;
  const cached = forecastCache.get(key);
  if (cached) {
    // Koordinat aynı, ama konum adı farklı olabilir (ör. favori vs arama).
    return { ...cached, location };
  }

  const params = new URLSearchParams({
    latitude: String(location.latitude),
    longitude: String(location.longitude),
    current:
      "temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m",
    hourly: "temperature_2m,weather_code",
    daily: "weather_code,temperature_2m_max,temperature_2m_min,uv_index_max,sunrise,sunset",
    timezone: "auto",
    forecast_days: "7",
  });

  const wxRes = await fetch(`${FORECAST_URL}?${params.toString()}`);
  if (!wxRes.ok) {
    throw new Error("Hava durumu verisi alınamadı.");
  }
  const wx = await wxRes.json();

  const current: CurrentWeather = {
    temperature: wx.current.temperature_2m,
    apparentTemperature: wx.current.apparent_temperature,
    humidity: wx.current.relative_humidity_2m,
    windSpeed: wx.current.wind_speed_10m,
    windDirection: wx.current.wind_direction_10m ?? 0,
    weatherCode: wx.current.weather_code,
  };

  const allTimes = wx.hourly.time as string[];
  const allTemps = wx.hourly.temperature_2m as (number | null)[];
  const allCodes = wx.hourly.weather_code as (number | null)[];
  const now = wx.current.time as string;
  // Geçerli saati tespit et (ör. "2025-06-21T14" → prefix ile eşleştirme)
  const nowHourPrefix = now.slice(0, 13);

  // Her gün için saatlik verileri grupla.
  // FIX: Array sınır kontrolü — idx bounds aşımında 0 fallback.
  const hourlyByDay: HourlyForecast[][] = (wx.daily.time as string[]).map(
    (date, dayIdx) =>
      allTimes.reduce<HourlyForecast[]>((acc, time, i) => {
        if (time.startsWith(date)) {
          const isNowHour =
            dayIdx === 0 && time.slice(0, 13) === nowHourPrefix;
          acc.push({
            time,
            label: isNowHour ? "Şimdi" : time.slice(11, 16),
            temperature: allTemps[i] ?? 0,
            weatherCode: allCodes[i] ?? 0,
          });
        }
        return acc;
      }, [])
  );

  const daily: DailyForecast[] = (wx.daily.time as string[]).map((date, i) => ({
    date,
    weatherCode: wx.daily.weather_code[i] ?? 0,
    tempMax: wx.daily.temperature_2m_max[i] ?? 0,
    tempMin: wx.daily.temperature_2m_min[i] ?? 0,
    uvIndex: wx.daily.uv_index_max[i] ?? 0,
    sunrise: (wx.daily.sunrise as string[])[i] ?? "",
    sunset: (wx.daily.sunset as string[])[i] ?? "",
  }));

  const result: WeatherResult = { location, current, hourlyByDay, daily };
  forecastCache.set(key, result);
  return result;
}

/** Şehir adından doğrudan hava durumu (geocode + forecast). */
export async function fetchWeather(city: string): Promise<WeatherResult> {
  const location = await geocodeCity(city);
  return fetchForecast(location);
}

// ─── WMO Kod Çevirisi ─────────────────────────────────────────────────────────

const WEATHER_CODES: Record<number, { label: string; emoji: string }> = {
  0: { label: "Açık", emoji: "☀️" },
  1: { label: "Az bulutlu", emoji: "🌤️" },
  2: { label: "Parçalı bulutlu", emoji: "⛅" },
  3: { label: "Bulutlu", emoji: "☁️" },
  45: { label: "Sisli", emoji: "🌫️" },
  48: { label: "Kırağılı sis", emoji: "🌫️" },
  51: { label: "Hafif çisenti", emoji: "🌦️" },
  53: { label: "Çisenti", emoji: "🌦️" },
  55: { label: "Yoğun çisenti", emoji: "🌦️" },
  56: { label: "Dondurucu çisenti", emoji: "🌧️" },
  57: { label: "Yoğun dondurucu çisenti", emoji: "🌧️" },
  61: { label: "Hafif yağmur", emoji: "🌧️" },
  63: { label: "Yağmurlu", emoji: "🌧️" },
  65: { label: "Şiddetli yağmur", emoji: "🌧️" },
  66: { label: "Dondurucu yağmur", emoji: "🌧️" },
  67: { label: "Şiddetli dondurucu yağmur", emoji: "🌧️" },
  71: { label: "Hafif kar", emoji: "🌨️" },
  73: { label: "Karlı", emoji: "🌨️" },
  75: { label: "Yoğun kar", emoji: "❄️" },
  77: { label: "Kar taneleri", emoji: "🌨️" },
  80: { label: "Hafif sağanak", emoji: "🌦️" },
  81: { label: "Sağanak", emoji: "🌦️" },
  82: { label: "Şiddetli sağanak", emoji: "⛈️" },
  85: { label: "Hafif kar sağanağı", emoji: "🌨️" },
  86: { label: "Yoğun kar sağanağı", emoji: "🌨️" },
  95: { label: "Gök gürültülü fırtına", emoji: "⛈️" },
  96: { label: "Dolulu fırtına", emoji: "⛈️" },
  99: { label: "Şiddetli dolulu fırtına", emoji: "⛈️" },
};

export function describeWeather(code: number): { label: string; emoji: string } {
  return WEATHER_CODES[code] ?? { label: "Bilinmiyor", emoji: "❓" };
}

// ─── Tarih / Yön Yardımcıları ─────────────────────────────────────────────────

const WEEKDAYS = ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"];

/**
 * "2025-06-21" → "Cmt"
 * FIX: "T12:00:00" eklenerek UTC yerine yerel saat yorumu sağlanır.
 *      UTC+3'te gece yarısı yakınında yanlış gün gösterme hatası düzeltildi.
 */
export function weekdayLabel(dateStr: string): string {
  const day = new Date(dateStr + "T12:00:00").getDay();
  return WEEKDAYS[day] ?? "";
}

/**
 * Derece cinsinden rüzgar yönünü kısa metin + ok'a çevirir.
 * 0/360° = Kuzey, 90° = Doğu, 180° = Güney, 270° = Batı.
 */
export function windDirectionLabel(deg: number): string {
  const dirs = ["K↑", "KD↗", "D→", "GD↘", "G↓", "GB↙", "B←", "KB↖"];
  const idx = Math.round(((deg % 360) + 360) % 360 / 45) % 8;
  return dirs[idx] ?? "—";
}

// ─── Görsel Yardımcıları ──────────────────────────────────────────────────────

/**
 * UV indeksine göre risk seviyesi ve renk döner.
 * WHO standartlarına göre sınıflandırma.
 */
export function uvRiskLabel(uv: number): { label: string; color: string } {
  if (uv < 3) return { label: "Düşük", color: "#4caf50" };
  if (uv < 6) return { label: "Orta", color: "#ff9800" };
  if (uv < 8) return { label: "Yüksek", color: "#f44336" };
  if (uv < 11) return { label: "Çok Yüksek", color: "#9c27b0" };
  return { label: "Aşırı", color: "#b71c1c" };
}

/**
 * Hava durumu + günün saatine göre arka plan gradyanı (yukarıdan aşağıya).
 * WMO kodu → hava türü; saat → günün dilimi.
 */
export function skyGradient(
  code: number,
  hour: number
): readonly [string, string, string] {
  const rainy = (code >= 51 && code <= 67) || (code >= 80 && code <= 99);
  const snowy = code >= 71 && code <= 86;
  const foggy = code === 45 || code === 48;
  const cloudy = code === 2 || code === 3;

  // Uzay ve AI teması: Derin karanlık tonlar ve neon parlamalar.
  if (snowy) {
    return ["#0f172a", "#1e1b4b", "#083344"]; // Cyber kış
  }
  if (rainy) {
    return ["#0a0a0a", "#171717", "#1e1b4b"]; // Dijital yağmur
  }
  if (foggy) {
    return ["#111827", "#1e293b", "#334155"]; // Siyah sis
  }
  if (cloudy) {
    return ["#0f0c29", "#302b63", "#24243e"]; // Mor nebula
  }

  // Varsayılan derin uzay (Açık hava / Yapay zeka tabanı)
  return ["#000000", "#0f0c29", "#11001c"]; // Derinlik ve teknoloji
}
