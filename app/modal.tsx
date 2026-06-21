import { Link } from "expo-router";
import { StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";

export default function ModalScreen() {
  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title">Hava Durumu</ThemedText>
      <View style={styles.infoBlock}>
        <ThemedText type="defaultSemiBold">Veri Kaynakları</ThemedText>
        <ThemedText>
          Hava tahmini: Open-Meteo (açık kaynak, ücretsiz){"\n"}
          Konum adı: BigDataCloud Reverse Geocoding{"\n"}
          Türkiye şehir verisi: Yerleşik (offline)
        </ThemedText>
      </View>
      <View style={styles.infoBlock}>
        <ThemedText type="defaultSemiBold">Özellikler</ThemedText>
        <ThemedText>
          • 7 günlük tahmin + 24 saatlik saatlik veri{"\n"}
          • Anlık sıcaklık, nem, rüzgar hızı ve yönü{"\n"}
          • UV indeks riski (günlük){"\n"}
          • Favori şehirler (kalıcı depolama){"\n"}
          • Otomatik konuma göre hava durumu{"\n"}
          • Dinamik arka plan (hava + saat)
        </ThemedText>
      </View>
      <Link href="/" dismissTo style={styles.link}>
        <ThemedText type="link">← Ana Ekrana Dön</ThemedText>
      </Link>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    gap: 20,
  },
  infoBlock: {
    gap: 6,
  },
  link: {
    marginTop: 8,
  },
});
