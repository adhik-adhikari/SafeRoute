import React, { createContext, useContext, useState, useEffect } from 'react';
import { useGoogleAuth } from '../services/auth';

interface User {
  email: string | null;
  displayName?: string | null;
  photoURL?: string | null;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const { userInfo } = useGoogleAuth();

  useEffect(() => {
    try {
      if (userInfo) {
        setUser({
          email: userInfo.email ?? null,
          displayName: userInfo.displayName ?? null,
          photoURL: userInfo.photoUrl ?? null,
        });
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error('Auth initialization error:', error);
    } finally {
      setLoading(false);
    }
  }, [userInfo]);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext); 