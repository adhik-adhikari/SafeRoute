// Check if we're running in a mobile environment
const isMobile = typeof window !== 'undefined' && window.navigator && window.navigator.product === 'ReactNative';

// Use your computer's local IP address (e.g., 192.168.x.x) instead of localhost
// Find this by running 'ipconfig getifaddr en0' on Mac or 'ipconfig' on Windows
export const API_BASE_URL = 'http://10.0.0.202:8000/api';
// export const API_BASE_URL = 'http://localhost:8000/api'; // For iOS simulator only

// This will be used on laptop