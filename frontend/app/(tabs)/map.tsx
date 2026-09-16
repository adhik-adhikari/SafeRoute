import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  Alert,
  Platform,
  ActivityIndicator,
  ScrollView,
  Text
} from 'react-native';
import MapView, { Region, Marker, Polygon, Polyline } from 'react-native-maps';
import * as Location from 'expo-location';
import { FontAwesome } from '@expo/vector-icons';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { API_BASE_URL } from '@/constants/config';
import { useIsFocused } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';

// Configure notifications for foreground only
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const DISTANCE_THRESHOLD = 10; // meters
const CHECK_INTERVAL = 5000; // 5 seconds
const ULM_REGION = {
  latitude: 32.5293, // ULM Library coordinates
  longitude: -92.0745,
  latitudeDelta: 0.015,
  longitudeDelta: 0.015,
};

type RiskArea = {
  coordinates: { latitude: number; longitude: number }[];
  riskLevel: string;
  radius: number;
};

type RouteCoordinate = {
  latitude: number;
  longitude: number;
};

type RouteData = {
  id: string;
  name: string;
  type: 'safest' | 'direct';
  is_recommended: boolean;
  is_safe: boolean;
  distance_km: number;
  duration_minutes: number;
  risk_score: number;
  risk_level: string;
  intersected_zones_count: number;
  intersected_areas?: any[];
  detour_waypoints?: RouteCoordinate[];
  summary: string;
  color: string;
  coordinates: RouteCoordinate[];
};

type RoutesResponse = {
  status: string;
  mode: string;
  safest_route: RouteData;
  direct_route: RouteData;
  routes: RouteData[];
  risk_avoidance_applied: boolean;
  avoided_risk_zones_count: number;
  safety_message: string;
};

const PRESET_DESTINATIONS = [
  { id: 'lib', name: 'ULM Library', latitude: 32.5293, longitude: -92.0745, icon: 'book' },
  { id: 'din', name: 'Schulze Dining', latitude: 32.5285, longitude: -92.0739, icon: 'cutlery' },
  { id: 'sub', name: 'Student Union', latitude: 32.5305, longitude: -92.0715, icon: 'users' },
  { id: 'mal', name: 'Malone Stadium', latitude: 32.5318, longitude: -92.0658, icon: 'trophy' },
  { id: 'vil', name: 'Bayou Village', latitude: 32.5262, longitude: -92.0772, icon: 'home' },
  { id: 'sth', name: 'South Campus', latitude: 32.5240, longitude: -92.0745, icon: 'map-pin' },
];

