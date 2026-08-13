import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/integrations/firebase/config";

type AppSettings = {
  showReports?: boolean;
  showFileWorkspace?: boolean;
};

export function useAppSettings() {
  const [settings, setSettings] = useState<AppSettings & { loading?: boolean }>({ loading: true });
  useEffect(() => {
    const ref = doc(db, "app_settings", "nav");
    const unsub = onSnapshot(ref, (snap) => {
      if (!snap.exists()) {
        setSettings({ loading: false });
        return;
      }
      setSettings({ ...(snap.data() as AppSettings), loading: false });
    });
    return unsub;
  }, []);
  return settings;
}

export default useAppSettings;
