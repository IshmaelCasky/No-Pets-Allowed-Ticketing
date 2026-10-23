import { Text } from "react-native";
import { Redirect, Tabs } from "expo-router";

import { Loading } from "~/components/ui";
import { ADMIN_TABS } from "~/utils/admin-tabs";
import { authClient } from "~/utils/auth";
import { usePermissions } from "~/utils/use-permissions";

function TabIcon({ glyph, color }: { glyph: string; color: string }) {
  return <Text style={{ color, fontSize: 20 }}>{glyph}</Text>;
}

/**
 * Staff/admin section. Each tab shows only if the role has one of its
 * permission keys (same gating as the web admin sidebar). "More" holds
 * Users, Roles, Audit Logs and Account.
 */
export default function AdminLayout() {
  const { data: session, isPending } = authClient.useSession();
  const { hasAny, isStaff, isLoading } = usePermissions();

  if (isPending || isLoading) return <Loading />;
  if (!session?.user) return <Redirect href="/(auth)/sign-in" />;
  // Customers never see the admin section.
  if (!isStaff) return <Redirect href="/(tabs)/events" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#2f7de6",
      }}
    >
      <Tabs.Screen name="index" options={{ href: null }} />
      {ADMIN_TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            href: hasAny(tab.anyOf) ? undefined : null,
            tabBarIcon: ({ color }) => (
              <TabIcon glyph={tab.glyph} color={color} />
            ),
          }}
        />
      ))}
      <Tabs.Screen
        name="more"
        options={{
          title: "More",
          tabBarIcon: ({ color }) => <TabIcon glyph="☰" color={color} />,
        }}
      />
    </Tabs>
  );
}
