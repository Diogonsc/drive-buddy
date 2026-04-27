import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type ConnectionStatus = "connected" | "disconnected" | "pending" | "error";

export interface WhatsAppConnection {
  id: string;
  label: string | null;
  phone_number_id: string;
  twilio_account_sid: string | null;
  customer_phone_number: string | null;
  twilio_whatsapp_number: string | null;
  twilio_subaccount_sid: string | null;
  status: ConnectionStatus;
  connected_at: string | null;
}

export interface GoogleDriveAccount {
  id: string;
  label: string | null;
  account_email: string | null;
  status: ConnectionStatus;
  connected_at: string | null;
  root_folder_path?: string;
}

export interface RoutingRule {
  id: string;
  whatsapp_connection_id: string;
  google_drive_account_id: string;
  file_type: "image" | "video" | "audio" | "document" | null;
  is_default: boolean;
  is_active: boolean;
  created_at?: string;
}

interface UseConnectionsResult {
  isLoading: boolean;
  whatsappConnections: WhatsAppConnection[];
  googleAccounts: GoogleDriveAccount[];
  routingRules: RoutingRule[];
  refetch: () => Promise<void>;
}

export function getOverallConnectionStatus(
  connections: Array<{ status: ConnectionStatus }>,
): ConnectionStatus {
  return (
    connections.find((item) => item.status === "connected")?.status ||
    connections.find((item) => item.status === "pending")?.status ||
    connections[0]?.status ||
    "disconnected"
  );
}

export function useConnections(userId?: string): UseConnectionsResult {
  const [isLoading, setIsLoading] = useState(true);
  const [whatsappConnections, setWhatsappConnections] = useState<WhatsAppConnection[]>([]);
  const [googleAccounts, setGoogleAccounts] = useState<GoogleDriveAccount[]>([]);
  const [routingRules, setRoutingRules] = useState<RoutingRule[]>([]);

  const refetch = useCallback(async () => {
    if (!userId) {
      setWhatsappConnections([]);
      setGoogleAccounts([]);
      setRoutingRules([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const [{ data: wa }, { data: google }, { data: rules }] = await Promise.all([
        supabase
          .from("whatsapp_connections")
          .select(
            "id, label, phone_number_id, customer_phone_number, twilio_whatsapp_number, twilio_subaccount_sid, twilio_account_sid, status, connected_at",
          )
          .eq("user_id", userId)
          .order("created_at", { ascending: true }),
        supabase
          .from("google_drive_accounts")
          .select("id, label, account_email, status, connected_at, root_folder_path")
          .eq("user_id", userId)
          .order("created_at", { ascending: true }),
        supabase
          .from("media_routing_rules")
          .select("id, whatsapp_connection_id, google_drive_account_id, file_type, is_default, is_active, created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false }),
      ]);

      setWhatsappConnections((wa || []) as unknown as WhatsAppConnection[]);
      setGoogleAccounts((google || []) as unknown as GoogleDriveAccount[]);
      setRoutingRules((rules || []) as unknown as RoutingRule[]);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return {
    isLoading,
    whatsappConnections,
    googleAccounts,
    routingRules,
    refetch,
  };
}
