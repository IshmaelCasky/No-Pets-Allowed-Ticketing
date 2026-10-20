import type {
  PersistedClient,
  Persister,
} from "@tanstack/react-query-persist-client";
import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "npa-rq-cache";

/**
 * AsyncStorage-backed persister so that My Tickets (and the approved ticket QR
 * codes inside it) survive app restarts and display offline. React Query
 * rehydrates this cache on launch, then refetches when the network is back.
 */
export const asyncStoragePersister: Persister = {
  persistClient: async (client: PersistedClient) => {
    try {
      await AsyncStorage.setItem(KEY, JSON.stringify(client));
    } catch {
      // Best-effort cache; ignore write failures.
    }
  },
  restoreClient: async () => {
    try {
      const cached = await AsyncStorage.getItem(KEY);
      return cached ? (JSON.parse(cached) as PersistedClient) : undefined;
    } catch {
      return undefined;
    }
  },
  removeClient: async () => {
    try {
      await AsyncStorage.removeItem(KEY);
    } catch {
      // ignore
    }
  },
};
