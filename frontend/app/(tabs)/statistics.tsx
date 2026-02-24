import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Alert,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { StatusBar } from 'expo-status-bar';
import { Picker } from '@react-native-picker/picker';
import { FontAwesome } from '@expo/vector-icons';
import { GEMINI_API_KEY } from '@/config/env';

// List of major Louisiana cities
const LOUISIANA_CITIES = [
  'New Orleans',
  'Baton Rouge',
  'Shreveport',
  'Lafayette',
  'Lake Charles',
  'Monroe',
  'Alexandria',
  'Houma',
  'Bossier City',
  'Kenner',
] as const;

type LouisianaCity = typeof LOUISIANA_CITIES[number];

export default function StatisticsScreen() {
  const [selectedCity, setSelectedCity] = useState<LouisianaCity | ''>('');
  const [crimeData, setCrimeData] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPicker, setShowPicker] = useState(false);

  useEffect(() => {
    // Basic environment check without exposing sensitive information
    console.log('Gemini API Key is configured:', !!GEMINI_API_KEY);
  }, []);

  const fetchCityData = async (city: LouisianaCity) => {
    setLoading(true);
    try {
      if (!GEMINI_API_KEY) {
        console.error('API key is undefined');
        throw new Error('Gemini API key is not configured');
      }

      const prompt = `You are a knowledgeable assistant providing up-to-date, accurate crime statistics and safety information for cities in Louisiana. Organize your response clearly under headings. Focus on recent official data where possible. Keep the tone factual, concise, and easy to understand for the general public.

Provide recent crime statistics and safety information for ${city}, Louisiana. Structure the information as follows:

1. **Crime Statistics**: Summarize recent crime rates (violent crime, property crime, etc.). Use specific numbers or trends if possible.
2. **Crime Breakdown**: List common types of crimes (e.g., assault, theft, burglary) with brief notes if any are rising or falling.
3. **Safety Tips**: Provide 3–5 safety recommendations tailored for people living in or visiting ${city}.
4. **General Safety Level**: Briefly describe the overall safety situation (e.g., "Generally safe downtown but caution needed in certain areas").

Keep the information clear, structured, and factual. Avoid speculation or opinions.`;

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [{ text: prompt }],
              },
            ],
          }),
        }
      );

      const json = await response.json();
      if (json.error) {
        throw new Error(json.error.message || 'Gemini API error');
      }
      const data = json.candidates[0].content.parts[0].text;
      setCrimeData(data);
    } catch (error) {
      console.error('Error fetching city data:', error);
      Alert.alert('Error', 'Failed to fetch city data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCitySelect = (value: LouisianaCity | '') => {
    if (value) {
      setSelectedCity(value);
      fetchCityData(value);
      setShowPicker(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <ThemedText style={styles.headerTitle}>SafeRoute Statistics</ThemedText>
        <TouchableOpacity
          style={styles.citySelector}
          onPress={() => setShowPicker(true)}
        >
          <FontAwesome name="map-marker" size={16} color="#1A237E" />
          <ThemedText style={styles.cityName}>
            {selectedCity || 'Select a City'}
          </ThemedText>
          <FontAwesome name="chevron-down" size={14} color="#666" />
        </TouchableOpacity>
      </View>

      {!selectedCity ? (
        <View style={styles.emptyState}>
          <ThemedText style={styles.emptyStateText}>
            Select a city to view crime statistics and safety information
          </ThemedText>
        </View>
      ) : (
        <View style={styles.content}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#1A237E" />
              <ThemedText style={styles.loadingText}>Loading safety data...</ThemedText>
            </View>
          ) : (
            crimeData && (
              <ScrollView
                style={styles.scrollView}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
              >
                <ThemedText style={styles.crimeDataText}>
                  {crimeData.split('\n').map((line, index) => {
                    // Check if line contains bold text
                    const boldMatch = line.match(/\*\*(.*?)\*\*/);
                    if (boldMatch) {
                      const parts = line.split(/\*\*(.*?)\*\*/);
                      return (
                        <ThemedText key={index} style={styles.crimeDataText}>
                          {parts.map((part, i) => {
                            if (i % 2 === 1) {
                              return (
                                <ThemedText key={i} style={[styles.crimeDataText, styles.boldText]}>
                                  {part}
                                </ThemedText>
                              );
                            }
                            return part;
                          })}
                          {'\n'}
                        </ThemedText>
                      );
                    }
                    return <ThemedText key={index} style={styles.crimeDataText}>{line}{'\n'}</ThemedText>;
                  })}
                </ThemedText>
              </ScrollView>
            )
          )}
        </View>
      )}

      <Modal
        visible={showPicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>Select a City</ThemedText>
              <TouchableOpacity onPress={() => setShowPicker(false)}>
                <FontAwesome name="close" size={20} color="#666" />
              </TouchableOpacity>
            </View>
            <Picker
              selectedValue={selectedCity}
              onValueChange={handleCitySelect}
              style={styles.modalPicker}
              itemStyle={styles.pickerItem}
            >
              <Picker.Item label="Choose a city" value="" color="#1A237E" />
              {LOUISIANA_CITIES.map((city) => (
                <Picker.Item key={city} label={city} value={city} color="#1A237E" />
              ))}
            </Picker>
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    padding: 20,
    paddingTop: 60,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1A237E',
    marginBottom: 16,
  },
  citySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F0F0',
    padding: 12,
    borderRadius: 8,
  },
  cityName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: '#1A237E',
    marginLeft: 8,
    marginRight: 8,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  crimeDataText: {
    fontSize: 16,
    lineHeight: 24,
    color: '#333',
  },
  boldText: {
    fontWeight: 'bold',
    color: '#1A237E',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '50%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1A237E',
  },
  modalPicker: {
    height: 200,
  },
  pickerItem: {
    color: '#1A237E',
    fontSize: 16,
    fontWeight: '500',
  },
}); 