import { useColorScheme } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";

import { queryClient } from "~/utils/api";
import { asyncStoragePersister } from "~/utils/persister";

import "../styles.css";

// Root layout: wraps the app with gesture handling + a persisted React Query
// client (approved tickets survive restarts / offline) and the navigation Stack.
export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PersistQueryClientProvider
          client={queryClient}
          persistOptions={{
            persister: asyncStoragePersister,
            maxAge: 1000 * 60 * 60 * 24 * 7,
          }}
        >
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: "#c03484" },
              headerTintColor: "#ffffff",
              contentStyle: {
                backgroundColor: colorScheme === "dark" ? "#09090B" : "#FFFFFF",
              },
            }}
          >
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          </Stack>
          <StatusBar style="light" />
        </PersistQueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
