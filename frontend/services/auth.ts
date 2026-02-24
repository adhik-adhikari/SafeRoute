import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { useEffect, useState } from 'react';

WebBrowser.maybeCompleteAuthSession();

export const useGoogleAuth = () => {
  const [userInfo, setUserInfo] = useState<any>(null);

  const [request, response, promptAsync] = Google.useAuthRequest({
    iosClientId: "969890596290-n832rrc166o71mk1n2k70jaibh018nv1.apps.googleusercontent.com",
    clientId: "969890596290-n832rrc166o71mk1n2k70jaibh018nv1.apps.googleusercontent.com",
    redirectUri: "com.saferoute.app:/oauth2redirect/google"
  });

  useEffect(() => {
    if (response?.type === 'success') {
      const { authentication } = response;
      console.log('Authentication successful:', authentication);
      setUserInfo(authentication);
    } else if (response?.type === 'error') {
      console.error('Authentication error:', response.error);
    }
  }, [response]);

  const signInWithGoogle = async () => {
    try {
      console.log('Starting Google Sign-In...');
      const result = await promptAsync();
      console.log('Sign-in result:', result);
      return result;
    } catch (error) {
      console.error('Google Sign-In Error:', error);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      setUserInfo(null);
    } catch (error) {
      console.error('Sign Out Error:', error);
      throw error;
    }
  };

  return {
    signInWithGoogle,
    signOut,
    userInfo,
  };
}; 