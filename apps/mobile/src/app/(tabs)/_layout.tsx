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
  const { isStaff, isLoading } = usePermissions();

  if (isPending || isLoading) return null;
  if (!session?.user) return <Redirect href="/(auth)/sign-in" />;
  // Staff/admin accounts use the admin section, never the customer tabs.
  if (isStaff) return <Redirect href="/admin" />;

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
        name="account"
        options={{
          title: "Account",
          tabBarIcon: ({ color }) => <TabIcon glyph="👤" color={color} />,
        }}
      />
    </Tabs>
  );
}
