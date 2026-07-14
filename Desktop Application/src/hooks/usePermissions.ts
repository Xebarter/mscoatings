import { useAuth } from '@/hooks/useAuth';
import type { Permissions } from '@/lib/types';

export function usePermissions() {
  const { loading, user, role, permissions, accessStatus } = useAuth();

  const can = (key: keyof Permissions): boolean => {
    if (!permissions) return false;
    const value = permissions[key];
    return typeof value === 'boolean' ? value : false;
  };

  return {
    loading,
    email: user?.email ?? null,
    role,
    permissions,
    accessStatus,
    can,
  };
}
