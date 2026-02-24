import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, View, TouchableOpacity, ScrollView, ActivityIndicator, Platform, Alert } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { FontAwesome } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { API_BASE_URL } from '@/constants/config';
import { router } from 'expo-router';
import * as Notifications from 'expo-notifications';

type CrimeType = {
  id: string;
  label: string;
  description: string;
  icon: keyof typeof FontAwesome.glyphMap;
  riskLevel: string;
};

// Specific crime types with distinct categories
const CRIME_TYPES: CrimeType[] = [
  { id: 'SEXUAL_HARASSMENT', label: 'Sexual Harassment', description: 'Unwanted sexual behavior', icon: 'exclamation-triangle', riskLevel: 'A' },
  { id: 'ASSAULT', label: 'Assault', description: 'Physical attack or threat', icon: 'exclamation-triangle', riskLevel: 'A' },
  { id: 'ROBBERY', label: 'Robbery', description: 'Theft with force or threat', icon: 'shield', riskLevel: 'A' },
  { id: 'BURGLARY', label: 'Burglary', description: 'Breaking and entering', icon: 'shield', riskLevel: 'B' },
  { id: 'THEFT', label: 'Theft', description: 'Stealing without force', icon: 'shopping-bag', riskLevel: 'C' },
  { id: 'VANDALISM', label: 'Vandalism', description: 'Property damage', icon: 'paint-brush', riskLevel: 'C' },
];

const INITIAL_REGION = {
  latitude: 32.5293,
  longitude: -92.0745,
  latitudeDelta: 0.01,
  longitudeDelta: 0.01,
};

const REQUEST_TIMEOUT = 30000; // 30 seconds timeout
const MAX_RETRIES = 2;

const fetchWithTimeout = async (url: string, options = {}) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
};

const retryFetch = async (url: string, options = {}, retries = MAX_RETRIES) => {
  try {
    return await fetchWithTimeout(url, options);
  } catch (error) {
    if (retries > 0) {
      console.log(`Retrying request... (${retries} attempts left)`);
      await new Promise(resolve => setTimeout(resolve, 1000));
      return retryFetch(url, options, retries - 1);
    }
    throw error;
  }
};