export default function MapScreen() {
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [riskLevel, setRiskLevel] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const lastCheckedLocation = useRef<{ latitude: number; longitude: number } | null>(null);
  const mapRef = useRef<MapView>(null);
  const locationSubscription = useRef<Location.LocationSubscription | null>(null);
  const isFocused = useIsFocused();
  const [riskAreas, setRiskAreas] = useState<RiskArea[]>([]);
  const [mapRegion, setMapRegion] = useState<Region>(ULM_REGION);
  const [notificationPermission, setNotificationPermission] = useState(false);
  const lastNotificationTime = useRef(0);

  // Routing & Risk Avoidance States
  const [destination, setDestination] = useState<{ latitude: number; longitude: number; name: string } | null>(null);
  const [routesResult, setRoutesResult] = useState<RoutesResponse | null>(null);
  const [selectedRouteType, setSelectedRouteType] = useState<'safest' | 'direct'>('safest');
  const [travelMode, setTravelMode] = useState<'walking' | 'driving'>('walking');
  const [isCalculatingRoute, setIsCalculatingRoute] = useState(false);
  const [isSelectingOnMap, setIsSelectingOnMap] = useState(false);
  const [showDestinationDrawer, setShowDestinationDrawer] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const [navigationStep, setNavigationStep] = useState(0);

  useEffect(() => {
    const initialize = async () => {
      setIsInitializing(true);
      try {
        await setupLocationUpdates();
        let currentLocation = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced
        });
        
        if (currentLocation) {
          setLocation(currentLocation);
        }
      } catch (error) {
        console.error('Initialization error:', error);
      } finally {
        setIsInitializing(false);
      }
    };

    initialize();

    return () => {
      if (locationSubscription.current) {
        locationSubscription.current.remove();
      }
    };
  }, []);

  useEffect(() => {
    const setupNotifications = async () => {
      try {
        const { status } = await Notifications.requestPermissionsAsync();
        setNotificationPermission(status === 'granted');
      } catch (error) {
        console.warn('Error setting up notifications:', error);
      }
    };

    setupNotifications();
  }, []);

  const setupLocationUpdates = async () => {
    try {
      console.log('Setting up location updates...');
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorMsg('Permission to access location was denied');
        return;
      }

      let currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High
      });
      setLocation(currentLocation);
      
      if (!isInitializing) {
        checkRiskArea(currentLocation);
      }

      locationSubscription.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          distanceInterval: DISTANCE_THRESHOLD,
          timeInterval: CHECK_INTERVAL,
          mayShowUserSettingsDialog: true
        },
        (newLocation) => {
          setLocation(newLocation);
          if (!isInitializing) {
            checkIfShouldUpdateRisk(newLocation);
          }
        }
      );
    } catch (error) {
      console.error('Error in setupLocationUpdates:', error);
      setErrorMsg('Error getting location');
    }
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3;
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  };

  const checkIfShouldUpdateRisk = (newLocation: Location.LocationObject) => {
    if (isSending) return;

    if (!lastCheckedLocation.current) {
      lastCheckedLocation.current = {
        latitude: newLocation.coords.latitude,
        longitude: newLocation.coords.longitude,
      };
      checkRiskArea(newLocation);
      return;
    }

    const distance = calculateDistance(
      lastCheckedLocation.current.latitude,
      lastCheckedLocation.current.longitude,
      newLocation.coords.latitude,
      newLocation.coords.longitude
    );

    if (distance > DISTANCE_THRESHOLD) {
      lastCheckedLocation.current = {
        latitude: newLocation.coords.latitude,
        longitude: newLocation.coords.longitude,
      };
      checkRiskArea(newLocation);
    }
  };

  const showNotification = async (riskLevel: string) => {
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      
      if (finalStatus !== 'granted') return;

      const now = Date.now();
      if (now - lastNotificationTime.current < 15000) return;
      lastNotificationTime.current = now;

      const title = riskLevel === 'A' 
        ? "⚠️ High Risk Area Alert" 
        : "⚠️ Moderate Risk Area";
      
      const body = riskLevel === 'A'
        ? "You have entered a high-risk area. Please be extremely cautious."
        : "You have entered a moderate-risk area. Stay alert.";

      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          sound: true,
          priority: 'high',
          vibrate: [0, 250, 250, 250],
        },
        trigger: null,
      });
    } catch (error) {
      console.error('Error showing notification:', error);
    }
  };

  const fetchRiskAreas = async (region: Region) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/risk/?lat=${region.latitude}&lon=${region.longitude}&radius=0.2`
      );
      
      if (!response.ok) throw new Error('Failed to fetch risk areas');
      
      const data = await response.json();
      const areas = data.risk_areas || [];
      
      const transformedAreas = areas.map((area: any) => {
        const points = [];
        const center = area.center;
        const radius = area.radius;
        const radiusDeg = radius / 111.32;
        
        for (let i = 0; i < 360; i += 10) {
          const angle = i * (Math.PI / 180);
          const lat = center.latitude + (radiusDeg * Math.cos(angle));
          const lng = center.longitude + (radiusDeg * Math.sin(angle));
          points.push({ latitude: lat, longitude: lng });
        }
        
        return {
          coordinates: points,
          riskLevel: area.riskLevel,
          radius: radius
        };
      });
      
      setRiskAreas(transformedAreas);
    } catch (error) {
      console.error('Error fetching risk areas:', error);
    }
  };

  useEffect(() => {
    fetchRiskAreas(mapRegion);
  }, [mapRegion]);

  const checkRiskArea = async (currentLocation: Location.LocationObject, isManualCheck: boolean = false) => {
    if (isSending) return;

    try {
      setIsSending(true);
      const url = `${API_BASE_URL}/risk/?lat=${currentLocation.coords.latitude}&lon=${currentLocation.coords.longitude}&radius=0.2`;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Server returned ${response.status}`);

      const data = await response.json();
      const areas = data.risk_areas || [];
      
      let currentRiskLevel = "D";
      let currentRiskScore = 0;
      let closestDistance = Infinity;
      
      for (const area of areas) {
        const distance = calculateDistance(
          currentLocation.coords.latitude,
          currentLocation.coords.longitude,
          area.center.latitude,
          area.center.longitude
        );
        
        if (distance <= area.radius * 1000) {
          currentRiskLevel = area.riskLevel;
          currentRiskScore = area.riskLevel === 'A' ? 0.8 : 
                           area.riskLevel === 'B' ? 0.5 : 
                           area.riskLevel === 'C' ? 0.2 : 0;
          closestDistance = distance;
          break;
        }
      }
      
      if (currentRiskLevel !== riskLevel) {
        setRiskLevel(currentRiskLevel);
        if (currentRiskLevel === 'A' || currentRiskLevel === 'B') {
          await showNotification(currentRiskLevel);
        }
      } else if (isManualCheck) {
        Alert.alert(
          'Risk Assessment',
          `Risk Level: ${currentRiskLevel}\nRisk Score: ${currentRiskScore.toFixed(2)}\nDistance: ${closestDistance.toFixed(2)}m\n\n${getRiskMessage(currentRiskLevel)}`,
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Error checking risk area:', error);
      if (isManualCheck) {
        setErrorMsg('Unable to check risk level. Please try again.');
      }
    } finally {
      setIsSending(false);
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

  // ==========================================
  // ROUTE OPTIMIZATION & RISK AVOIDANCE ENGINE
  // ==========================================

  const requestSafeRoute = async (destCoords: { latitude: number; longitude: number; name?: string }, mode: 'walking' | 'driving' = travelMode) => {
    const originLat = location?.coords?.latitude || ULM_REGION.latitude;
    const originLon = location?.coords?.longitude || ULM_REGION.longitude;

    setIsCalculatingRoute(true);
    setErrorMsg(null);

    try {
      const url = `${API_BASE_URL}/safe-route/?start_lat=${originLat}&start_lon=${originLon}&end_lat=${destCoords.latitude}&end_lon=${destCoords.longitude}&mode=${mode}`;
      console.log('Fetching safe route from:', url);

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Route server returned ${response.status}`);
      }

      const data: RoutesResponse = await response.json();
      console.log('Safe route response received:', data.status);
      setRoutesResult(data);
      setSelectedRouteType('safest');
      setShowDestinationDrawer(false);
      setIsSelectingOnMap(false);

      // Center map to encompass route
      if (mapRef.current && data.safest_route?.coordinates?.length > 0) {
        mapRef.current.fitToCoordinates(data.safest_route.coordinates, {
          edgePadding: { top: 120, right: 60, bottom: 260, left: 60 },
          animated: true,
        });
      }
    } catch (error) {
      console.error('Error calculating safe route:', error);
      Alert.alert('Route Error', 'Could not compute safe route. Please check network connection.');
    } finally {
      setIsCalculatingRoute(false);
    }
  };

  const handleSelectPreset = (preset: typeof PRESET_DESTINATIONS[0]) => {
    setDestination({
      latitude: preset.latitude,
      longitude: preset.longitude,
      name: preset.name,
    });
    requestSafeRoute(preset);
  };

  const handleMapPress = (coord: { latitude: number; longitude: number }) => {
    if (isSelectingOnMap) {
      const customDest = {
        latitude: coord.latitude,
        longitude: coord.longitude,
        name: 'Selected Pin',
      };
      setDestination(customDest);
      requestSafeRoute(customDest);
    }
  };

  const handleClearRoute = () => {
    setDestination(null);
    setRoutesResult(null);
    setIsNavigating(false);
    setNavigationStep(0);
    setIsSelectingOnMap(false);
  };

  const handleToggleMode = (newMode: 'walking' | 'driving') => {
    setTravelMode(newMode);
    if (destination) {
      requestSafeRoute(destination, newMode);
    }
  };

  const currentActiveRoute = routesResult
    ? (selectedRouteType === 'safest' ? routesResult.safest_route : routesResult.direct_route)
    : null;

  return (
    <View style={styles.container}>
      {/* Top Floating Control Bar */}
      <View style={styles.topBarContainer}>
        <View style={styles.searchBar}>
          <TouchableOpacity
            style={styles.searchButton}
            onPress={() => setShowDestinationDrawer(!showDestinationDrawer)}
          >
            <FontAwesome name="search" size={18} color="#1A237E" style={styles.searchIcon} />
            <Text style={styles.searchText} numberOfLines={1}>
              {destination ? destination.name : 'Where do you want to go safely?'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.mapPinButton, isSelectingOnMap && styles.mapPinButtonActive]}
            onPress={() => setIsSelectingOnMap(!isSelectingOnMap)}
          >
            <FontAwesome name="map-marker" size={18} color={isSelectingOnMap ? '#fff' : '#1A237E'} />
          </TouchableOpacity>
        </View>

        {/* Mode Selector (Walking / Driving) */}
        <View style={styles.modeSelector}>
          <TouchableOpacity
            style={[styles.modeButton, travelMode === 'walking' && styles.modeButtonActive]}
            onPress={() => handleToggleMode('walking')}
          >
            <FontAwesome name="male" size={16} color={travelMode === 'walking' ? '#fff' : '#555'} />
            <Text style={[styles.modeButtonText, travelMode === 'walking' && styles.modeButtonTextActive]}>
              Walking
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.modeButton, travelMode === 'driving' && styles.modeButtonActive]}
            onPress={() => handleToggleMode('driving')}
          >
            <FontAwesome name="car" size={16} color={travelMode === 'driving' ? '#fff' : '#555'} />
            <Text style={[styles.modeButtonText, travelMode === 'driving' && styles.modeButtonTextActive]}>
              Driving
            </Text>
          </TouchableOpacity>
        </View>

        {isSelectingOnMap && (
          <View style={styles.tapBanner}>
            <FontAwesome name="info-circle" size={14} color="#1A237E" />
            <Text style={styles.tapBannerText}>Tap anywhere on the map to set destination</Text>
          </View>
        )}
      </View>

      {/* Destination Quick-Pick Drawer */}
      {showDestinationDrawer && (
        <View style={styles.drawerContainer}>
          <View style={styles.drawerHeader}>
            <ThemedText style={styles.drawerTitle}>Quick Destinations (ULM & Monroe)</ThemedText>
            <TouchableOpacity onPress={() => setShowDestinationDrawer(false)}>
              <FontAwesome name="times-circle" size={20} color="#666" />
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.presetScroll}>
            {PRESET_DESTINATIONS.map((preset) => (
              <TouchableOpacity
                key={preset.id}
                style={styles.presetChip}
                onPress={() => handleSelectPreset(preset)}
              >
                <FontAwesome name={preset.icon as any} size={16} color="#1A237E" />
                <Text style={styles.presetText}>{preset.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Map View */}
      <MapView
        ref={mapRef}
        style={styles.map}
        showsUserLocation
        followsUserLocation={false}
        showsMyLocationButton
        initialRegion={ULM_REGION}
        onRegionChangeComplete={setMapRegion}
        onPress={(e) => handleMapPress(e.nativeEvent.coordinate)}
      >
        {/* Risk Area Polygons */}
        {riskAreas.map((area, index) => (
          <Polygon
            key={`risk-${index}`}
            coordinates={area.coordinates}
            fillColor={getRiskColor(area.riskLevel)}
            strokeColor={getRiskColor(area.riskLevel)}
            strokeWidth={2}
            tappable={true}
            onPress={() => {
              Alert.alert(
                'Area Risk Level',
                `This area is ${
                  area.riskLevel === 'A' ? 'High Risk (Danger Zone)' :
                  area.riskLevel === 'B' ? 'Moderate Risk' :
                  area.riskLevel === 'C' ? 'Low Risk' : 'Safe'
                }\n\nRadius: ${(area.radius * 1000).toFixed(0)} meters`
              );
            }}
          />
        ))}

        {/* Destination Marker */}
        {destination && (
          <Marker
            coordinate={{ latitude: destination.latitude, longitude: destination.longitude }}
            title={destination.name}
            description="SafeRoute Target Destination"
            pinColor="#D32F2F"
          />
        )}

        {/* Route Polylines */}
        {routesResult && (
          <>
            {/* Direct Route (drawn as secondary/dashed if safest is selected) */}
            {routesResult.direct_route && (
              <Polyline
                coordinates={routesResult.direct_route.coordinates}
                strokeColor={selectedRouteType === 'direct' ? '#E65100' : 'rgba(230, 81, 0, 0.4)'}
                strokeWidth={selectedRouteType === 'direct' ? 6 : 4}
                lineDashPattern={selectedRouteType === 'safest' ? [6, 6] : undefined}
                tappable={true}
                onPress={() => setSelectedRouteType('direct')}
              />
            )}

            {/* Safest Route (vibrant green, solid) */}
            {routesResult.safest_route && (
              <Polyline
                coordinates={routesResult.safest_route.coordinates}
                strokeColor={selectedRouteType === 'safest' ? '#00C853' : 'rgba(0, 200, 83, 0.5)'}
                strokeWidth={selectedRouteType === 'safest' ? 7 : 4}
                tappable={true}
                onPress={() => setSelectedRouteType('safest')}
              />
            )}

            {/* Detour Waypoints (if risk avoidance detour was created) */}
            {routesResult.safest_route?.detour_waypoints?.map((wp, i) => (
              <Marker
                key={`wp-${i}`}
                coordinate={wp}
                title="Safety Detour Waypoint"
                description="Bypasses high-risk crime zone"
              >
                <View style={styles.detourBadge}>
                  <FontAwesome name="shield" size={14} color="#fff" />
                </View>
              </Marker>
            ))}
          </>
        )}
      </MapView>

      {/* Map Legend */}
      <View style={styles.legendContainer}>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: 'rgba(255, 0, 0, 0.5)' }]} />
          <ThemedText style={styles.legendText}>High Risk</ThemedText>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: 'rgba(255, 165, 0, 0.5)' }]} />
          <ThemedText style={styles.legendText}>Moderate Risk</ThemedText>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: 'rgba(255, 255, 0, 0.5)' }]} />
          <ThemedText style={styles.legendText}>Low Risk</ThemedText>
        </View>
        {routesResult && (
          <>
            <View style={styles.legendDivider} />
            <View style={styles.legendItem}>
              <View style={[styles.legendLine, { backgroundColor: '#00C853' }]} />
              <ThemedText style={styles.legendText}>Safe Route</ThemedText>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendLine, { backgroundColor: '#E65100' }]} />
              <ThemedText style={styles.legendText}>Direct Route</ThemedText>
            </View>
          </>
        )}
      </View>

      {/* Loading Indicator */}
      {(isInitializing || isCalculatingRoute) && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1A237E" />
          <ThemedText style={styles.loadingText}>
            {isCalculatingRoute ? 'Optimizing route with risk avoidance...' : 'Initializing safety features...'}
          </ThemedText>
        </View>
      )}

      {/* Bottom Route Summary Card (When routes exist) */}
      {routesResult && currentActiveRoute && (
        <View style={styles.routeCard}>
          {/* Route Type Tabs */}
          <View style={styles.routeTabs}>
            <TouchableOpacity
              style={[styles.routeTab, selectedRouteType === 'safest' && styles.routeTabActiveSafe]}
              onPress={() => setSelectedRouteType('safest')}
            >
              <FontAwesome name="shield" size={14} color={selectedRouteType === 'safest' ? '#fff' : '#00C853'} />
              <Text style={[styles.routeTabText, selectedRouteType === 'safest' && styles.routeTabTextActive]}>
                🛡️ Safest ({routesResult.safest_route.duration_minutes}m)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.routeTab, selectedRouteType === 'direct' && styles.routeTabActiveDirect]}
              onPress={() => setSelectedRouteType('direct')}
            >
              <FontAwesome name="bolt" size={14} color={selectedRouteType === 'direct' ? '#fff' : '#E65100'} />
              <Text style={[styles.routeTabText, selectedRouteType === 'direct' && styles.routeTabTextActive]}>
                ⚡ Direct ({routesResult.direct_route.duration_minutes}m)
              </Text>
            </TouchableOpacity>
          </View>

          {/* Route Details */}
          <View style={styles.routeDetailsRow}>
            <View style={styles.metricBlock}>
              <Text style={styles.metricValue}>{currentActiveRoute.distance_km} km</Text>
              <Text style={styles.metricLabel}>Distance</Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metricBlock}>
              <Text style={styles.metricValue}>{currentActiveRoute.duration_minutes} min</Text>
              <Text style={styles.metricLabel}>{travelMode === 'walking' ? 'Walk' : 'Drive'}</Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metricBlock}>
              <View style={[styles.safetyBadge, { backgroundColor: currentActiveRoute.is_safe ? '#E8F5E9' : '#FFEBEE' }]}>
                <Text style={[styles.safetyBadgeText, { color: currentActiveRoute.is_safe ? '#2E7D32' : '#C62828' }]}>
                  {currentActiveRoute.is_safe ? 'Safe Area' : `Risk: ${currentActiveRoute.risk_level}`}
                </Text>
              </View>
              <Text style={styles.metricLabel}>Safety Status</Text>
            </View>
          </View>

          {/* Avoidance Alert Banner */}
          {selectedRouteType === 'safest' && routesResult.risk_avoidance_applied ? (
            <View style={styles.avoidanceBanner}>
              <FontAwesome name="check-circle" size={16} color="#2E7D32" />
              <Text style={styles.avoidanceBannerText}>
                {routesResult.safety_message}
              </Text>
            </View>
          ) : selectedRouteType === 'direct' && !currentActiveRoute.is_safe ? (
            <View style={[styles.avoidanceBanner, { backgroundColor: '#FFF3E0', borderColor: '#FFE0B2' }]}>
              <FontAwesome name="exclamation-triangle" size={16} color="#E65100" />
              <Text style={[styles.avoidanceBannerText, { color: '#BF360C' }]}>
                Direct route crosses {currentActiveRoute.intersected_zones_count} danger area(s)!
              </Text>
            </View>
          ) : null}

          {/* Action Buttons */}
          <View style={styles.routeActions}>
            <TouchableOpacity
              style={[styles.navigateButton, isNavigating && styles.navigatingActiveButton]}
              onPress={() => {
                setIsNavigating(!isNavigating);
                Alert.alert(
                  isNavigating ? 'Navigation Ended' : 'Navigation Started',
                  isNavigating
                    ? 'Safe route navigation stopped.'
                    : `Following ${selectedRouteType === 'safest' ? 'Safest' : 'Direct'} route. Real-time crime radar is monitoring your path.`
                );
              }}
            >
              <FontAwesome name={isNavigating ? 'stop-circle' : 'location-arrow'} size={18} color="#fff" />
              <Text style={styles.navigateButtonText}>
                {isNavigating ? 'Exit Navigation' : 'Start Safe Navigation'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.clearRouteButton} onPress={handleClearRoute}>
              <FontAwesome name="times" size={16} color="#666" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Manual Check Now Button (Shown when no route is active) */}
      {!routesResult && (
        <View style={styles.controlsContainer}>
          <TouchableOpacity
            style={[styles.sendButton, isSending && styles.disabledButton]}
            onPress={() => {
              if (location) {
                checkRiskArea(location, true);
              }
            }}
            disabled={isSending}
          >
            <FontAwesome name="shield" size={18} color="#fff" />
            <ThemedText style={styles.buttonText}>
              {isSending ? 'Scanning Area...' : 'Check Current Area Risk'}
            </ThemedText>
          </TouchableOpacity>
        </View>
      )}

      {errorMsg && (
        <View style={styles.errorContainer}>
          <ThemedText style={styles.errorText}>{errorMsg}</ThemedText>
        </View>
      )}
    </View>
  );
}

const getRiskColor = (level: string) => {
  switch (level) {
    case 'A':
      return 'rgba(255, 0, 0, 0.45)';
    case 'B':
      return 'rgba(255, 165, 0, 0.45)';
    case 'C':
      return 'rgba(255, 255, 0, 0.45)';
    default:
      return 'transparent';
  }
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    width: '100%',
    height: '100%',
  },
  topBarContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 55 : 35,
    left: 15,
    right: 15,
    zIndex: 10,
    gap: 8,
  },
  searchBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    padding: 6,
    alignItems: 'center',
  },
  searchButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchText: {
    fontSize: 15,
    color: '#1A237E',
    fontWeight: '500',
  },
  mapPinButton: {
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#F0F0F5',
    marginLeft: 4,
  },
  mapPinButtonActive: {
    backgroundColor: '#1A237E',
  },
  modeSelector: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 20,
    padding: 3,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    gap: 4,
  },
  modeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 16,
    gap: 6,
  },
  modeButtonActive: {
    backgroundColor: '#1A237E',
  },
  modeButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#555',
  },
  modeButtonTextActive: {
    color: '#fff',
  },
  tapBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8EAF6',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 8,
    borderWidth: 1,
    borderColor: '#C5CAE9',
  },
  tapBannerText: {
    fontSize: 12,
    color: '#1A237E',
    fontWeight: '500',
  },
  drawerContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 145 : 125,
    left: 15,
    right: 15,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    zIndex: 11,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
  },
  drawerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  drawerTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1A237E',
  },
  presetScroll: {
    flexDirection: 'row',
  },
  presetChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F2F9',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    marginRight: 8,
    gap: 6,
  },
  presetText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#1A237E',
  },
  detourBadge: {
    backgroundColor: '#00C853',
    padding: 6,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#fff',
    elevation: 4,
  },
  routeCard: {
    position: 'absolute',
    bottom: 25,
    left: 15,
    right: 15,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
  },
  routeTabs: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  routeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#F5F5F5',
    gap: 6,
  },
  routeTabActiveSafe: {
    backgroundColor: '#00C853',
  },
  routeTabActiveDirect: {
    backgroundColor: '#E65100',
  },
  routeTabText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#333',
  },
  routeTabTextActive: {
    color: '#fff',
  },
  routeDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 8,
  },
  metricBlock: {
    alignItems: 'center',
  },
  metricValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1A237E',
  },
  metricLabel: {
    fontSize: 11,
    color: '#777',
    marginTop: 2,
  },
  metricDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#E0E0E0',
  },
  safetyBadge: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  safetyBadgeText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  avoidanceBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    borderWidth: 1,
    borderColor: '#C8E6C9',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginVertical: 10,
    gap: 8,
  },
  avoidanceBannerText: {
    fontSize: 12,
    color: '#2E7D32',
    fontWeight: '600',
    flex: 1,
  },
  routeActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 6,
  },
  navigateButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1A237E',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 8,
  },
  navigatingActiveButton: {
    backgroundColor: '#D32F2F',
  },
  navigateButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
  },
  clearRouteButton: {
    padding: 12,
    backgroundColor: '#F0F0F0',
    borderRadius: 10,
  },
  controlsContainer: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    right: 20,
    alignItems: 'center',
  },
  sendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A237E',
    paddingVertical: 13,
    paddingHorizontal: 22,
    borderRadius: 12,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  errorContainer: {
    position: 'absolute',
    top: 100,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(220, 53, 69, 0.9)',
    padding: 10,
    borderRadius: 8,
  },
  errorText: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: '500',
  },
  loadingContainer: {
    position: 'absolute',
    top: '45%',
    left: 30,
    right: 30,
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    padding: 22,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 6,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: '#1A237E',
    textAlign: 'center',
    fontWeight: '600',
  },
  legendContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 145 : 125,
    right: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    width: 130,
    elevation: 3,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 3,
  },
  legendColor: {
    width: 16,
    height: 16,
    borderRadius: 3,
    marginRight: 6,
  },
  legendLine: {
    width: 16,
    height: 4,
    borderRadius: 2,
    marginRight: 6,
  },
  legendDivider: {
    height: 1,
    backgroundColor: '#eee',
    marginVertical: 4,
  },
  legendText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#333',
  },
});