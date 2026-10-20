import { Text } from "react-native";
import { Redirect, Tabs } from "expo-router";

import { authClient } from "~/utils/auth";
import { usePermissions } from "~/utils/use-permissions";

/** Simple text-glyph tab icon (keeps the dep surface small). */
function TabIcon({ glyph, color }: { glyph: string; color: string }) {
  return <Text style={{ color, fontSize: 20 }}>{glyph}</Text>;
}

export default function TabsLayout() {
  const { data: session, isPending } = authClient.useSession();
  const { has } = usePermissions();

  if (isPending) return null;
  if (!session?.user) return <Redirect href="/(auth)/sign-in" />;

  const canScan = has("tickets:scan");

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#c03484",
        headerStyle: { backgroundColor: "#c03484" },
        headerTintColor: "#ffffff",
      }}
    >
      <Tabs.Screen
        name="events"
        options={{
          title: "Events",
          tabBarIcon: ({ color }) => <TabIcon glyph="🎵" color={color} />,
        }}
      />
      <Tabs.Screen
        name="tickets"
        options={{
          title: "My Tickets",
          tabBarIcon: ({ color }) => <TabIcon glyph="🎟" color={color} />,
        }}
      />
      <Tabs.Screen
        name="scanner"
        options={{
          title: "Scanner",
          href: canScan ? undefined : null,
          tabBarIcon: ({ color }) => <TabIcon glyph="📷" color={color} />,
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: "Account",
          tabBarIcon: ({ color }) => <TabIcon glyph="👤" color={color} />,
        }}
      />
    </Tabs>
  );
}
