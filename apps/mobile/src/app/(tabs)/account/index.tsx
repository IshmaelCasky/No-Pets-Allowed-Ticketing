import { ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";

import { Button, Card } from "~/components/ui";
import { authClient } from "~/utils/auth";

export default function AccountScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: session } = authClient.useSession();

  const signOut = async () => {
    await authClient.signOut();
    queryClient.clear();
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

      <Card className="gap-2">
        <Button
          label="My orders"
          variant="outline"
          onPress={() => router.push("/(tabs)/tickets/orders")}
        />
        <Button
          label="My refunds"
          variant="outline"
          onPress={() => router.push("/(tabs)/account/refunds")}
        />
      </Card>

      <View className="mt-4">
        <Button label="Sign out" variant="destructive" onPress={signOut} />
      </View>
    </ScrollView>
  );
}
