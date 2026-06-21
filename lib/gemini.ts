// Gemini 2.0 Flash ile doğal dil hava durumu yorumu.
// API anahtarı .env dosyasından alınır (EXPO_PUBLIC_ ön eki ile bundle'a dahil edilir).

const API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY ?? "";
const MODEL = "gemini-2.0-flash";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`;

export interface WeatherSummaryInput {
  city: string;
  temp: number;
  feelsLike: number;
  condition: string;
  humidity: number;
  windSpeed: number;
  windDir: string;
  uvIndex: number;
  tempMax: number;
  tempMin: number;
  nextDays: Array<{ day: string; condition: string; max: number; min: number }>;
  hour: number;
}

/**
 * Hava durumu verilerini Gemini'ye gönderir, doğal Türkçe yorum alır.
 * Maksimum 150 token (~2-3 cümle).
 */
export async function getWeatherSummary(
  input: WeatherSummaryInput
): Promise<string> {
  if (!API_KEY) {
    throw new Error("Gemini API anahtarı bulunamadı. .env dosyasını kontrol edin.");
  }

  const {
    city,
    temp,
    feelsLike,
    condition,
    humidity,
    windSpeed,
    windDir,
    uvIndex,
    tempMax,
    tempMin,
    nextDays,
    hour,
  } = input;

  const greeting =
    hour < 12 ? "sabah" : hour < 18 ? "öğleden sonra" : "akşam";
  const nextStr = nextDays
    .map((d) => `${d.day}: ${d.condition}, ${Math.round(d.max)}°/${Math.round(d.min)}°`)
    .join("; ");

  const prompt = `Sen samimi ve yardımsever bir Türk hava durumu asistanısın. \
Aşağıdaki hava verisine bakarak kısa, anlaşılır ve doğal bir Türkçe özet yaz. \
Maksimum 2-3 kısa cümle. Gerektiğinde emoji kullan. Teknik jargondan kaçın, günlük dil kullan.

Şehir: ${city}
Saat: ${greeting} (${hour}:00)
Sıcaklık: ${Math.round(temp)}°C (Hissedilen: ${Math.round(feelsLike)}°C)
Hava: ${condition}
Nem: %${humidity}
Rüzgar: ${Math.round(windSpeed)} km/s, yön: ${windDir}
Günlük max/min: ${Math.round(tempMax)}°/${Math.round(tempMin)}°
UV indeksi: ${Math.round(uvIndex)}
Sonraki günler: ${nextStr}

Özet:`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: 150,
          temperature: 0.75,
        },
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({})) as Record<string, unknown>;
      const msg = (errJson?.error as Record<string, unknown>)?.message;
      throw new Error(
        typeof msg === "string" ? msg : `API hatası (${res.status})`
      );
    }

    const json = await res.json();
    const text: string =
      json?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    return text.trim();
  } catch (e) {
    clearTimeout(timeoutId);
    throw e;
  }
}
