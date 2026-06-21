import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { formatSunTime, generateWeatherStory, getSuggestions } from "@/lib/suggestions";
import {
  describeWeather,
  fetchForecast,
  fetchWeather,
  regionLabel,
  reverseGeocode,
  searchPlaces,
  skyGradient,
  uvRiskLabel,
  weekdayLabel,
  windDirectionLabel,
  type GeoLocation,
  type WeatherResult,
} from "@/lib/weather";

// ─── Favori yardımcıları ──────────────────────────────────────────────────────

const FAVORITES_KEY = "@hava-durumu:favorites";

async function loadFavoritesFromStorage(): Promise<GeoLocation[]> {
  try {
    const raw = await AsyncStorage.getItem(FAVORITES_KEY);
    return raw ? (JSON.parse(raw) as GeoLocation[]) : [];
  } catch {
    return [];
  }
}

async function saveFavoritesToStorage(favs: GeoLocation[]): Promise<void> {
  try {
    await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(favs));
  } catch {}
}

// ─── Ana Ekran ────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const [city, setCity] = useState("");
  const [suggestions, setSuggestions] = useState<GeoLocation[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [permDenied, setPermDenied] = useState(false);
  const [weather, setWeather] = useState<WeatherResult | null>(null);
  const [favorites, setFavorites] = useState<GeoLocation[]>([]);
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);

  // Hava verisi state'i
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiLoading] = useState(false);
  const [aiError] = useState<string | null>(null);

  const skipSearch = useRef(false);

  // Favorileri yükle
  useEffect(() => {
    loadFavoritesFromStorage().then(setFavorites);
  }, []);

  const toggleFavorite = useCallback((place: GeoLocation) => {
    setFavorites((prev) => {
      const exists = prev.some(
        (f) => f.latitude === place.latitude && f.longitude === place.longitude
      );
      const next: GeoLocation[] = exists
        ? prev.filter(
            (f) =>
              f.latitude !== place.latitude || f.longitude !== place.longitude
          )
        : [
            ...prev,
            {
              name: place.name,
              latitude: place.latitude,
              longitude: place.longitude,
              admin1: place.admin1,
              country: place.country,
            },
          ];
      saveFavoritesToStorage(next);
      return next;
    });
  }, []);

  const isFavorite = (place: GeoLocation) =>
    favorites.some(
      (f) => f.latitude === place.latitude && f.longitude === place.longitude
    );

  // Hava verisi değişince yerel algoritmayla yorum üret (anlık, API gerekmez)
  const fetchAiSummary = useCallback((w: WeatherResult) => {
    setAiSummary(generateWeatherStory(w));
  }, []);

  // Debounced arama
  useEffect(() => {
    if (skipSearch.current) {
      skipSearch.current = false;
      return;
    }
    const q = city.trim();
    if (q.length < 2) {
      setSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        setSuggestions(await searchPlaces(q));
      } catch {
        setSuggestions([]);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [city]);

  const loadForecastForPlace = async (place: GeoLocation) => {
    Keyboard.dismiss();
    skipSearch.current = true;
    setCity(place.name);
    setSuggestions([]);
    setLoading(true);
    setStatus("Hava durumu alınıyor…");
    setError(null);
    setPermDenied(false);
    setSelectedDayIndex(0);
    setAiSummary(null);
    try {
      const result = await fetchForecast(place);
      setWeather(result);
      fetchAiSummary(result);
    } catch (e) {
      setWeather(null);
      setError(e instanceof Error ? e.message : "Bir hata oluştu.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (suggestions.length > 0) {
      loadForecastForPlace(suggestions[0]);
      return;
    }
    Keyboard.dismiss();
    setLoading(true);
    setStatus("Hava durumu alınıyor…");
    setError(null);
    setPermDenied(false);
    setSelectedDayIndex(0);
    setAiSummary(null);
    try {
      const result = await fetchWeather(city);
      setWeather(result);
      fetchAiSummary(result);
    } catch (e) {
      setWeather(null);
      setError(e instanceof Error ? e.message : "Bir hata oluştu.");
    } finally {
      setLoading(false);
    }
  };

  const loadByLocation = useCallback(async () => {
    setSuggestions([]);
    setLoading(true);
    setStatus("Konumunuz alınıyor…");
    setError(null);
    setPermDenied(false);
    setSelectedDayIndex(0);
    setAiSummary(null);
    try {
      const { status: perm } =
        await Location.requestForegroundPermissionsAsync();
      if (perm !== "granted") {
        setPermDenied(true);
        setError(
          "Konum izni verilmedi. Bir şehir arayabilir veya aşağıdan ayarları açabilirsiniz."
        );
        return;
      }
      const locationPromise = Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(
          () =>
            reject(new Error("Konum alınamadı (zaman aşımı). Lütfen şehir arayın.")),
          10000
        )
      );
      const pos = await Promise.race([locationPromise, timeoutPromise]);
      const place = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
      setStatus("Hava durumu alınıyor…");
      const result = await fetchForecast(place);
      setWeather(result);
      fetchAiSummary(result);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Konum alınamadı. Lütfen bir şehir arayın."
      );
    } finally {
      setLoading(false);
    }
  }, [fetchAiSummary]);

  useEffect(() => {
    loadByLocation();
  }, [loadByLocation]);

  const hour = new Date().getHours();
  const colors = weather
    ? skyGradient(weather.current.weatherCode, hour)
    : skyGradient(0, hour);

  const currentPlace = weather?.location ?? null;

  return (
    <LinearGradient colors={colors} style={S.fill}>
      <StatusBar style="light" />
      <SafeAreaView style={S.fill} edges={["top", "bottom"]}>
        <ScrollView
          contentContainerStyle={S.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Başlık */}
          <View style={S.header}>
            <Text style={S.appLabel}>HAVA DURUMU</Text>
            <TouchableOpacity
              style={S.locateBtn}
              onPress={loadByLocation}
              disabled={loading}
            >
              <Text style={S.locateIcon}>🛰️</Text>
            </TouchableOpacity>
          </View>

          {/* Arama */}
          <View style={S.searchRow}>
            <TextInput
              style={S.input}
              placeholder="Şehir veya ilçe ara…"
              placeholderTextColor="rgba(255,255,255,0.55)"
              value={city}
              onChangeText={setCity}
              onSubmitEditing={handleSubmit}
              returnKeyType="search"
              autoCorrect={false}
            />
            <TouchableOpacity
              style={[S.searchBtn, loading && S.searchBtnDisabled]}
              onPress={handleSubmit}
              disabled={loading}
            >
              <Text style={S.searchBtnText}>Ara</Text>
            </TouchableOpacity>
          </View>

          {/* Favoriler */}
          {favorites.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={S.favRow}
            >
              {favorites.map((fav) => {
                const active =
                  currentPlace?.latitude === fav.latitude &&
                  currentPlace?.longitude === fav.longitude;
                return (
                  <TouchableOpacity
                    key={`${fav.latitude},${fav.longitude}`}
                    style={[S.favChip, active && S.favChipActive]}
                    onPress={() => loadForecastForPlace(fav)}
                  >
                    <Text style={[S.favChipText, active && S.favChipTextActive]}>
                      {active ? "★" : "☆"} {fav.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          {/* Autocomplete */}
          {suggestions.length > 0 && (
            <View style={S.dropdown}>
              {suggestions.map((place, i) => (
                <TouchableOpacity
                  key={`${place.latitude},${place.longitude},${i}`}
                  style={[S.dropdownRow, i < suggestions.length - 1 && S.dropdownDivider]}
                  onPress={() => loadForecastForPlace(place)}
                >
                  <Text style={S.dropdownName}>{place.name}</Text>
                  <Text style={S.dropdownSub} numberOfLines={1}>
                    {regionLabel(place)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Yükleniyor */}
          {loading && (
            <View style={S.loadingWrap}>
              <ActivityIndicator size="large" color="rgba(255,255,255,0.9)" />
              <Text style={S.loadingText}>{status}</Text>
            </View>
          )}

          {/* Hata */}
          {!loading && error && (
            <View style={S.errorWrap}>
              <Text style={S.errorText}>⚠️ SİSTEM HATASI: {error}</Text>
              {permDenied && (
                <TouchableOpacity
                  style={S.settingsBtn}
                  onPress={() => Linking.openSettings()}
                >
                  <Text style={S.settingsBtnText}>⚙️ SİSTEM AYARLARI</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Anlık kart */}
          {!loading && weather && (
            <CurrentCard
              weather={weather}
              isFav={isFavorite(weather.location)}
              onToggleFav={() => toggleFavorite(weather.location)}
            />
          )}

          {/* ✨ AI Asistan Kartı */}
          {!loading && weather && (
            <AiCard
              summary={aiSummary}
              loading={aiLoading}
              error={aiError}
              onRetry={() => weather && fetchAiSummary(weather)}
            />
          )}

          {/* 🌅 Gün Doğumu / Batımı */}
          {!loading && weather && (
            <SunCard today={weather.daily[0]} />
          )}

          {/* 👗 Kıyafet & Aktivite Önerileri */}
          {!loading && weather && (
            <SuggestionsCard weather={weather} />
          )}

          {/* Saatlik + Gün seçici */}
          {!loading && weather && (
            <HourlySection
              weather={weather}
              selectedDayIndex={selectedDayIndex}
              onSelectDay={setSelectedDayIndex}
            />
          )}

          {/* 7 günlük tahmin */}
          {!loading && weather && (
            <DailySection
              weather={weather}
              selectedDayIndex={selectedDayIndex}
              onSelectDay={setSelectedDayIndex}
            />
          )}
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

// ─── Anlık Kart ───────────────────────────────────────────────────────────────

function CurrentCard({
  weather,
  isFav,
  onToggleFav,
}: {
  weather: WeatherResult;
  isFav: boolean;
  onToggleFav: () => void;
}) {
  const { location, current } = weather;
  const info = describeWeather(current.weatherCode);
  const windDir = windDirectionLabel(current.windDirection);
  const place = [
    location.name,
    location.admin1 !== location.name ? location.admin1 : null,
    location.country,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <View style={S.currentCard}>
      <TouchableOpacity
        style={S.favBtn}
        onPress={onToggleFav}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      >
        <Text style={[S.favIcon, isFav && S.favIconActive]}>
          {isFav ? "★" : "☆"}
        </Text>
      </TouchableOpacity>
      <Text style={S.placeName} numberOfLines={2}>{place}</Text>
      <Text style={S.heroEmoji}>{info.emoji}</Text>
      <Text style={S.heroTemp}>{Math.round(current.temperature)}°</Text>
      <View style={S.conditionBadge}>
        <Text style={S.conditionText}>{info.label}</Text>
      </View>
      <View style={S.metricsGrid}>
        <View style={S.metricsRow}>
          <MetricTile icon="🌡️" label="Hissedilen" value={`${Math.round(current.apparentTemperature)}°`} />
          <View style={S.metricDividerV} />
          <MetricTile icon="💧" label="Nem" value={`%${current.humidity}`} />
        </View>
        <View style={S.metricDividerH} />
        <View style={S.metricsRow}>
          <MetricTile icon="💨" label="Rüzgar" value={`${Math.round(current.windSpeed)} km/s`} />
          <View style={S.metricDividerV} />
          <MetricTile icon="🧭" label="Yön" value={windDir} />
        </View>
      </View>
    </View>
  );
}

function MetricTile({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={S.metricTile}>
      <Text style={S.metricIcon}>{icon}</Text>
      <Text style={S.metricValue}>{value}</Text>
      <Text style={S.metricLabel}>{label}</Text>
    </View>
  );
}

// ─── AI Özet Kartı ────────────────────────────────────────────────────────────

function AiCard({
  summary,
  loading,
  error,
  onRetry,
}: {
  summary: string | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  return (
    <View style={S.aiCard}>
      <View style={S.aiHeader}>
        <Text style={S.aiLabel}>🤖 SİSTEM ANALİZİ</Text>
        {!loading && (
          <TouchableOpacity onPress={onRetry} style={S.retryBtn}>
            <Text style={S.retryText}>↻ Yenile</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading && (
        <View style={S.aiLoadingRow}>
          <ActivityIndicator size="small" color="rgba(255,255,255,0.8)" />
          <Text style={S.aiLoadingText}>Hava yorumu hazırlanıyor…</Text>
        </View>
      )}

      {!loading && error && (
        <Text style={S.aiErrorText}>⚠️ {error}</Text>
      )}

      {!loading && summary && (
        <Text style={S.aiText}>{summary}</Text>
      )}
    </View>
  );
}

// ─── Gün Doğumu / Batımı Kartı ────────────────────────────────────────────────

function SunCard({ today }: { today: WeatherResult["daily"][0] }) {
  const rise = formatSunTime(today.sunrise);
  const set = formatSunTime(today.sunset);

  // Altın saat: gün doğumundan 30 dakika sonra ve gün batımından 30 dakika önce
  const goldenMorning = today.sunrise
    ? formatSunTime(
        new Date(new Date(today.sunrise).getTime() + 30 * 60 * 1000).toISOString()
      )
    : "—";
  const goldenEvening = today.sunset
    ? formatSunTime(
        new Date(new Date(today.sunset).getTime() - 30 * 60 * 1000).toISOString()
      )
    : "—";

  return (
    <View style={S.card}>
      <Text style={S.sectionLabel}>☀️ GÜNEŞ IŞINIMI</Text>
      <View style={S.sunRow}>
        <View style={S.sunItem}>
          <Text style={S.sunEmoji}>🌅</Text>
          <Text style={S.sunTime}>{rise}</Text>
          <Text style={S.sunSubLabel}>Gün Doğumu</Text>
        </View>
        <View style={S.sunDivider} />
        <View style={S.sunItem}>
          <Text style={S.sunEmoji}>📸</Text>
          <Text style={S.sunTime}>{rise} – {goldenMorning}</Text>
          <Text style={S.sunSubLabel}>Altın Saat</Text>
        </View>
        <View style={S.sunDivider} />
        <View style={S.sunItem}>
          <Text style={S.sunEmoji}>🌇</Text>
          <Text style={S.sunTime}>{set}</Text>
          <Text style={S.sunSubLabel}>Gün Batımı</Text>
        </View>
      </View>
      <View style={S.goldenEveRow}>
        <Text style={S.goldenEveText}>📸 Akşam Altın Saat: {goldenEvening} – {set}</Text>
      </View>
    </View>
  );
}

// ─── Kıyafet & Aktivite Önerileri Kartı ──────────────────────────────────────

function SuggestionsCard({ weather }: { weather: WeatherResult }) {
  const { clothing, activities, alerts } = getSuggestions(weather);

  return (
    <View style={S.card}>
      <Text style={S.sectionLabel}>👗 KIYAFET DONANIMI</Text>

      <View style={S.clothingRow}>
        <Text style={S.clothingText}>{clothing}</Text>
      </View>

      {alerts.length > 0 && (
        <View style={S.alertBox}>
          {alerts.map((a, i) => (
            <Text key={i} style={S.alertText}>{a}</Text>
          ))}
        </View>
      )}

      <Text style={[S.sectionLabel, { marginTop: 12 }]}>🎯 SİMÜLASYON TAVSİYELERİ</Text>
      <View style={S.activitiesWrap}>
        {activities.map((act, i) => (
          <View key={i} style={S.activityChip}>
            <Text style={S.activityText}>{act}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── Saatlik Bölüm ────────────────────────────────────────────────────────────

function HourlySection({
  weather,
  selectedDayIndex,
  onSelectDay,
}: {
  weather: WeatherResult;
  selectedDayIndex: number;
  onSelectDay: (i: number) => void;
}) {
  const selectedHourly = weather.hourlyByDay[selectedDayIndex] ?? [];

  return (
    <View style={S.card}>
      <Text style={S.sectionLabel}>🕐 YAKIN ZAMAN TARAMASI</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={S.dayTabs}
      >
        {weather.daily.map((day, idx) => {
          const active = idx === selectedDayIndex;
          return (
            <TouchableOpacity
              key={day.date}
              style={[S.dayTab, active && S.dayTabActive]}
              onPress={() => onSelectDay(idx)}
            >
              <Text style={[S.dayTabText, active && S.dayTabTextActive]}>
                {idx === 0 ? "Bugün" : weekdayLabel(day.date)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={S.hourlyRow}
      >
        {selectedHourly.map((h) => {
          const info = describeWeather(h.weatherCode);
          const isNow = h.label === "Şimdi";
          return (
            <View key={h.time} style={[S.hourItem, isNow && S.hourItemNow]}>
              <Text style={[S.hourTime, isNow && S.hourTimeNow]}>{h.label}</Text>
              <Text style={S.hourEmoji}>{info.emoji}</Text>
              <Text style={[S.hourTemp, isNow && S.hourTempNow]}>
                {Math.round(h.temperature)}°
              </Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

// ─── 7 Günlük Tahmin ─────────────────────────────────────────────────────────

function DailySection({
  weather,
  selectedDayIndex,
  onSelectDay,
}: {
  weather: WeatherResult;
  selectedDayIndex: number;
  onSelectDay: (i: number) => void;
}) {
  return (
    <View style={S.dailyWrap}>
      <Text style={S.sectionLabel}>📅 7 DÖNGÜLÜK TAHMİN</Text>
      {weather.daily.map((day, idx) => {
        const info = describeWeather(day.weatherCode);
        const uv = uvRiskLabel(day.uvIndex);
        const active = idx === selectedDayIndex;
        return (
          <TouchableOpacity
            key={day.date}
            style={[S.dayRow, active && S.dayRowActive]}
            onPress={() => onSelectDay(idx)}
            activeOpacity={0.75}
          >
            {active && <View style={S.dayRowAccent} />}
            <Text style={S.dayName}>{idx === 0 ? "Bugün" : weekdayLabel(day.date)}</Text>
            <Text style={S.dayEmoji}>{info.emoji}</Text>
            <Text style={S.dayCondition} numberOfLines={1}>{info.label}</Text>
            <View style={[S.uvBadge, { backgroundColor: uv.color + "28" }]}>
              <Text style={[S.uvText, { color: uv.color }]}>
                UV {Math.round(day.uvIndex)}
              </Text>
            </View>
            <Text style={S.dayTemp}>
              {Math.round(day.tempMax)}°{" "}
              <Text style={S.dayTempMin}>/ {Math.round(day.tempMin)}°</Text>
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ─── Sci-Fi / Uzay Teması Stilleri ───────────────────────────────────────────

const G = "rgba(15, 10, 30, 0.65)";
const GB = "rgba(0, 255, 255, 0.25)";
const GA = "rgba(30, 20, 60, 0.85)";
const GAB = "rgba(255, 0, 255, 0.4)";

const S = StyleSheet.create({
  fill: { flex: 1 },
  scroll: { padding: 20, paddingBottom: 48, gap: 14 },

  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 2 },
  appLabel: { fontSize: 13, fontWeight: "700", color: "#00f0ff", letterSpacing: 2.5, textShadowColor: "rgba(0,255,255,0.8)", textShadowRadius: 8 },
  locateBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: G, borderWidth: 1, borderColor: GB, alignItems: "center", justifyContent: "center" },
  locateIcon: { fontSize: 18 },

  searchRow: { flexDirection: "row", gap: 10 },
  input: { flex: 1, paddingHorizontal: 16, paddingVertical: 13, borderRadius: 14, fontSize: 15, color: "#fff", backgroundColor: G, borderWidth: 1, borderColor: GB },
  searchBtn: { paddingHorizontal: 20, borderRadius: 14, justifyContent: "center", backgroundColor: "rgba(255,255,255,0.22)", borderWidth: 1, borderColor: GB },
  searchBtnDisabled: { opacity: 0.45 },
  searchBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },

  favRow: { gap: 8, paddingVertical: 2 },
  favChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: G, borderWidth: 1, borderColor: GB },
  favChipActive: { backgroundColor: GA, borderColor: GAB },
  favChipText: { color: "rgba(255,255,255,0.8)", fontSize: 13, fontWeight: "600" },
  favChipTextActive: { color: "#fff" },

  dropdown: { borderRadius: 16, backgroundColor: "rgba(0,0,0,0.28)", borderWidth: 1, borderColor: GB, overflow: "hidden" },
  dropdownRow: { paddingVertical: 13, paddingHorizontal: 16 },
  dropdownDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "rgba(255,255,255,0.15)" },
  dropdownName: { color: "#fff", fontSize: 15, fontWeight: "600" },
  dropdownSub: { color: "rgba(255,255,255,0.6)", fontSize: 12, marginTop: 2 },

  loadingWrap: { alignItems: "center", paddingVertical: 48, gap: 14 },
  loadingText: { color: "rgba(255,255,255,0.85)", fontSize: 14 },

  errorWrap: { gap: 10 },
  errorText: { textAlign: "center", color: "#fff", fontSize: 14, lineHeight: 20, backgroundColor: "rgba(200,60,60,0.32)", borderRadius: 14, padding: 16, overflow: "hidden" },
  settingsBtn: { alignSelf: "center", paddingHorizontal: 22, paddingVertical: 11, borderRadius: 12, backgroundColor: G, borderWidth: 1, borderColor: GB },
  settingsBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },

  // Anlık kart
  currentCard: { borderRadius: 28, padding: 28, alignItems: "center", backgroundColor: G, borderWidth: 1, borderColor: GB, overflow: "hidden" },
  favBtn: { position: "absolute", top: 18, right: 18 },
  favIcon: { fontSize: 22, color: "rgba(255,255,255,0.45)" },
  favIconActive: { color: "#ff6b8a" },
  placeName: { fontSize: 15, fontWeight: "500", color: "#00f0ff", textAlign: "center", marginBottom: 4, paddingHorizontal: 32, textShadowColor: "rgba(0,255,255,0.5)", textShadowRadius: 4 },
  heroEmoji: { fontSize: 80, marginVertical: 4 },
  heroTemp: { fontSize: 88, fontWeight: "100", color: "#fff", lineHeight: 92, includeFontPadding: false, textShadowColor: "rgba(255,0,255,0.6)", textShadowRadius: 10 },
  conditionBadge: { marginTop: 8, paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, backgroundColor: "rgba(0,255,255,0.15)", borderWidth: 1, borderColor: "rgba(0,255,255,0.3)" },
  conditionText: { fontSize: 14, fontWeight: "600", color: "#00f0ff" },
  metricsGrid: { width: "100%", marginTop: 22, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.18)", paddingTop: 18 },
  metricsRow: { flexDirection: "row" },
  metricDividerV: { width: 1, backgroundColor: "rgba(255,255,255,0.15)", marginVertical: 4 },
  metricDividerH: { height: 1, backgroundColor: "rgba(255,255,255,0.15)", marginVertical: 10 },
  metricTile: { flex: 1, alignItems: "center", paddingVertical: 6, gap: 4 },
  metricIcon: { fontSize: 20 },
  metricValue: { fontSize: 17, fontWeight: "600", color: "#fff" },
  metricLabel: { fontSize: 11, color: "rgba(255,255,255,0.65)", fontWeight: "500" },

  // AI kartı
  aiCard: { borderRadius: 24, padding: 20, backgroundColor: "rgba(130,80,255,0.22)", borderWidth: 1, borderColor: "rgba(180,130,255,0.4)", gap: 10 },
  aiHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  aiLabel: { fontSize: 11, fontWeight: "700", color: "rgba(220,200,255,0.9)", letterSpacing: 2 },
  retryBtn: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.1)" },
  retryText: { fontSize: 12, color: "rgba(220,200,255,0.8)", fontWeight: "600" },
  aiLoadingRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  aiLoadingText: { color: "rgba(255,255,255,0.7)", fontSize: 13 },
  aiErrorText: { color: "rgba(255,200,200,0.9)", fontSize: 13, lineHeight: 20 },
  aiText: { color: "#fff", fontSize: 15, lineHeight: 23, fontWeight: "400" },

  // Genel kart
  card: { borderRadius: 24, paddingVertical: 18, backgroundColor: G, borderWidth: 1, borderColor: GB, overflow: "hidden", gap: 12 },
  sectionLabel: { fontSize: 11, fontWeight: "700", color: "rgba(0, 255, 255, 0.8)", letterSpacing: 2, paddingHorizontal: 18, textShadowColor: "rgba(0,255,255,0.4)", textShadowRadius: 4 },

  // Gün ışığı kartı
  sunRow: { flexDirection: "row", paddingHorizontal: 16 },
  sunItem: { flex: 1, alignItems: "center", gap: 4 },
  sunDivider: { width: 1, backgroundColor: "rgba(255,255,255,0.15)", marginVertical: 4 },
  sunEmoji: { fontSize: 26 },
  sunTime: { fontSize: 15, fontWeight: "700", color: "#fff" },
  sunSubLabel: { fontSize: 11, color: "rgba(255,255,255,0.6)", fontWeight: "500" },
  goldenEveRow: { paddingHorizontal: 18, paddingTop: 4, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.12)", marginHorizontal: 16 },
  goldenEveText: { fontSize: 13, color: "rgba(255,220,120,0.9)", fontWeight: "500", textAlign: "center" },

  // Kıyafet & aktivite kartı
  clothingRow: { marginHorizontal: 16, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.12)" },
  clothingText: { fontSize: 15, color: "#fff", fontWeight: "500" },
  alertBox: { marginHorizontal: 16, gap: 6 },
  alertText: { fontSize: 13, color: "rgba(255,230,130,0.95)", fontWeight: "500" },
  activitiesWrap: { paddingHorizontal: 14, gap: 8 },
  activityChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.1)", borderWidth: 1, borderColor: "rgba(255,255,255,0.18)" },
  activityText: { fontSize: 13, color: "rgba(255,255,255,0.9)" },

  // Gün sekme tab'ları
  dayTabs: { paddingHorizontal: 14, gap: 6 },
  dayTab: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.1)", borderWidth: 1, borderColor: "rgba(255,255,255,0.2)" },
  dayTabActive: { backgroundColor: "rgba(255,255,255,0.92)", borderColor: "transparent" },
  dayTabText: { fontSize: 13, fontWeight: "600", color: "rgba(255,255,255,0.8)" },
  dayTabTextActive: { color: "rgba(0,0,0,0.75)" },

  // Saatlik öğeler
  hourlyRow: { paddingHorizontal: 10, gap: 2 },
  hourItem: { alignItems: "center", paddingVertical: 10, paddingHorizontal: 10, borderRadius: 14, minWidth: 58, gap: 4 },
  hourItemNow: { backgroundColor: "rgba(255,255,255,0.22)", borderWidth: 1, borderColor: "rgba(255,255,255,0.38)" },
  hourTime: { fontSize: 12, color: "rgba(255,255,255,0.7)", fontWeight: "500" },
  hourTimeNow: { color: "#fff", fontWeight: "700" },
  hourEmoji: { fontSize: 22 },
  hourTemp: { fontSize: 14, color: "#fff", fontWeight: "600" },
  hourTempNow: { fontSize: 15, fontWeight: "700" },

  // 7 günlük
  dailyWrap: { gap: 8 },
  dayRow: { flexDirection: "row", alignItems: "center", borderRadius: 18, paddingVertical: 14, paddingHorizontal: 16, backgroundColor: G, borderWidth: 1, borderColor: GB, gap: 8, overflow: "hidden" },
  dayRowActive: { backgroundColor: GA, borderColor: GAB },
  dayRowAccent: { position: "absolute", left: 0, top: 8, bottom: 8, width: 3, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.8)" },
  dayName: { width: 46, fontSize: 14, fontWeight: "700", color: "#fff" },
  dayEmoji: { fontSize: 20, width: 28, textAlign: "center" },
  dayCondition: { flex: 1, fontSize: 13, color: "rgba(255,255,255,0.8)" },
  uvBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  uvText: { fontSize: 11, fontWeight: "700" },
  dayTemp: { fontSize: 14, fontWeight: "700", color: "#fff", minWidth: 68, textAlign: "right" },
  dayTempMin: { fontSize: 13, fontWeight: "400", color: "rgba(255,255,255,0.6)" },
});
