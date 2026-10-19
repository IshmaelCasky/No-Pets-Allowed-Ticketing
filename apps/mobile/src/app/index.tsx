import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack } from "expo-router";

import { authClient } from "~/utils/auth";

// Placeholder home screen. Replaced by the `mobile-app` agent in Phase 2 with
// the real customer flow (events, checkout, My Tickets) + role-gated scanner.
function MobileAuth() {
  const { data: session } = authClient.useSession();

  return (
    <>
      <Text className="text-foreground pb-2 text-center text-xl font-semibold">
        {session?.user.name ? `Hello, ${session.user.name}` : "Not logged in"}
      </Text>
      {session ? (
        <Pressable
          onPress={() => authClient.signOut()}
          className="bg-primary flex items-center rounded-sm p-2"
        >
          <Text>Sign Out</Text>
        </Pressable>
      ) : null}
    </>
  );
}

export default function Index() {
  return (
    <SafeAreaView className="bg-background">
      <Stack.Screen options={{ title: "No Pets Allowed" }} />
      <View className="bg-background h-full w-full p-4">
        <Text className="text-foreground pb-2 text-center text-5xl font-bold">
          No Pets <Text className="text-primary">Allowed</Text>
        </Text>
        <MobileAuth />
      </View>
    </SafeAreaView>
  );
}
