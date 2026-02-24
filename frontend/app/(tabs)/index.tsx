import { StyleSheet, Platform, TouchableOpacity, View, ScrollView } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useEffect, useState } from 'react';
import * as Location from 'expo-location';
import { API_BASE_URL } from '@/constants/config';
import { useRouter } from 'expo-router';

export default function HomeScreen() {
  const router = useRouter();
  const [currentRisk, setCurrentRisk] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    // Update time every minute
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);

    // Get initial risk level
    getCurrentRisk();

    return () => clearInterval(timer);
  }, []);

  const getCurrentRisk = async () => {
    try {
      const location = await Location.getCurrentPositionAsync({});
      const response = await fetch(
        `${API_BASE_URL}/risk/?lat=${location.coords.latitude}&lon=${location.coords.longitude}&radius=0.1`
      );
      const data = await response.json();
      setCurrentRisk(data.risk_category);
    } catch (error) {
      console.error('Error getting risk level:', error);
    }
  };

  const getTimeBasedTips = (): { icon: React.ComponentProps<typeof FontAwesome>['name']; color: string; text: string }[] => {
    const hour = currentTime.getHours();
    if (hour >= 18 || hour <= 6) {
      return [
        {
          icon: 'lightbulb-o',
          color: '#F4B400',
          text: 'Stay in well-lit areas and avoid dark alleys',
        },
        {
          icon: 'group',
          color: '#0F9D58',
          text: 'Travel in groups when possible during night hours',
        },
      ];
    } else {
      return [
        {
          icon: 'eye',
          color: '#4285F4',
          text: 'Stay aware of your surroundings',
        },
        {
          icon: 'map-marker',
          color: '#DB4437',
          text: 'Keep to main paths and populated areas',
        },
      ];
    }
  };

  const getRiskBasedTips = (): { icon: React.ComponentProps<typeof FontAwesome>['name']; color: string; text: string }[] => {
    if (!currentRisk) return [];

    switch (currentRisk) {
      case 'A':
        return [{
          icon: 'exclamation-triangle',
          color: '#DB4437',
          text: 'High risk area detected. Consider alternative routes',
        }];
      case 'B':
        return [{
          icon: 'warning',
          color: '#F4B400',
          text: 'Moderate risk area. Stay alert and avoid isolated spots',
        }];
      default:
        return [];
    }
  };

  const tips = [...getTimeBasedTips(), ...getRiskBasedTips()];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <ThemedText style={styles.title}>SafeRoute</ThemedText>
          <ThemedText style={styles.subtitle}>Navigate with Confidence</ThemedText>
        </View>

        {/* Quick Actions */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity style={styles.actionButton}>
            <FontAwesome name="map-marker" size={24} color="#DB4437" style={styles.actionIcon} />
            <ThemedText style={styles.actionText}>Start Navigation</ThemedText>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton}>
            <FontAwesome name="history" size={24} color="#4285F4" style={styles.actionIcon} />
            <ThemedText style={styles.actionText}>Recent Routes</ThemedText>
          </TouchableOpacity>
        </View>

        {/* Safety Tips */}
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Safety Tips</ThemedText>
          {tips.map((tip, index) => (
            <View key={index} style={styles.tipContainer}>
              <FontAwesome name={tip.icon} size={20} color={tip.color} style={styles.tipIcon} />
              <ThemedText style={styles.tipText}>{tip.text}</ThemedText>
            </View>
          ))}
        </View>

        {/* Crime Statistics */}
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Area Statistics</ThemedText>
          <ThemedText style={styles.descriptionText}>
            View real-time crime statistics and safety scores for your area.
          </ThemedText>
          <TouchableOpacity
            style={styles.statsButton}
            onPress={() => router.push('/statistics')}
          >
            <ThemedText style={styles.statsButtonText}>View Statistics</ThemedText>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  header: {
    marginTop: Platform.OS === 'ios' ? 40 : 20,
    marginBottom: 30,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 120,
  },
  title: {
    fontSize: 42,
    fontWeight: 'bold',
    color: '#1A237E',
    marginBottom: 8,
    textAlign: 'center',
    lineHeight: 50,
    paddingTop: 10,
  },
  subtitle: {
    fontSize: 18,
    color: '#666666',
    textAlign: 'center',
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
    gap: 12,
    paddingHorizontal: 4,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  actionIcon: {
    marginBottom: 8,
  },
  actionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    textAlign: 'center',
  },
  section: {
    marginBottom: 24,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A237E',
    marginBottom: 16,
  },
  tipContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  tipIcon: {
    marginRight: 12,
  },
  tipText: {
    fontSize: 14,
    color: '#333333',
    flex: 1,
  },
  descriptionText: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 16,
  },
  statsButton: {
    backgroundColor: '#1A237E',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  statsButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
