import { ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";

import { Button, Card } from "~/components/ui";
import { authClient } from "~/utils/auth";
import { clearCsvExports } from "~/utils/share-csv";

/** Staff account: who you're signed in as, and sign out. */
export default function StaffAccountScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: session } = authClient.useSession();

  const signOut = async () => {
    await authClient.signOut();
    queryClient.clear();
    clearCsvExports();
    router.replace("/(auth)/sign-in");
  };

  return (
    <ScrollView contentContainerClassName="p-4 gap-4">
      <Card className="gap-1">
        <Text className="text-foreground text-xl font-bold">
          {session?.user.name}
        </Text>
        <Text className="text-muted-foreground">{session?.user.email}</Text>
      </Card>
      <View className="mt-4">
        <Button label="Sign out" variant="destructive" onPress={signOut} />
      </View>
    </ScrollView>
  );
}
