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
      admin_actions_log: {
        Row: {
          action: string
          admin_id: string
          created_at: string
          details: Json | null
          id: string
          ip_address: string | null
          target_id: string | null
          target_type: string | null
        }
        Insert: {
          action: string
          admin_id: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          target_id?: string | null
          target_type?: string | null
        }
        Update: {
          action?: string
          admin_id?: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          target_id?: string | null
          target_type?: string | null
        }
        Relationships: []
      }
      admin_users: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          last_login_at: string | null
          permissions: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id?: string
          last_login_at?: string | null
          permissions?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          last_login_at?: string | null
          permissions?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      applications: {
        Row: {
          artist_id: string
          created_at: string
          gig_id: string
          id: string
          message: string | null
          status: string
          updated_at: string
        }
        Insert: {
          artist_id: string
          created_at?: string
          gig_id: string
          id?: string
          message?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          artist_id?: string
          created_at?: string
          gig_id?: string
          id?: string
          message?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "applications_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artist_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_gig_id_fkey"
            columns: ["gig_id"]
            isOneToOne: false
            referencedRelation: "gig_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      artist_profiles: {
        Row: {
          availability: Json | null
          bio: string | null
          city: string | null
          cover_photo_url: string | null
          created_at: string
          genre: string | null
          id: string
          max_price: number | null
          media_urls: Json | null
          min_price: number | null
          portfolio_url: string | null
          price_per_hour: number | null
          rating: number | null
          social_links: Json | null
          stage_name: string | null
          total_gigs: number | null
          updated_at: string
          user_id: string
          verified: boolean | null
        }
        Insert: {
          availability?: Json | null
          bio?: string | null
          city?: string | null
          cover_photo_url?: string | null
          created_at?: string
          genre?: string | null
          id?: string
          max_price?: number | null
          media_urls?: Json | null
          min_price?: number | null
          portfolio_url?: string | null
          price_per_hour?: number | null
          rating?: number | null
          social_links?: Json | null
          stage_name?: string | null
          total_gigs?: number | null
          updated_at?: string
          user_id: string
          verified?: boolean | null
        }
        Update: {
          availability?: Json | null
          bio?: string | null
          city?: string | null
          cover_photo_url?: string | null
          created_at?: string
          genre?: string | null
          id?: string
          max_price?: number | null
          media_urls?: Json | null
          min_price?: number | null
          portfolio_url?: string | null
          price_per_hour?: number | null
          rating?: number | null
          social_links?: Json | null
          stage_name?: string | null
          total_gigs?: number | null
          updated_at?: string
          user_id?: string
          verified?: boolean | null
        }
        Relationships: []
      }
      artist_ratings_by_admin: {
        Row: {
          admin_id: string
          artist_id: string
          category_ratings: Json | null
          created_at: string
          flagged: boolean
          id: string
          notes: string | null
          rating: number
          updated_at: string
          visibility: string
        }
        Insert: {
          admin_id: string
          artist_id: string
          category_ratings?: Json | null
          created_at?: string
          flagged?: boolean
          id?: string
          notes?: string | null
          rating: number
          updated_at?: string
          visibility?: string
        }
        Update: {
          admin_id?: string
          artist_id?: string
          category_ratings?: Json | null
          created_at?: string
          flagged?: boolean
          id?: string
          notes?: string | null
          rating?: number
          updated_at?: string
          visibility?: string
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          admin_id: string
          created_at: string
          details: Json | null
          id: string
          target_id: string | null
          target_type: string | null
        }
        Insert: {
          action: string
          admin_id: string
          created_at?: string
          details?: Json | null
          id?: string
          target_id?: string | null
          target_type?: string | null
        }
        Update: {
          action?: string
          admin_id?: string
          created_at?: string
          details?: Json | null
          id?: string
          target_id?: string | null
          target_type?: string | null
        }
        Relationships: []
      }
      blocked_users: {
        Row: {
          appeal_message: string | null
          appeal_status: string | null
          block_end_date: string | null
          block_type: string
          blocked_at: string
          blocked_by: string
          evidence_notes: string | null
          id: string
          reason: string
          status: string
          unblocked_at: string | null
          user_id: string
        }
        Insert: {
          appeal_message?: string | null
          appeal_status?: string | null
          block_end_date?: string | null
          block_type?: string
          blocked_at?: string
          blocked_by: string
          evidence_notes?: string | null
          id?: string
          reason: string
          status?: string
          unblocked_at?: string | null
          user_id: string
        }
        Update: {
          appeal_message?: string | null
          appeal_status?: string | null
          block_end_date?: string | null
          block_type?: string
          blocked_at?: string
          blocked_by?: string
          evidence_notes?: string | null
          id?: string
          reason?: string
          status?: string
          unblocked_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      bookings: {
        Row: {
          amount: number | null
          artist_id: string
          created_at: string
          date: string
          end_time: string | null
          gig_id: string | null
          id: string
          notes: string | null
          start_time: string | null
          status: string
          updated_at: string
          venue_id: string
        }
        Insert: {
          amount?: number | null
          artist_id: string
          created_at?: string
          date: string
          end_time?: string | null
          gig_id?: string | null
          id?: string
          notes?: string | null
          start_time?: string | null
          status?: string
          updated_at?: string
          venue_id: string
        }
        Update: {
          amount?: number | null
          artist_id?: string
          created_at?: string
          date?: string
          end_time?: string | null
          gig_id?: string | null
          id?: string
          notes?: string | null
          start_time?: string | null
          status?: string
          updated_at?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artist_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_gig_id_fkey"
            columns: ["gig_id"]
            isOneToOne: false
            referencedRelation: "gig_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venue_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      disputes: {
        Row: {
          booking_id: string
          created_at: string
          details: string | null
          id: string
          reason: string
          reporter_id: string
          resolution: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
        }
        Insert: {
          booking_id: string
          created_at?: string
          details?: string | null
          id?: string
          reason: string
          reporter_id: string
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Update: {
          booking_id?: string
          created_at?: string
          details?: string | null
          id?: string
          reason?: string
          reporter_id?: string
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Relationships: []
      }
      feature_flags: {
        Row: {
          enabled: boolean
          id: string
          key: string
          label: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          enabled?: boolean
          id?: string
          key: string
          label: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          enabled?: boolean
          id?: string
          key?: string
          label?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      gig_posts: {
        Row: {
          budget: number | null
          city: string | null
          created_at: string
          date: string | null
          description: string | null
          end_time: string | null
          genre: string | null
          id: string
          start_time: string | null
          status: string
          title: string
          updated_at: string
          venue_id: string
        }
        Insert: {
          budget?: number | null
          city?: string | null
          created_at?: string
          date?: string | null
          description?: string | null
          end_time?: string | null
          genre?: string | null
          id?: string
          start_time?: string | null
          status?: string
          title: string
          updated_at?: string
          venue_id: string
        }
        Update: {
          budget?: number | null
          city?: string | null
          created_at?: string
          date?: string | null
          description?: string | null
          end_time?: string | null
          genre?: string | null
          id?: string
          start_time?: string | null
          status?: string
          title?: string
          updated_at?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gig_posts_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venue_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          booking_id: string | null
          content: string
          created_at: string
          id: string
          read: boolean | null
          receiver_id: string
          sender_id: string
        }
        Insert: {
          booking_id?: string | null
          content: string
          created_at?: string
          id?: string
          read?: boolean | null
          receiver_id: string
          sender_id: string
        }
        Update: {
          booking_id?: string | null
          content?: string
          created_at?: string
          id?: string
          read?: boolean | null
          receiver_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          data: Json | null
          id: string
          read: boolean | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          data?: Json | null
          id?: string
          read?: boolean | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          data?: Json | null
          id?: string
          read?: boolean | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          city: string | null
          created_at: string
          full_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          city?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          city?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      reviews: {
        Row: {
          booking_id: string
          category_ratings: Json | null
          comment: string | null
          created_at: string
          id: string
          rating: number
          reviewee_id: string
          reviewer_id: string
          visible: boolean | null
        }
        Insert: {
          booking_id: string
          category_ratings?: Json | null
          comment?: string | null
          created_at?: string
          id?: string
          rating: number
          reviewee_id: string
          reviewer_id: string
          visible?: boolean | null
        }
        Update: {
          booking_id?: string
          category_ratings?: Json | null
          comment?: string | null
          created_at?: string
          id?: string
          rating?: number
          reviewee_id?: string
          reviewer_id?: string
          visible?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          created_at: string
          id: string
          notify_booking_requests: boolean
          notify_messages: boolean
          notify_payments: boolean
          notify_platform: boolean
          notify_reviews: boolean
          profile_public: boolean
          show_pricing: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          notify_booking_requests?: boolean
          notify_messages?: boolean
          notify_payments?: boolean
          notify_platform?: boolean
          notify_reviews?: boolean
          profile_public?: boolean
          show_pricing?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          notify_booking_requests?: boolean
          notify_messages?: boolean
          notify_payments?: boolean
          notify_platform?: boolean
          notify_reviews?: boolean
          profile_public?: boolean
          show_pricing?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_warnings: {
        Row: {
          acknowledged: boolean | null
          created_at: string
          id: string
          reason: string
          severity: string
          user_id: string
          warned_by: string
          warning_count: number
          warning_type: string
        }
        Insert: {
          acknowledged?: boolean | null
          created_at?: string
          id?: string
          reason: string
          severity?: string
          user_id: string
          warned_by: string
          warning_count?: number
          warning_type?: string
        }
        Update: {
          acknowledged?: boolean | null
          created_at?: string
          id?: string
          reason?: string
          severity?: string
          user_id?: string
          warned_by?: string
          warning_count?: number
          warning_type?: string
        }
        Relationships: []
      }
      venue_profiles: {
        Row: {
          address: string | null
          amenities: Json | null
          area: string | null
          capacity: number | null
          city: string | null
          cover_photo_url: string | null
          created_at: string
          description: string | null
          id: string
          logo_url: string | null
          operating_hours_end: string | null
          operating_hours_start: string | null
          rating: number | null
          updated_at: string
          user_id: string
          venue_name: string | null
          venue_type: string | null
          verified: boolean | null
        }
        Insert: {
          address?: string | null
          amenities?: Json | null
          area?: string | null
          capacity?: number | null
          city?: string | null
          cover_photo_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          logo_url?: string | null
          operating_hours_end?: string | null
          operating_hours_start?: string | null
          rating?: number | null
          updated_at?: string
          user_id: string
          venue_name?: string | null
          venue_type?: string | null
          verified?: boolean | null
        }
        Update: {
          address?: string | null
          amenities?: Json | null
          area?: string | null
          capacity?: number | null
          city?: string | null
          cover_photo_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          logo_url?: string | null
          operating_hours_end?: string | null
          operating_hours_start?: string | null
          rating?: number | null
          updated_at?: string
          user_id?: string
          venue_name?: string | null
          venue_type?: string | null
          verified?: boolean | null
        }
        Relationships: []
      }
      venue_ratings_by_admin: {
        Row: {
          admin_id: string
          category_ratings: Json | null
          created_at: string
          flagged: boolean
          id: string
          notes: string | null
          rating: number
          updated_at: string
          venue_id: string
          visibility: string
        }
        Insert: {
          admin_id: string
          category_ratings?: Json | null
          created_at?: string
          flagged?: boolean
          id?: string
          notes?: string | null
          rating: number
          updated_at?: string
          venue_id: string
          visibility?: string
        }
        Update: {
          admin_id?: string
          category_ratings?: Json | null
          created_at?: string
          flagged?: boolean
          id?: string
          notes?: string | null
          rating?: number
          updated_at?: string
          venue_id?: string
          visibility?: string
        }
        Relationships: []
      }
      verification_requests: {
        Row: {
          city: string | null
          created_at: string
          document_urls: Json | null
          full_name: string | null
          id: string
          reviewed_at: string | null
          reviewed_by: string | null
          role: string
          status: string
          user_id: string
        }
        Insert: {
          city?: string | null
          created_at?: string
          document_urls?: Json | null
          full_name?: string | null
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          role: string
          status?: string
          user_id: string
        }
        Update: {
          city?: string | null
          created_at?: string
          document_urls?: Json | null
          full_name?: string | null
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          role?: string
          status?: string
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
      app_role: "artist" | "venue" | "admin" | "super_admin"
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
      app_role: ["artist", "venue", "admin", "super_admin"],
    },
  },
} as const