export default function ReportScreen() {
  const [selectedLocation, setSelectedLocation] = useState<{latitude: number, longitude: number} | null>(null);
  const [currentLocation, setCurrentLocation] = useState<{latitude: number, longitude: number} | null>(null);
  const [selectedCrime, setSelectedCrime] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const mapRef = useRef<MapView>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationError('Permission to access location was denied');
        return;
      }

      try {
        const location = await Location.getCurrentPositionAsync({});
        const { latitude, longitude } = location.coords;
        setCurrentLocation({ latitude, longitude });
        setSelectedLocation({ latitude, longitude });
      } catch (error) {
        setLocationError('Could not get your location');
        console.error('Error getting location:', error);
      }
    })();

    // Request notification permissions
    const requestNotificationPermission = async () => {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      
      if (finalStatus !== 'granted') {
        Alert.alert('Permission required', 'Please enable notifications to receive safety alerts.');
      }
    };

    requestNotificationPermission();
  }, []);

  const handleMapPress = (e: any) => {
    setSelectedLocation(e.nativeEvent.coordinate);
  };

  const handleRecenter = async () => {
    if (currentLocation && mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }, 1000);
      setSelectedLocation(currentLocation);
    }
  };

  const handleSubmit = async () => {
    if (!selectedLocation || !selectedCrime) {
      Alert.alert('Error', 'Please select a location and crime type');
      return;
    }

    setIsSubmitting(true);
    const crimeType = CRIME_TYPES.find(c => c.id === selectedCrime);

    try {
      const response = await retryFetch(`${API_BASE_URL}/report-crime/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          latitude: selectedLocation.latitude,
          longitude: selectedLocation.longitude,
          description: `${crimeType?.label}: ${crimeType?.description || ''}`,
          reported_at: new Date().toISOString().split('.')[0] + 'Z',
          severity: crimeType?.id === 'ASSAULT' || crimeType?.id === 'ROBBERY' ? 4 : 
                   crimeType?.id === 'THEFT' || crimeType?.id === 'VANDALISM' ? 3 : 
                   crimeType?.id === 'HARASSMENT' || crimeType?.id === 'TRESPASSING' ? 2 : 1
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Server returned status ${response.status}`);
      }

      const data = await response.json();
      console.log('Backend Response:', data);
      
      // Reset form
      setSelectedLocation(null);
      setSelectedCrime(null);
      
      // Show success with risk assessment
      const riskCategory = data.risk_area?.risk_category || 'C';
      const riskScore = data.risk_area?.risk_score || 0;
      
      // Send notification if in high-risk area
      if (riskCategory === 'A' || riskCategory === 'B') {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: '⚠️ Safety Alert',
            body: `You have reported an incident in a ${riskCategory === 'A' ? 'high' : 'moderate'} risk area. ${getRiskMessage(riskCategory)}`,
            data: { riskLevel: riskCategory, riskScore },
            sound: true,
            priority: Notifications.AndroidNotificationPriority.HIGH,
          },
          trigger: null,
        });
      }
      
      Alert.alert(
        'Report Submitted',
        `Report submitted successfully!\nRisk Category: ${riskCategory}\nRisk Score: ${riskScore.toFixed(2)}\n\n${getRiskMessage(riskCategory)}`,
        [{ text: 'OK', onPress: () => router.replace('/map') }]
      );
    } catch (error) {
      console.error('Error submitting report:', error);
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Failed to submit report. Please try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const getRiskMessage = (category: string) => {
    switch (category) {
      case 'A':
        return 'This is a high-risk area. Please be extremely cautious and aware of your surroundings.';
      case 'B':
        return 'This is a moderate-risk area. Stay alert and take necessary precautions.';
      case 'C':
        return 'This is a low-risk area. Exercise normal caution.';
      case 'D':
        return 'This is a safe area. Continue to stay aware of your surroundings.';
      default:
        return 'Unable to determine risk level. Stay cautious.';
    }
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <ThemedText style={styles.title}>Report Incident</ThemedText>
        
        {/* Map Section */}
        <View style={styles.mapContainer}>
          <ThemedText style={styles.sectionTitle}>Select Location</ThemedText>
          <View style={styles.mapWrapper}>
            <MapView
              ref={mapRef}
              style={styles.map}
              initialRegion={currentLocation ? {
                latitude: currentLocation.latitude,
                longitude: currentLocation.longitude,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              } : INITIAL_REGION}
              onPress={handleMapPress}
              showsUserLocation={true}
              showsMyLocationButton={false}
              showsCompass={false}
              showsScale={false}
              showsTraffic={false}
              showsBuildings={false}
              showsIndoors={false}
              showsPointsOfInterest={false}
            >
              {currentLocation && (
                <Marker
                  coordinate={currentLocation}
                  pinColor="#4285F4"
                  title="Your Location"
                />
              )}
              {selectedLocation && selectedLocation !== currentLocation && (
                <Marker
                  coordinate={selectedLocation}
                  pinColor="#FF0000"
                  title="Selected Location"
                />
              )}
            </MapView>
            <TouchableOpacity style={styles.recenterButton} onPress={handleRecenter}>
              <FontAwesome name="crosshairs" size={20} color="#1A237E" />
            </TouchableOpacity>
          </View>
          {locationError ? (
            <ThemedText style={styles.errorText}>{locationError}</ThemedText>
          ) : selectedLocation ? (
            <ThemedText style={styles.locationText}>
              Location selected: {selectedLocation.latitude.toFixed(6)}, {selectedLocation.longitude.toFixed(6)}
            </ThemedText>
          ) : null}
        </View>

        {/* Crime Type Selection */}
        <View style={styles.crimeTypeContainer}>
          <ThemedText style={styles.sectionTitle}>Select Incident Type</ThemedText>
          <View style={styles.crimeGrid}>
            {CRIME_TYPES.map((crime) => (
              <TouchableOpacity
                key={crime.id}
                style={[
                  styles.crimeTypeButton,
                  selectedCrime === crime.id && styles.selectedCrimeType,
                ]}
                onPress={() => setSelectedCrime(crime.id)}
              >
                <View style={styles.crimeTypeContent}>
                  <FontAwesome name={crime.icon} size={24} color="#FFFFFF" style={styles.crimeTypeIcon} />
                  <ThemedText style={styles.crimeTypeLabel}>{crime.label}</ThemedText>
                  <ThemedText style={styles.crimeTypeDescription}>{crime.description}</ThemedText>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          style={[
            styles.submitButton,
            (!selectedLocation || !selectedCrime || isSubmitting) && styles.disabledButton,
          ]}
          onPress={handleSubmit}
          disabled={!selectedLocation || !selectedCrime || isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <ThemedText style={styles.submitButtonText}>Submit Report</ThemedText>
          )}
        </TouchableOpacity>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  scrollView: {
    flex: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginVertical: 24,
    marginHorizontal: 20,
    color: '#1A237E',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 16,
    color: '#1A237E',
  },
  mapContainer: {
    margin: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  mapWrapper: {
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden',
  },
  map: {
    width: '100%',
    height: 240,
    borderRadius: 12,
  },
  locationText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666666',
    fontStyle: 'italic',
  },
  crimeTypeContainer: {
    margin: 20,
  },
  crimeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  crimeTypeButton: {
    width: '48%',
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    backgroundColor: '#1A237E',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  selectedCrimeType: {
    transform: [{ scale: 1.02 }],
    backgroundColor: '#283593',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  crimeTypeContent: {
    gap: 8,
    alignItems: 'center',
  },
  crimeTypeIcon: {
    marginBottom: 8,
  },
  crimeTypeLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  crimeTypeDescription: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
  },
  submitButton: {
    backgroundColor: '#1A237E',
    padding: 18,
    borderRadius: 16,
    margin: 20,
    marginTop: 8,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  disabledButton: {
    backgroundColor: '#CCCCCC',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  recenterButton: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 30,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  errorText: {
    marginTop: 8,
    fontSize: 14,
    color: '#FF0000',
    fontStyle: 'italic',
  },
}); 