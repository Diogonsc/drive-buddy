import { useState, useEffect, ReactNode } from "react";
import Offline from "@/pages/Offline";

export function OfflineGate({ children }: { children: ReactNode }) {
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  if (!online) return <Offline />;
  return <>{children}</>;
}
