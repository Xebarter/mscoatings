import { useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { saveOfflineSession, userHasAdminRole } from '@/lib/admin-auth';

interface AuthState {
  user: User | null;
  isAdmin: boolean;
  loading: boolean;
}

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({
    user: null,
    isAdmin: false,
    loading: true,
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user && userHasAdminRole(user)) {
        await saveOfflineSession(user);
        setState({ user, isAdmin: true, loading: false });
        return;
      }
      setState({
        user,
        isAdmin: false,
        loading: false,
      });
    });
    return unsubscribe;
  }, []);

  return state;
}
