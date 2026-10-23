import { useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Link, useRouter } from "expo-router";

import { signInSchema } from "@npa/validators";

import { Button, Field } from "~/components/ui";
import { authClient } from "~/utils/auth";

// eslint-disable-next-line @typescript-eslint/no-require-imports -- static asset module id
const LOGO = require("../../../assets/logo.jpg") as number;

export default function SignIn() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    setError(null);
    const parsed = signInSchema.safeParse({ email, password });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid details");
      return;
    }
    setLoading(true);
    const res = await authClient.signIn.email({
      email: parsed.data.email,
      password: parsed.data.password,
    });
    setLoading(false);
    if (res.error) {
      setError(res.error.message ?? "Could not sign in");
      return;
    }
    // Let the entry gate route staff to /admin and customers to the store.
    router.replace("/");
  };

  return (
    <SafeAreaView className="bg-background flex-1">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
      >
        <ScrollView contentContainerClassName="flex-grow justify-center p-6 gap-6">
          <View className="items-center gap-3">
            <Image
              source={LOGO}
              style={{ width: 260, height: 102 }}
              resizeMode="contain"
              className="rounded-lg"
            />
            <Text className="text-muted-foreground text-center">
              Sign in to buy tickets and manage your orders.
            </Text>
          </View>

          <View className="gap-4">
            <Field
              label="Email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="you@example.com"
            />
            <Field
              label="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="Your password"
            />
            {error ? (
              <Text className="text-destructive text-sm">{error}</Text>
            ) : null}
            <Button label="Sign In" onPress={onSubmit} loading={loading} />
          </View>

          <View className="flex-row justify-center gap-1">
            <Text className="text-muted-foreground">No account?</Text>
            <Link href="/(auth)/sign-up" className="text-primary font-semibold">
              Sign up
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
