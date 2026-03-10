export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      admin_audit_logs: {
        Row: {
          action: string
          admin_user_id: string
          created_at: string
          id: string
          ip: string | null
          metadata: Json | null
          target_establishment_id: string | null
          target_owner_user_id: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          admin_user_id: string
          created_at?: string
          id?: string
          ip?: string | null
          metadata?: Json | null
          target_establishment_id?: string | null
          target_owner_user_id?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          admin_user_id?: string
          created_at?: string
          id?: string
          ip?: string | null
          metadata?: Json | null
          target_establishment_id?: string | null
          target_owner_user_id?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      admin_users: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          last_access_at: string | null
          level: string
          name: string | null
          role: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          last_access_at?: string | null
          level?: string
          name?: string | null
          role?: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          last_access_at?: string | null
          level?: string
          name?: string | null
          role?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      allowed_establishment_signups: {
        Row: {
          activation_sent_at: string | null
          created_at: string
          email: string
          id: string
          kiwify_order_id: string | null
          paid_at: string | null
          plan_id: string
          used: boolean
        }
        Insert: {
          activation_sent_at?: string | null
          created_at?: string
          email: string
          id?: string
          kiwify_order_id?: string | null
          paid_at?: string | null
          plan_id: string
          used?: boolean
        }
        Update: {
          activation_sent_at?: string | null
          created_at?: string
          email?: string
          id?: string
          kiwify_order_id?: string | null
          paid_at?: string | null
          plan_id?: string
          used?: boolean
        }
        Relationships: []
      }
      appointment_email_jobs: {
        Row: {
          appointment_id: string
          attempts: number
          cancelled_at: string | null
          created_at: string
          customer_email: string
          customer_name: string | null
          dedupe_key: string | null
          email_type: string
          establishment_id: string | null
          id: string
          last_error: string | null
          max_attempts: number
          payload: Json
          provider: string | null
          provider_message_id: string | null
          scheduled_for: string
          sent_at: string | null
          status: string
          subject: string | null
          updated_at: string
        }
        Insert: {
          appointment_id: string
          attempts?: number
          cancelled_at?: string | null
          created_at?: string
          customer_email: string
          customer_name?: string | null
          dedupe_key?: string | null
          email_type: string
          establishment_id?: string | null
          id?: string
          last_error?: string | null
          max_attempts?: number
          payload?: Json
          provider?: string | null
          provider_message_id?: string | null
          scheduled_for: string
          sent_at?: string | null
          status?: string
          subject?: string | null
          updated_at?: string
        }
        Update: {
          appointment_id?: string
          attempts?: number
          cancelled_at?: string | null
          created_at?: string
          customer_email?: string
          customer_name?: string | null
          dedupe_key?: string | null
          email_type?: string
          establishment_id?: string | null
          id?: string
          last_error?: string | null
          max_attempts?: number
          payload?: Json
          provider?: string | null
          provider_message_id?: string | null
          scheduled_for?: string
          sent_at?: string | null
          status?: string
          subject?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      appointment_manage_tokens: {
        Row: {
          appointment_id: string
          created_at: string
          expires_at: string
          id: string
          token_hash: string
          used_at: string | null
        }
        Insert: {
          appointment_id: string
          created_at?: string
          expires_at?: string
          id?: string
          token_hash: string
          used_at?: string | null
        }
        Update: {
          appointment_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          token_hash?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointment_manage_tokens_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          completed_at: string | null
          completed_by: string | null
          created_at: string
          customer_id: string
          customer_notes: string | null
          customer_user_id: string | null
          end_at: string
          establishment_id: string
          id: string
          internal_notes: string | null
          professional_id: string
          reminder_sent_at: string | null
          service_id: string
          start_at: string
          status: string
        }
        Insert: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          customer_id: string
          customer_notes?: string | null
          customer_user_id?: string | null
          end_at: string
          establishment_id: string
          id?: string
          internal_notes?: string | null
          professional_id: string
          reminder_sent_at?: string | null
          service_id: string
          start_at: string
          status?: string
        }
        Update: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          customer_id?: string
          customer_notes?: string | null
          customer_user_id?: string | null
          end_at?: string
          establishment_id?: string
          id?: string
          internal_notes?: string | null
          professional_id?: string
          reminder_sent_at?: string | null
          service_id?: string
          start_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_webhook_events: {
        Row: {
          event_id: string
          event_type: string
          id: string
          ignore_reason: string | null
          ignored: boolean | null
          kiwify_product_id: string | null
          payload: Json
          processed_at: string | null
          processing_error: string | null
          provider: string
          received_at: string
        }
        Insert: {
          event_id: string
          event_type: string
          id?: string
          ignore_reason?: string | null
          ignored?: boolean | null
          kiwify_product_id?: string | null
          payload?: Json
          processed_at?: string | null
          processing_error?: string | null
          provider?: string
          received_at?: string
        }
        Update: {
          event_id?: string
          event_type?: string
          id?: string
          ignore_reason?: string | null
          ignored?: boolean | null
          kiwify_product_id?: string | null
          payload?: Json
          processed_at?: string | null
          processing_error?: string | null
          provider?: string
          received_at?: string
        }
        Relationships: []
      }
      business_hours: {
        Row: {
          close_time: string | null
          closed: boolean
          establishment_id: string
          id: string
          open_time: string | null
          weekday: number
        }
        Insert: {
          close_time?: string | null
          closed?: boolean
          establishment_id: string
          id?: string
          open_time?: string | null
          weekday: number
        }
        Update: {
          close_time?: string | null
          closed?: boolean
          establishment_id?: string
          id?: string
          open_time?: string | null
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "business_hours_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          created_at: string
          email: string | null
          establishment_id: string
          id: string
          name: string
          phone: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          establishment_id: string
          id?: string
          name: string
          phone: string
        }
        Update: {
          created_at?: string
          email?: string | null
          establishment_id?: string
          id?: string
          name?: string
          phone?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
        ]
      }
      entitlements: {
        Row: {
          billing_cycle: string
          created_at: string
          current_period_end: string
          current_period_start: string
          email: string
          id: string
          metadata: Json
          plan: string
          provider: string | null
          provider_ref: string | null
          status: string
          updated_at: string
        }
        Insert: {
          billing_cycle: string
          created_at?: string
          current_period_end: string
          current_period_start?: string
          email: string
          id?: string
          metadata?: Json
          plan: string
          provider?: string | null
          provider_ref?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          billing_cycle?: string
          created_at?: string
          current_period_end?: string
          current_period_start?: string
          email?: string
          id?: string
          metadata?: Json
          plan?: string
          provider?: string | null
          provider_ref?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      establishment_deletion_jobs: {
        Row: {
          completed_at: string | null
          created_at: string
          error: string | null
          establishment_id: string
          id: string
          owner_user_id: string | null
          requested_by_admin_user_id: string
          status: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error?: string | null
          establishment_id: string
          id?: string
          owner_user_id?: string | null
          requested_by_admin_user_id: string
          status?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error?: string | null
          establishment_id?: string
          id?: string
          owner_user_id?: string | null
          requested_by_admin_user_id?: string
          status?: string
        }
        Relationships: []
      }
      establishment_members: {
        Row: {
          created_at: string
          establishment_id: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          establishment_id: string
          id?: string
          role: string
          user_id: string
        }
        Update: {
          created_at?: string
          establishment_id?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "establishment_members_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
        ]
      }
      establishments: {
        Row: {
          address: string | null
          ask_email: boolean
          ask_notes: boolean
          auto_confirm_bookings: boolean
          booking_enabled: boolean
          buffer_minutes: number
          cancellation_policy_text: string | null
          city: string | null
          created_at: string
          description: string | null
          id: string
          instagram: string | null
          logo_url: string | null
          max_future_days: number
          name: string
          owner_user_id: string
          phone: string | null
          plano: string | null
          reminder_hours_before: number
          require_policy_acceptance: boolean
          reschedule_min_hours: number
          slot_interval_minutes: number
          slug: string
          state: string | null
          status: string
          timezone: string
          trial_ends_at: string | null
        }
        Insert: {
          address?: string | null
          ask_email?: boolean
          ask_notes?: boolean
          auto_confirm_bookings?: boolean
          booking_enabled?: boolean
          buffer_minutes?: number
          cancellation_policy_text?: string | null
          city?: string | null
          created_at?: string
          description?: string | null
          id?: string
          instagram?: string | null
          logo_url?: string | null
          max_future_days?: number
          name: string
          owner_user_id?: string
          phone?: string | null
          plano?: string | null
          reminder_hours_before?: number
          require_policy_acceptance?: boolean
          reschedule_min_hours?: number
          slot_interval_minutes?: number
          slug: string
          state?: string | null
          status?: string
          timezone?: string
          trial_ends_at?: string | null
        }
        Update: {
          address?: string | null
          ask_email?: boolean
          ask_notes?: boolean
          auto_confirm_bookings?: boolean
          booking_enabled?: boolean
          buffer_minutes?: number
          cancellation_policy_text?: string | null
          city?: string | null
          created_at?: string
          description?: string | null
          id?: string
          instagram?: string | null
          logo_url?: string | null
          max_future_days?: number
          name?: string
          owner_user_id?: string
          phone?: string | null
          plano?: string | null
          reminder_hours_before?: number
          require_policy_acceptance?: boolean
          reschedule_min_hours?: number
          slot_interval_minutes?: number
          slug?: string
          state?: string | null
          status?: string
          timezone?: string
          trial_ends_at?: string | null
        }
        Relationships: []
      }
      kiwify_products: {
        Row: {
          active: boolean
          created_at: string
          id: string
          kiwify_product_id: string | null
          plan_code: string
          product_name: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          kiwify_product_id?: string | null
          plan_code: string
          product_name: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          kiwify_product_id?: string | null
          plan_code?: string
          product_name?: string
        }
        Relationships: []
      }
      kiwify_webhook_events: {
        Row: {
          buyer_email: string | null
          establishment_id: string | null
          event_id: string
          event_type: string
          id: string
          payload: Json
          processed_at: string
          status: string
        }
        Insert: {
          buyer_email?: string | null
          establishment_id?: string | null
          event_id: string
          event_type: string
          id?: string
          payload: Json
          processed_at?: string
          status?: string
        }
        Update: {
          buyer_email?: string | null
          establishment_id?: string | null
          event_id?: string
          event_type?: string
          id?: string
          payload?: Json
          processed_at?: string
          status?: string
        }
        Relationships: []
      }
      professional_hours: {
        Row: {
          closed: boolean
          end_time: string | null
          id: string
          professional_id: string
          start_time: string | null
          weekday: number
        }
        Insert: {
          closed?: boolean
          end_time?: string | null
          id?: string
          professional_id: string
          start_time?: string | null
          weekday: number
        }
        Update: {
          closed?: boolean
          end_time?: string | null
          id?: string
          professional_id?: string
          start_time?: string | null
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "professional_hours_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
        ]
      }
      professional_portal_sessions: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          professional_id: string
          token_hash: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          professional_id: string
          token_hash: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          professional_id?: string
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "professional_portal_sessions_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
        ]
      }
      professional_services: {
        Row: {
          professional_id: string
          service_id: string
        }
        Insert: {
          professional_id: string
          service_id: string
        }
        Update: {
          professional_id?: string
          service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "professional_services_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_services_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      professionals: {
        Row: {
          active: boolean
          capacity: number
          created_at: string
          establishment_id: string
          id: string
          name: string
          photo_url: string | null
          portal_enabled: boolean | null
          portal_last_login_at: string | null
          portal_password_hash: string | null
          slug: string | null
          user_id: string | null
        }
        Insert: {
          active?: boolean
          capacity?: number
          created_at?: string
          establishment_id: string
          id?: string
          name: string
          photo_url?: string | null
          portal_enabled?: boolean | null
          portal_last_login_at?: string | null
          portal_password_hash?: string | null
          slug?: string | null
          user_id?: string | null
        }
        Update: {
          active?: boolean
          capacity?: number
          created_at?: string
          establishment_id?: string
          id?: string
          name?: string
          photo_url?: string | null
          portal_enabled?: boolean | null
          portal_last_login_at?: string | null
          portal_password_hash?: string | null
          slug?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "professionals_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          account_type: string
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          account_type?: string
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          account_type?: string
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      ratings: {
        Row: {
          appointment_id: string
          comment: string | null
          created_at: string
          customer_id: string
          customer_user_id: string | null
          establishment_id: string
          id: string
          stars: number
        }
        Insert: {
          appointment_id: string
          comment?: string | null
          created_at?: string
          customer_id: string
          customer_user_id?: string | null
          establishment_id: string
          id?: string
          stars: number
        }
        Update: {
          appointment_id?: string
          comment?: string | null
          created_at?: string
          customer_id?: string
          customer_user_id?: string | null
          establishment_id?: string
          id?: string
          stars?: number
        }
        Relationships: [
          {
            foreignKeyName: "ratings_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: true
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ratings_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ratings_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_time_blocks: {
        Row: {
          active: boolean
          created_at: string
          end_time: string
          establishment_id: string
          id: string
          professional_id: string | null
          reason: string | null
          start_time: string
          weekday: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          end_time: string
          establishment_id: string
          id?: string
          professional_id?: string | null
          reason?: string | null
          start_time: string
          weekday: number
        }
        Update: {
          active?: boolean
          created_at?: string
          end_time?: string
          establishment_id?: string
          id?: string
          professional_id?: string | null
          reason?: string | null
          start_time?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "recurring_time_blocks_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_time_blocks_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
        ]
      }
      service_categories: {
        Row: {
          created_at: string
          establishment_id: string
          id: string
          is_active: boolean
          name: string
          slug: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          establishment_id: string
          id?: string
          is_active?: boolean
          name: string
          slug?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          establishment_id?: string
          id?: string
          is_active?: boolean
          name?: string
          slug?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_categories_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          active: boolean
          category: string | null
          category_id: string | null
          created_at: string
          description: string | null
          duration_minutes: number
          establishment_id: string
          id: string
          name: string
          price_cents: number | null
          sort_order: number
        }
        Insert: {
          active?: boolean
          category?: string | null
          category_id?: string | null
          created_at?: string
          description?: string | null
          duration_minutes: number
          establishment_id: string
          id?: string
          name: string
          price_cents?: number | null
          sort_order?: number
        }
        Update: {
          active?: boolean
          category?: string | null
          category_id?: string | null
          created_at?: string
          description?: string | null
          duration_minutes?: number
          establishment_id?: string
          id?: string
          name?: string
          price_cents?: number | null
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "services_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "service_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "services_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
        ]
      }
      signup_invitations: {
        Row: {
          created_at: string
          email: string
          expires_at: string
          id: string
          kiwify_order_id: string | null
          plan_code: string
          status: string
          token_hash: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          kiwify_order_id?: string | null
          plan_code: string
          status?: string
          token_hash: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          kiwify_order_id?: string | null
          plan_code?: string
          status?: string
          token_hash?: string
          used_at?: string | null
        }
        Relationships: []
      }
      signup_tokens: {
        Row: {
          created_at: string
          email: string
          expires_at: string
          id: string
          order_id: string | null
          plan_id: string | null
          status: string
          token: string
          updated_at: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          expires_at: string
          id?: string
          order_id?: string | null
          plan_id?: string | null
          status?: string
          token: string
          updated_at?: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          order_id?: string | null
          plan_id?: string | null
          status?: string
          token?: string
          updated_at?: string
          used_at?: string | null
        }
        Relationships: []
      }
      subscription_events: {
        Row: {
          amount_cents: number | null
          billing_cycle: string
          establishment_id: string
          event_type: string
          id: string
          metadata: Json
          occurred_at: string
          plan: string
          provider: string | null
          provider_ref: string | null
        }
        Insert: {
          amount_cents?: number | null
          billing_cycle: string
          establishment_id: string
          event_type: string
          id?: string
          metadata?: Json
          occurred_at?: string
          plan: string
          provider?: string | null
          provider_ref?: string | null
        }
        Update: {
          amount_cents?: number | null
          billing_cycle?: string
          establishment_id?: string
          event_type?: string
          id?: string
          metadata?: Json
          occurred_at?: string
          plan?: string
          provider?: string | null
          provider_ref?: string | null
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          billing_cycle: string
          buyer_email: string | null
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string
          current_period_start: string
          establishment_id: string | null
          external_id: string | null
          external_provider: string | null
          id: string
          metadata: Json
          owner_user_id: string
          plan: string
          plan_code: string
          provider: string | null
          provider_customer_id: string | null
          provider_order_id: string | null
          provider_ref: string | null
          provider_subscription_id: string | null
          raw_last_event: Json | null
          status: string
          updated_at: string
        }
        Insert: {
          billing_cycle?: string
          buyer_email?: string | null
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string
          current_period_start?: string
          establishment_id?: string | null
          external_id?: string | null
          external_provider?: string | null
          id?: string
          metadata?: Json
          owner_user_id: string
          plan?: string
          plan_code: string
          provider?: string | null
          provider_customer_id?: string | null
          provider_order_id?: string | null
          provider_ref?: string | null
          provider_subscription_id?: string | null
          raw_last_event?: Json | null
          status?: string
          updated_at?: string
        }
        Update: {
          billing_cycle?: string
          buyer_email?: string | null
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string
          current_period_start?: string
          establishment_id?: string | null
          external_id?: string | null
          external_provider?: string | null
          id?: string
          metadata?: Json
          owner_user_id?: string
          plan?: string
          plan_code?: string
          provider?: string | null
          provider_customer_id?: string | null
          provider_order_id?: string | null
          provider_ref?: string | null
          provider_subscription_id?: string | null
          raw_last_event?: Json | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      time_blocks: {
        Row: {
          created_at: string
          end_at: string
          establishment_id: string
          id: string
          professional_id: string | null
          reason: string | null
          start_at: string
        }
        Insert: {
          created_at?: string
          end_at: string
          establishment_id: string
          id?: string
          professional_id?: string | null
          reason?: string | null
          start_at: string
        }
        Update: {
          created_at?: string
          end_at?: string
          establishment_id?: string
          id?: string
          professional_id?: string | null
          reason?: string | null
          start_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_blocks_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_blocks_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      appointment_email_jobs_summary: {
        Row: {
          email_type: string | null
          status: string | null
          total: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      activate_subscription: {
        Args: {
          p_amount_cents: number
          p_billing_cycle: string
          p_establishment_id: string
          p_metadata?: Json
          p_plan: string
          p_provider: string
          p_provider_ref: string
          p_status: string
        }
        Returns: {
          billing_cycle: string
          buyer_email: string | null
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string
          current_period_start: string
          establishment_id: string | null
          external_id: string | null
          external_provider: string | null
          id: string
          metadata: Json
          owner_user_id: string
          plan: string
          plan_code: string
          provider: string | null
          provider_customer_id: string | null
          provider_order_id: string | null
          provider_ref: string | null
          provider_subscription_id: string | null
          raw_last_event: Json | null
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "subscriptions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      add_billing_interval: {
        Args: { p_cycle: string; p_start: string }
        Returns: string
      }
      admin_get_my_level: { Args: never; Returns: string }
      cancel_pending_appointment_email_jobs: {
        Args: { p_appointment_id: string }
        Returns: number
      }
      check_establishment_slug_available: {
        Args: { p_current_establishment_id: string; p_slug: string }
        Returns: boolean
      }
      check_has_active_entitlement: {
        Args: { p_email: string }
        Returns: boolean
      }
      check_signup_authorization: { Args: { p_email: string }; Returns: Json }
      check_signup_token: {
        Args: { p_token: string }
        Returns: {
          email: string
          expires_at: string
          order_id: string
          plan_id: string
          reason: string
          valid: boolean
        }[]
      }
      consume_signup_invitation: { Args: { p_token: string }; Returns: Json }
      consume_signup_token: {
        Args: { p_token: string }
        Returns: {
          email: string
          reason: string
          success: boolean
        }[]
      }
      create_appointment_cancelled_email_job: {
        Args: {
          p_appointment_id: string
          p_customer_email: string
          p_customer_name: string
          p_establishment_id: string
          p_payload?: Json
        }
        Returns: Json
      }
      create_appointment_email_jobs: {
        Args: {
          p_appointment_id: string
          p_appointment_start: string
          p_customer_email: string
          p_customer_name: string
          p_establishment_id: string
          p_payload?: Json
        }
        Returns: Json
      }
      get_admin_audit_logs: {
        Args: {
          p_action?: string
          p_admin_user_id?: string
          p_date_from?: string
          p_date_to?: string
          p_limit?: number
          p_offset?: number
        }
        Returns: {
          action: string
          admin_email: string
          admin_name: string
          admin_user_id: string
          created_at: string
          id: string
          ip: string
          metadata: Json
          target_establishment_id: string
          target_owner_user_id: string
          user_agent: string
        }[]
      }
      get_admin_users: {
        Args: never
        Returns: {
          created_by: string
          created_by_email: string
          email: string
          last_access_at: string
          level: string
          name: string
          role: string
          status: string
          user_created_at: string
          user_id: string
        }[]
      }
      get_professional_appointments: {
        Args: { p_end_date: string; p_start_date: string; p_token: string }
        Returns: Json
      }
      is_admin:
        | { Args: never; Returns: boolean }
        | { Args: { p_user_id: string }; Returns: boolean }
      is_master_admin: { Args: never; Returns: boolean }
      normalize_email: { Args: { input_email: string }; Returns: string }
      professional_portal_login: {
        Args: {
          p_establishment_slug: string
          p_password: string
          p_professional_slug: string
        }
        Returns: Json
      }
      public_create_appointment: {
        Args: {
          p_customer_email?: string
          p_customer_name: string
          p_customer_notes?: string
          p_customer_phone: string
          p_customer_user_id?: string
          p_end_at: string
          p_professional_id: string
          p_service_id: string
          p_slug: string
          p_start_at: string
        }
        Returns: {
          appointment_id: string
          manage_token: string
        }[]
      }
      public_reschedule_appointment: {
        Args: {
          p_appointment_id: string
          p_new_end_at: string
          p_new_start_at: string
          p_token: string
        }
        Returns: Json
      }
      recreate_appointment_email_jobs_for_reschedule: {
        Args: {
          p_appointment_id: string
          p_customer_email: string
          p_customer_name: string
          p_establishment_id: string
          p_new_appointment_start: string
          p_payload?: Json
        }
        Returns: Json
      }
      set_professional_portal_password: {
        Args: { p_password: string; p_professional_id: string }
        Returns: Json
      }
      slugify: { Args: { input: string }; Returns: string }
      validate_professional_session: {
        Args: { p_token: string }
        Returns: Json
      }
      validate_signup_invitation: { Args: { p_token: string }; Returns: Json }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
