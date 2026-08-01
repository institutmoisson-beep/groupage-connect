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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      campaign_products: {
        Row: {
          campaign_id: string
          product_id: string
        }
        Insert: {
          campaign_id: string
          product_id: string
        }
        Update: {
          campaign_id?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_products_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "groupage_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      cargo_config: {
        Row: {
          china_warehouse_address: string
          china_warehouse_contact: string
          default_customs_flat_fee_xof: number
          default_rate_per_cbm_xof: number
          default_rate_per_kg_xof: number
          delivery_base_fee_xof: number
          delivery_rate_per_km_xof: number
          id: number
          instructions: string
          local_hub_lat: number | null
          local_hub_lng: number | null
          updated_at: string
        }
        Insert: {
          china_warehouse_address?: string
          china_warehouse_contact?: string
          default_customs_flat_fee_xof?: number
          default_rate_per_cbm_xof?: number
          default_rate_per_kg_xof?: number
          delivery_base_fee_xof?: number
          delivery_rate_per_km_xof?: number
          id?: number
          instructions?: string
          local_hub_lat?: number | null
          local_hub_lng?: number | null
          updated_at?: string
        }
        Update: {
          china_warehouse_address?: string
          china_warehouse_contact?: string
          default_customs_flat_fee_xof?: number
          default_rate_per_cbm_xof?: number
          default_rate_per_kg_xof?: number
          delivery_base_fee_xof?: number
          delivery_rate_per_km_xof?: number
          id?: number
          instructions?: string
          local_hub_lat?: number | null
          local_hub_lng?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      commissions: {
        Row: {
          amount_xof: number
          buyer_id: string
          created_at: string
          id: string
          level: number
          order_id: string | null
          referrer_id: string
        }
        Insert: {
          amount_xof: number
          buyer_id: string
          created_at?: string
          id?: string
          level: number
          order_id?: string | null
          referrer_id: string
        }
        Update: {
          amount_xof?: number
          buyer_id?: string
          created_at?: string
          id?: string
          level?: number
          order_id?: string | null
          referrer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "commissions_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_referrer_id_fkey"
            columns: ["referrer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_sourcing_orders: {
        Row: {
          admin_notes: string | null
          cny_unit_price: number | null
          created_at: string
          estimated_total_xof: number | null
          exchange_rate_cny_xof: number
          final_total_xof: number | null
          id: string
          logistics_fee_xof: number
          main_image: string | null
          msn_commission_rate: number
          msn_commission_xof: number | null
          notes: string | null
          product_name: string
          qc_approved_at: string | null
          qc_images: string[]
          quantity: number
          shipping_type: string
          source_platform: string | null
          source_url: string
          status: Database["public"]["Enums"]["sourcing_status"]
          updated_at: string
          user_id: string
          variant: string | null
        }
        Insert: {
          admin_notes?: string | null
          cny_unit_price?: number | null
          created_at?: string
          estimated_total_xof?: number | null
          exchange_rate_cny_xof?: number
          final_total_xof?: number | null
          id?: string
          logistics_fee_xof?: number
          main_image?: string | null
          msn_commission_rate?: number
          msn_commission_xof?: number | null
          notes?: string | null
          product_name: string
          qc_approved_at?: string | null
          qc_images?: string[]
          quantity?: number
          shipping_type?: string
          source_platform?: string | null
          source_url: string
          status?: Database["public"]["Enums"]["sourcing_status"]
          updated_at?: string
          user_id: string
          variant?: string | null
        }
        Update: {
          admin_notes?: string | null
          cny_unit_price?: number | null
          created_at?: string
          estimated_total_xof?: number | null
          exchange_rate_cny_xof?: number
          final_total_xof?: number | null
          id?: string
          logistics_fee_xof?: number
          main_image?: string | null
          msn_commission_rate?: number
          msn_commission_xof?: number | null
          notes?: string | null
          product_name?: string
          qc_approved_at?: string | null
          qc_images?: string[]
          quantity?: number
          shipping_type?: string
          source_platform?: string | null
          source_url?: string
          status?: Database["public"]["Enums"]["sourcing_status"]
          updated_at?: string
          user_id?: string
          variant?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "custom_sourcing_orders_user_profile_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      direct_messages: {
        Row: {
          audio_url: string | null
          body: string
          created_at: string
          id: string
          image_urls: string[]
          read_at: string | null
          sender_id: string
          sender_role: string
          user_id: string
        }
        Insert: {
          audio_url?: string | null
          body?: string
          created_at?: string
          id?: string
          image_urls?: string[]
          read_at?: string | null
          sender_id: string
          sender_role?: string
          user_id: string
        }
        Update: {
          audio_url?: string | null
          body?: string
          created_at?: string
          id?: string
          image_urls?: string[]
          read_at?: string | null
          sender_id?: string
          sender_role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "direct_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "direct_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      exchange_rates: {
        Row: {
          base_currency: string
          quote_currency: string
          rate: number
          updated_at: string
        }
        Insert: {
          base_currency: string
          quote_currency: string
          rate: number
          updated_at?: string
        }
        Update: {
          base_currency?: string
          quote_currency?: string
          rate?: number
          updated_at?: string
        }
        Relationships: []
      }
      forwarding_packages: {
        Row: {
          admin_notes: string | null
          chinese_tracking_number: string
          created_at: string
          customs_flat_fee_xof: number | null
          declared_value: number | null
          declared_value_currency: Database["public"]["Enums"]["forwarding_currency"]
          description: string
          freight_type: Database["public"]["Enums"]["forwarding_freight_type"]
          id: string
          qc_approved_at: string | null
          qc_images_urls: string[]
          qc_note: string | null
          qc_rejected_at: string | null
          quantity: number
          rate_per_cbm_xof: number | null
          rate_per_kg_xof: number | null
          shipping_cost_currency: string
          shipping_cost_xof: number | null
          source_platform: string
          status: Database["public"]["Enums"]["forwarding_status"]
          updated_at: string
          user_id: string
          volume_cbm: number | null
          weight_kg: number | null
        }
        Insert: {
          admin_notes?: string | null
          chinese_tracking_number: string
          created_at?: string
          customs_flat_fee_xof?: number | null
          declared_value?: number | null
          declared_value_currency?: Database["public"]["Enums"]["forwarding_currency"]
          description: string
          freight_type?: Database["public"]["Enums"]["forwarding_freight_type"]
          id?: string
          qc_approved_at?: string | null
          qc_images_urls?: string[]
          qc_note?: string | null
          qc_rejected_at?: string | null
          quantity?: number
          rate_per_cbm_xof?: number | null
          rate_per_kg_xof?: number | null
          shipping_cost_currency?: string
          shipping_cost_xof?: number | null
          source_platform?: string
          status?: Database["public"]["Enums"]["forwarding_status"]
          updated_at?: string
          user_id: string
          volume_cbm?: number | null
          weight_kg?: number | null
        }
        Update: {
          admin_notes?: string | null
          chinese_tracking_number?: string
          created_at?: string
          customs_flat_fee_xof?: number | null
          declared_value?: number | null
          declared_value_currency?: Database["public"]["Enums"]["forwarding_currency"]
          description?: string
          freight_type?: Database["public"]["Enums"]["forwarding_freight_type"]
          id?: string
          qc_approved_at?: string | null
          qc_images_urls?: string[]
          qc_note?: string | null
          qc_rejected_at?: string | null
          quantity?: number
          rate_per_cbm_xof?: number | null
          rate_per_kg_xof?: number | null
          shipping_cost_currency?: string
          shipping_cost_xof?: number | null
          source_platform?: string
          status?: Database["public"]["Enums"]["forwarding_status"]
          updated_at?: string
          user_id?: string
          volume_cbm?: number | null
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "forwarding_packages_user_profile_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      groupage_campaigns: {
        Row: {
          container_image: string | null
          created_at: string
          current_participants: number
          description: string | null
          end_date: string
          eta_days: number
          id: string
          shipping_type: Database["public"]["Enums"]["shipping_type"]
          status: Database["public"]["Enums"]["campaign_status"]
          target_quantity: number
          title: string
        }
        Insert: {
          container_image?: string | null
          created_at?: string
          current_participants?: number
          description?: string | null
          end_date: string
          eta_days?: number
          id?: string
          shipping_type?: Database["public"]["Enums"]["shipping_type"]
          status?: Database["public"]["Enums"]["campaign_status"]
          target_quantity: number
          title: string
        }
        Update: {
          container_image?: string | null
          created_at?: string
          current_participants?: number
          description?: string | null
          end_date?: string
          eta_days?: number
          id?: string
          shipping_type?: Database["public"]["Enums"]["shipping_type"]
          status?: Database["public"]["Enums"]["campaign_status"]
          target_quantity?: number
          title?: string
        }
        Relationships: []
      }
      hotel_bookings: {
        Row: {
          admin_notes: string | null
          booking_reference: string
          cancellation_policy: Json
          check_in_date: string
          check_out_date: string
          created_at: string
          currency: string
          guest_email: string
          guest_name: string | null
          guest_phone: string | null
          guests: number
          hotel_details: Json
          id: string
          commission_amount: number
          commission_type: string | null
          markup_amount: number
          payment_gateway: Database["public"]["Enums"]["hotel_payment_gateway"]
          payment_meta: Json | null
          payment_model: Database["public"]["Enums"]["hotel_payment_model"]
          payment_provider: string | null
          payment_reference: string | null
          payment_status: Database["public"]["Enums"]["hotel_payment_status"]
          payment_url: string | null
          room_details: Json
          rooms: number
          status: Database["public"]["Enums"]["hotel_booking_status"]
          supplier_confirmation_id: string | null
          supplier_net_price: number
          total_price: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          admin_notes?: string | null
          booking_reference?: string
          cancellation_policy?: Json
          check_in_date: string
          check_out_date: string
          created_at?: string
          currency?: string
          guest_email: string
          guest_name?: string | null
          guest_phone?: string | null
          guests?: number
          hotel_details?: Json
          id?: string
          commission_amount?: number
          commission_type?: string | null
          markup_amount?: number
          payment_gateway?: Database["public"]["Enums"]["hotel_payment_gateway"]
          payment_meta?: Json | null
          payment_model?: Database["public"]["Enums"]["hotel_payment_model"]
          payment_provider?: string | null
          payment_reference?: string | null
          payment_status?: Database["public"]["Enums"]["hotel_payment_status"]
          payment_url?: string | null
          room_details?: Json
          rooms?: number
          status?: Database["public"]["Enums"]["hotel_booking_status"]
          supplier_confirmation_id?: string | null
          supplier_net_price?: number
          total_price?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          admin_notes?: string | null
          booking_reference?: string
          cancellation_policy?: Json
          check_in_date?: string
          check_out_date?: string
          created_at?: string
          currency?: string
          guest_email?: string
          guest_name?: string | null
          guest_phone?: string | null
          guests?: number
          hotel_details?: Json
          id?: string
          commission_amount?: number
          commission_type?: string | null
          markup_amount?: number
          payment_gateway?: Database["public"]["Enums"]["hotel_payment_gateway"]
          payment_meta?: Json | null
          payment_model?: Database["public"]["Enums"]["hotel_payment_model"]
          payment_provider?: string | null
          payment_reference?: string | null
          payment_status?: Database["public"]["Enums"]["hotel_payment_status"]
          payment_url?: string | null
          room_details?: Json
          rooms?: number
          status?: Database["public"]["Enums"]["hotel_booking_status"]
          supplier_confirmation_id?: string | null
          supplier_net_price?: number
          total_price?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      orders: {
        Row: {
          campaign_id: string | null
          created_at: string
          id: string
          payment_meta: Json | null
          payment_provider: string | null
          payment_reference: string | null
          payment_status: string
          payment_url: string | null
          product_id: string
          quantity: number
          shipping_type: Database["public"]["Enums"]["shipping_type"]
          status: Database["public"]["Enums"]["order_status"]
          total_xof: number
          unit_price_xof: number
          updated_at: string
          user_id: string
        }
        Insert: {
          campaign_id?: string | null
          created_at?: string
          id?: string
          payment_meta?: Json | null
          payment_provider?: string | null
          payment_reference?: string | null
          payment_status?: string
          payment_url?: string | null
          product_id: string
          quantity?: number
          shipping_type?: Database["public"]["Enums"]["shipping_type"]
          status?: Database["public"]["Enums"]["order_status"]
          total_xof: number
          unit_price_xof: number
          updated_at?: string
          user_id: string
        }
        Update: {
          campaign_id?: string | null
          created_at?: string
          id?: string
          payment_meta?: Json | null
          payment_provider?: string | null
          payment_reference?: string | null
          payment_status?: string
          payment_url?: string | null
          product_id?: string
          quantity?: number
          shipping_type?: Database["public"]["Enums"]["shipping_type"]
          status?: Database["public"]["Enums"]["order_status"]
          total_xof?: number
          unit_price_xof?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "groupage_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_user_profile_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      package_delivery_logs: {
        Row: {
          assigned_driver_contact: string | null
          assigned_driver_name: string | null
          created_at: string
          delivery_address_note: string | null
          delivery_fee_xof: number | null
          delivery_latitude: number
          delivery_longitude: number
          delivery_timestamp: string | null
          distance_km: number | null
          id: string
          package_id: string
        }
        Insert: {
          assigned_driver_contact?: string | null
          assigned_driver_name?: string | null
          created_at?: string
          delivery_address_note?: string | null
          delivery_fee_xof?: number | null
          delivery_latitude: number
          delivery_longitude: number
          delivery_timestamp?: string | null
          distance_km?: number | null
          id?: string
          package_id: string
        }
        Update: {
          assigned_driver_contact?: string | null
          assigned_driver_name?: string | null
          created_at?: string
          delivery_address_note?: string | null
          delivery_fee_xof?: number | null
          delivery_latitude?: number
          delivery_longitude?: number
          delivery_timestamp?: string | null
          distance_km?: number | null
          id?: string
          package_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "package_delivery_logs_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "forwarding_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_methods: {
        Row: {
          account_holder: string | null
          account_identifier: string | null
          active: boolean
          created_at: string
          id: string
          instructions: string | null
          logo_url: string | null
          name: string
          sort_order: number
          type: Database["public"]["Enums"]["payment_method_type"]
          updated_at: string
        }
        Insert: {
          account_holder?: string | null
          account_identifier?: string | null
          active?: boolean
          created_at?: string
          id?: string
          instructions?: string | null
          logo_url?: string | null
          name: string
          sort_order?: number
          type: Database["public"]["Enums"]["payment_method_type"]
          updated_at?: string
        }
        Update: {
          account_holder?: string | null
          account_identifier?: string | null
          active?: boolean
          created_at?: string
          id?: string
          instructions?: string | null
          logo_url?: string | null
          name?: string
          sort_order?: number
          type?: Database["public"]["Enums"]["payment_method_type"]
          updated_at?: string
        }
        Relationships: []
      }
      payment_proofs: {
        Row: {
          amount_xof: number
          created_at: string
          id: string
          note: string | null
          order_id: string | null
          payment_method_id: string | null
          reference: string | null
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          screenshot_url: string | null
          sourcing_order_id: string | null
          status: Database["public"]["Enums"]["payment_proof_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_xof: number
          created_at?: string
          id?: string
          note?: string | null
          order_id?: string | null
          payment_method_id?: string | null
          reference?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          screenshot_url?: string | null
          sourcing_order_id?: string | null
          status?: Database["public"]["Enums"]["payment_proof_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_xof?: number
          created_at?: string
          id?: string
          note?: string | null
          order_id?: string | null
          payment_method_id?: string | null
          reference?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          screenshot_url?: string | null
          sourcing_order_id?: string | null
          status?: Database["public"]["Enums"]["payment_proof_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_proofs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_proofs_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_proofs_sourcing_order_id_fkey"
            columns: ["sourcing_order_id"]
            isOneToOne: false
            referencedRelation: "custom_sourcing_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_proofs_user_profile_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          active: boolean
          category: string
          cny_price: number
          created_at: string
          description: string | null
          exchange_rate_cny_xof: number
          id: string
          image_urls: string[]
          logistics_fee_xof: number
          title: string
        }
        Insert: {
          active?: boolean
          category?: string
          cny_price: number
          created_at?: string
          description?: string | null
          exchange_rate_cny_xof?: number
          id?: string
          image_urls?: string[]
          logistics_fee_xof?: number
          title: string
        }
        Update: {
          active?: boolean
          category?: string
          cny_price?: number
          created_at?: string
          description?: string | null
          exchange_rate_cny_xof?: number
          id?: string
          image_urls?: string[]
          logistics_fee_xof?: number
          title?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          city: string | null
          created_at: string
          delivered_referrals_count: number
          full_name: string | null
          id: string
          mlm_level: number
          phone: string | null
          referral_code: string
          referred_by: string | null
          terms_accepted_at: string | null
          terms_version: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          city?: string | null
          created_at?: string
          delivered_referrals_count?: number
          full_name?: string | null
          id: string
          mlm_level?: number
          phone?: string | null
          referral_code: string
          referred_by?: string | null
          terms_accepted_at?: string | null
          terms_version?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          city?: string | null
          created_at?: string
          delivered_referrals_count?: number
          full_name?: string | null
          id?: string
          mlm_level?: number
          phone?: string | null
          referral_code?: string
          referred_by?: string | null
          terms_accepted_at?: string | null
          terms_version?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_referred_by_fkey"
            columns: ["referred_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sourcing_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          image_urls: string[]
          read_at: string | null
          sender_id: string
          sender_role: string
          sourcing_order_id: string
        }
        Insert: {
          body?: string
          created_at?: string
          id?: string
          image_urls?: string[]
          read_at?: string | null
          sender_id: string
          sender_role?: string
          sourcing_order_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          image_urls?: string[]
          read_at?: string | null
          sender_id?: string
          sender_role?: string
          sourcing_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sourcing_messages_sourcing_order_id_fkey"
            columns: ["sourcing_order_id"]
            isOneToOne: false
            referencedRelation: "custom_sourcing_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      user_notifications: {
        Row: {
          body: string
          created_at: string
          id: string
          link: string | null
          read_at: string | null
          sourcing_order_id: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          sourcing_order_id?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          sourcing_order_id?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_notifications_sourcing_order_id_fkey"
            columns: ["sourcing_order_id"]
            isOneToOne: false
            referencedRelation: "custom_sourcing_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      user_preferences: {
        Row: {
          created_at: string
          default_currency: string
          preferred_language: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          default_currency?: string
          preferred_language?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          default_currency?: string
          preferred_language?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "member"
      campaign_status: "open" | "closed" | "shipped" | "arrived"
      forwarding_currency: "CNY" | "USD"
      forwarding_freight_type: "AIR" | "SEA"
      forwarding_status:
        | "DECLARED"
        | "RECEIVED_CHINA"
        | "IN_TRANSIT"
        | "CUSTOMS"
        | "READY_DELIVERY"
        | "DISPATCHED"
        | "DELIVERED"
        | "CANCELLED"
      hotel_booking_status: "pending" | "confirmed" | "cancelled" | "completed"
      hotel_payment_gateway:
        | "msn_smart"
        | "stripe"
        | "mobile_money_xof"
        | "hotel_direct"
      hotel_payment_model: "direct_merchant" | "api_delegated"
      hotel_payment_status: "pending" | "paid" | "refunded" | "failed"
      order_status:
        | "pending"
        | "paid_confirmed"
        | "shipped"
        | "transit"
        | "abidjan"
        | "delivered"
        | "cancelled"
      payment_method_type: "mobile_money" | "crypto" | "bank" | "cash" | "other"
      payment_proof_status: "pending" | "verified" | "rejected"
      shipping_type: "sea" | "air"
      sourcing_status:
        | "quote_pending"
        | "quoted"
        | "paid"
        | "ordered_china"
        | "qc"
        | "shipped"
        | "transit"
        | "abidjan"
        | "delivered"
        | "cancelled"
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
    Enums: {
      app_role: ["admin", "member"],
      campaign_status: ["open", "closed", "shipped", "arrived"],
      forwarding_currency: ["CNY", "USD"],
      forwarding_freight_type: ["AIR", "SEA"],
      forwarding_status: [
        "DECLARED",
        "RECEIVED_CHINA",
        "IN_TRANSIT",
        "CUSTOMS",
        "READY_DELIVERY",
        "DISPATCHED",
        "DELIVERED",
        "CANCELLED",
      ],
      hotel_booking_status: ["pending", "confirmed", "cancelled", "completed"],
      hotel_payment_gateway: [
        "msn_smart",
        "stripe",
        "mobile_money_xof",
        "hotel_direct",
      ],
      hotel_payment_model: ["direct_merchant", "api_delegated"],
      hotel_payment_status: ["pending", "paid", "refunded", "failed"],
      order_status: [
        "pending",
        "paid_confirmed",
        "shipped",
        "transit",
        "abidjan",
        "delivered",
        "cancelled",
      ],
      payment_method_type: ["mobile_money", "crypto", "bank", "cash", "other"],
      payment_proof_status: ["pending", "verified", "rejected"],
      shipping_type: ["sea", "air"],
      sourcing_status: [
        "quote_pending",
        "quoted",
        "paid",
        "ordered_china",
        "qc",
        "shipped",
        "transit",
        "abidjan",
        "delivered",
        "cancelled",
      ],
    },
  },
} as const
