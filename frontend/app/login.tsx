import React from 'react';
import { StyleSheet, View, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useGoogleAuth } from '../services/auth';
import { router } from 'expo-router';
import { FontAwesome } from '@expo/vector-icons';
import { ThemedText } from '@/components/ThemedText';

export default function LoginScreen() {
  const [isLoading, setIsLoading] = React.useState(false);
  const { signInWithGoogle } = useGoogleAuth();

  const handleGoogleSignIn = async () => {
    try {
      setIsLoading(true);
      await signInWithGoogle();
      router.replace('/(tabs)');
    } catch (error) {
      console.error('Sign in error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      
      {/* Logo and Title */}
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <ThemedText style={styles.title}>SafeRoute</ThemedText>
          <ThemedText style={styles.subtitle}>Navigate with Confidence</ThemedText>
        </View>
      </View>

      {/* Login Form */}
      <View style={styles.formContainer}>
        <TouchableOpacity
          style={styles.googleButton}
          onPress={handleGoogleSignIn}
          disabled={isLoading}
        >
          <FontAwesome name="google" size={24} color="#DB4437" style={styles.googleIcon} />
          <ThemedText style={styles.googleButtonText}>
            {isLoading ? 'Signing in...' : 'Continue with Google'}
          </ThemedText>
          {isLoading && <ActivityIndicator style={styles.loader} color="#4285F4" />}
        </TouchableOpacity>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <ThemedText style={styles.footerText}>
          By continuing, you agree to our Terms of Service and Privacy Policy
        </ThemedText>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingTop: 40,
  },
  header: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 40,
    marginTop: 20,
  },
  titleContainer: {
    alignItems: 'center',
    width: '100%',
    paddingVertical: 10,
  },
  title: {
    fontSize: 42,
    fontWeight: 'bold',
    color: '#1A237E',
    marginBottom: 12,
    textAlign: 'center',
    lineHeight: 50,
    textAlignVertical: 'center',
  },
  subtitle: {
    fontSize: 18,
    color: '#666666',
    textAlign: 'center',
  },
  formContainer: {
    flex: 2,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  googleIcon: {
    marginRight: 12,
  },
  googleButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    flex: 1,
    textAlign: 'center',
  },
  loader: {
    marginLeft: 8,
  },
  footer: {
    padding: 24,
  },
  footerText: {
    textAlign: 'center',
    color: '#666666',
    fontSize: 12,
    lineHeight: 18,
  },
}); 