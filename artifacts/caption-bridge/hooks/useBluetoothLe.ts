import { useCallback, useEffect, useState } from "react";
import { NativeModules, Platform } from "react-native";

const { BluetoothLeModule } = NativeModules;
const isSupported = Platform.OS === "android" && !!BluetoothLeModule;

export function useBluetoothLe() {
  const [isLeAudioSupported, setIsLeAudioSupported] = useState<boolean | null>(null);

  useEffect(() => {
    if (!isSupported) {
      setIsLeAudioSupported(false);
      return;
    }
    BluetoothLeModule.isLeAudioSupported().then((supported: boolean) => {
      setIsLeAudioSupported(supported);
    });
  }, []);

  const openBroadcastAssistant = useCallback(() => {
    if (!isSupported) return;
    BluetoothLeModule.openBroadcastAssistant();
  }, []);

  return {
    isSupported,
    isLeAudioSupported,
    openBroadcastAssistant,
  };
}
