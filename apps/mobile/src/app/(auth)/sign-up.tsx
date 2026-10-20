import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Link, useRouter } from "expo-router";

import { signUpSchema } from "@npa/validators";

import { Button, Field } from "~/components/ui";
import { authClient } from "~/utils/auth";

export default function SignUp() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    setError(null);
    const parsed = signUpSchema.safeParse({ name, email, password, phone });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid details");
      return;
    }
    setLoading(true);
    const res = await authClient.signUp.email({
      name: parsed.data.name,
      email: parsed.data.email,
      password: parsed.data.password,
    });
    setLoading(false);
    if (res.error) {
      setError(res.error.message ?? "Could not create account");
      return;
    }
    router.replace("/(tabs)/events");
  };

  return (
    <SafeAreaView className="bg-background flex-1">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
      >
        <ScrollView contentContainerClassName="flex-grow justify-center p-6 gap-6">
          <View className="gap-1">
            <Text className="text-foreground text-4xl font-bold">
              Create account
            </Text>
            <Text className="text-muted-foreground">
              An account is required to purchase tickets.
            </Text>
          </View>

          <View className="gap-4">
            <Field
              label="Name"
              value={name}
              onChangeText={setName}
              placeholder="Juan Dela Cruz"
            />
            <Field
              label="Email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="you@example.com"
            />
            <Field
              label="Phone (optional)"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              placeholder="09xx xxx xxxx"
            />
            <Field
              label="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="At least 8 characters"
            />
            {error ? (
              <Text className="text-destructive text-sm">{error}</Text>
            ) : null}
            <Button label="Sign Up" onPress={onSubmit} loading={loading} />
          </View>

          <View className="flex-row justify-center gap-1">
            <Text className="text-muted-foreground">Have an account?</Text>
            <Link href="/(auth)/sign-in" className="text-primary font-semibold">
              Sign in
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
