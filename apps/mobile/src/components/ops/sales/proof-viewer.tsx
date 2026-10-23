/** Full-screen viewer for a private proof image via a short-lived signed URL. */
import { useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "~/components/ui";
import { trpcClient } from "~/utils/api";
import { showError } from "~/utils/feedback";

export function ProofButton({ refundRequestId }: { refundRequestId: string }) {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [imgLoading, setImgLoading] = useState(true);

  const open = async () => {
    setLoading(true);
    try {
      // Fetch fresh every time: signed URLs expire quickly.
      const res = await trpcClient.refund.proofUrl.query({ refundRequestId });
      if (!res.url) throw new Error("No transfer receipt was uploaded.");
      setImgLoading(true);
      setUrl(res.url);
    } catch (err) {
      showError(err, "Couldn't open the receipt");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        label="View transfer receipt"
        variant="outline"
        loading={loading}
        onPress={() => void open()}
      />
      <Modal
        visible={url !== null}
        animationType="fade"
        onRequestClose={() => setUrl(null)}
      >
        <View className="flex-1 bg-black" style={{ paddingTop: insets.top }}>
          <View className="flex-row justify-end p-3">
            <Pressable onPress={() => setUrl(null)} hitSlop={12}>
              <Text className="text-base font-semibold text-white">Close</Text>
            </Pressable>
          </View>
          <View className="flex-1 items-center justify-center">
            {url ? (
              <Image
                source={{ uri: url }}
                resizeMode="contain"
                style={{ width: "100%", height: "100%" }}
                onLoadEnd={() => setImgLoading(false)}
                onError={() => {
                  setImgLoading(false);
                  showError(
                    new Error("The receipt image failed to load."),
                    "Couldn't open the receipt",
                  );
                }}
              />
            ) : null}
            {imgLoading ? (
              <View className="absolute">
                <ActivityIndicator color="#ffffff" size="large" />
              </View>
            ) : null}
          </View>
        </View>
      </Modal>
    </>
  );
}
