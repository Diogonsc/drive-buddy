export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

// Enums do banco — gerados de pg_enum em 2025-05-01
export type AppRole = 'admin' | 'user'
export type ConnectionStatus = 'connected' | 'disconnected' | 'pending' | 'error'
export type HealthCheckType = 'whatsapp_token' | 'whatsapp_webhook' | 'google_token' | 'google_api' | 'media_processing'
export type HealthStatus = 'healthy' | 'warning' | 'critical' | 'unknown'
export type MediaType = 'image' | 'video' | 'audio' | 'document'
export type PlanType = 'free' | 'starter' | 'pro' | 'business' | 'professional' | 'scale'
export type SyncStatus = 'pending' | 'processing' | 'completed' | 'failed'

export interface Database {
  public: {
    Tables: {
      user_roles: {
        Row: {
          id: string
          user_id: string
          role: AppRole
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          role: AppRole
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          role?: AppRole
          created_at?: string
        }
      }
      connections: {
        Row: {
          id: string
          user_id: string
          whatsapp_phone_number_id: string | null
          whatsapp_business_account_id: string | null
          whatsapp_access_token: string | null
          whatsapp_webhook_verify_token: string | null
          whatsapp_status: string
          whatsapp_connected_at: string | null
          google_client_id: string | null
          google_client_secret: string | null
          google_redirect_uri: string | null
          google_access_token: string | null
          google_refresh_token: string | null
          google_token_expires_at: string | null
          google_status: string
          google_connected_at: string | null
          google_root_folder: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          whatsapp_phone_number_id?: string | null
          whatsapp_business_account_id?: string | null
          whatsapp_access_token?: string | null
          whatsapp_webhook_verify_token?: string | null
          whatsapp_status?: string
          whatsapp_connected_at?: string | null
          google_client_id?: string | null
          google_client_secret?: string | null
          google_redirect_uri?: string | null
          google_access_token?: string | null
          google_refresh_token?: string | null
          google_token_expires_at?: string | null
          google_status?: string
          google_connected_at?: string | null
          google_root_folder?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          whatsapp_phone_number_id?: string | null
          whatsapp_business_account_id?: string | null
          whatsapp_access_token?: string | null
          whatsapp_webhook_verify_token?: string | null
          whatsapp_status?: string
          whatsapp_connected_at?: string | null
          google_client_id?: string | null
          google_client_secret?: string | null
          google_redirect_uri?: string | null
          google_access_token?: string | null
          google_refresh_token?: string | null
          google_token_expires_at?: string | null
          google_status?: string
          google_connected_at?: string | null
          google_root_folder?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      user_settings: {
        Row: {
          id: string
          user_id: string
          auto_sync_enabled: boolean
          sync_images: boolean
          sync_videos: boolean
          sync_audio: boolean
          sync_documents: boolean
          folder_structure: string
          notification_email: string | null
          notification_on_error: boolean
          notification_on_success: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          auto_sync_enabled?: boolean
          sync_images?: boolean
          sync_videos?: boolean
          sync_audio?: boolean
          sync_documents?: boolean
          folder_structure?: string
          notification_email?: string | null
          notification_on_error?: boolean
          notification_on_success?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          auto_sync_enabled?: boolean
          sync_images?: boolean
          sync_videos?: boolean
          sync_audio?: boolean
          sync_documents?: boolean
          folder_structure?: string
          notification_email?: string | null
          notification_on_error?: boolean
          notification_on_success?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      media_files: {
        Row: {
          id: string
          user_id: string
          whatsapp_media_id: string
          media_type: MediaType
          mime_type: string
          file_name: string | null
          file_size: number | null
          google_drive_file_id: string | null
          google_drive_url: string | null
          sync_status: SyncStatus
          error_message: string | null
          sender_phone: string | null
          received_at: string
          synced_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          whatsapp_media_id: string
          media_type: MediaType
          mime_type: string
          file_name?: string | null
          file_size?: number | null
          google_drive_file_id?: string | null
          google_drive_url?: string | null
          sync_status?: SyncStatus
          error_message?: string | null
          sender_phone?: string | null
          received_at?: string
          synced_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          whatsapp_media_id?: string
          media_type?: MediaType
          mime_type?: string
          file_name?: string | null
          file_size?: number | null
          google_drive_file_id?: string | null
          google_drive_url?: string | null
          sync_status?: SyncStatus
          error_message?: string | null
          sender_phone?: string | null
          received_at?: string
          synced_at?: string | null
          created_at?: string
        }
      }
      sync_logs: {
        Row: {
          id: string
          user_id: string
          media_file_id: string | null
          action: string
          status: SyncStatus
          message: string | null
          metadata: Json | null
          source: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          media_file_id?: string | null
          action: string
          status: SyncStatus
          message?: string | null
          metadata?: Json | null
          source?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          media_file_id?: string | null
          action?: string
          status?: SyncStatus
          message?: string | null
          metadata?: Json | null
          source?: string | null
          created_at?: string
        }
      }
      subscriptions: {
        Row: {
          id: string
          user_id: string
          plan: PlanType
          plan_name: string | null
          plan_price: number | null
          monthly_file_limit: number | null
          files_used_current_month: number | null
          overage_enabled: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          plan?: PlanType
          plan_name?: string | null
          plan_price?: number | null
          monthly_file_limit?: number | null
          files_used_current_month?: number | null
          overage_enabled?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          plan?: PlanType
          plan_name?: string | null
          plan_price?: number | null
          monthly_file_limit?: number | null
          files_used_current_month?: number | null
          overage_enabled?: boolean
          created_at?: string
          updated_at?: string
        }
      }
    }
    Functions: {
      has_role: {
        Args: {
          _user_id: string
          _role: AppRole
        }
        Returns: boolean
      }
      increment_files_used: {
        Args: {
          p_user_id: string
        }
        Returns: void
      }
    }
  }
}
