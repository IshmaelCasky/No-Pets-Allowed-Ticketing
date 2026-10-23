import { ScrollView, Text } from "react-native";
import { useRouter } from "expo-router";

import type { PermissionKey } from "@npa/validators";

import { ListRow, SectionHeader } from "~/components/admin";
import { usePermissions } from "~/utils/use-permissions";

const MODULES: {
  href: "/admin/more/users" | "/admin/more/roles" | "/admin/more/audit";
  title: string;
  subtitle: string;
  anyOf: readonly PermissionKey[];
}[] = [
  {
    href: "/admin/more/users",
    title: "User Management",
    subtitle: "Staff accounts, roles, bans, password resets",
    anyOf: ["users:read"],
  },
  {
    href: "/admin/more/roles",
    title: "Role Management",
    subtitle: "Roles and their permissions",
    anyOf: ["roles:write"],
  },
  {
    href: "/admin/more/audit",
    title: "Audit Logs",
    subtitle: "Who changed what, and when",
    anyOf: ["audit:read"],
  },
];

/** "More" tab: the admin modules that don't get their own bottom tab. */
export default function MoreScreen() {
  const router = useRouter();
  const { hasAny } = usePermissions();
  const visible = MODULES.filter((m) => hasAny(m.anyOf));

  return (
    <ScrollView contentContainerClassName="p-4 gap-3">
      {visible.length > 0 ? <SectionHeader title="Modules" /> : null}
      {visible.map((m) => (
        <ListRow
          key={m.href}
          title={m.title}
          subtitle={m.subtitle}
          onPress={() => router.push(m.href)}
        />
      ))}
      <SectionHeader title="You" />
      <ListRow
        title="Account"
        subtitle="Profile and sign out"
        onPress={() => router.push("/admin/more/account")}
      />
      <Text className="text-muted-foreground pt-4 text-center text-xs">
        No Pets Allowed · Staff
      </Text>
    </ScrollView>
  );
}
