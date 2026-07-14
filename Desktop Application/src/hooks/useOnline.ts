import { useEffect, useState } from 'react';
import { isOnline, subscribeConnectivity } from '@/lib/offline/connectivity';

export function useOnline(): boolean {
  const [online, setOnline] = useState(isOnline());

  useEffect(() => subscribeConnectivity(setOnline), []);

  return online;
}
