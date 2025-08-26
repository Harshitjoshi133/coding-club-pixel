import { useEffect, useState } from 'react';
import { auth } from '@/lib/firebase';
import { User, signInAnonymously, onAuthStateChanged } from 'firebase/auth';

export function useAuthAnonymously() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        try {
          const result = await signInAnonymously(auth);
          setUser(result.user);
        } catch (error) {
          console.error('Error signing in anonymously:', error);
        }
      } else {
        setUser(currentUser);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return { user, loading };
}