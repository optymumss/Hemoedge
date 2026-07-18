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
      associates: {
        Row: {
          bio: string | null
          created_at: string
          id: string
          name: string
          title: string | null
        }
        Insert: {
          bio?: string | null
          created_at?: string
          id?: string
          name: string
          title?: string | null
        }
        Update: {
          bio?: string | null
          created_at?: string
          id?: string
          name?: string
          title?: string | null
        }
        Relationships: []
      }
      blog_posts: {
        Row: {
          content: string | null
          created_at: string
          excerpt: string | null
          id: string
          published_at: string | null
          slug: string
          status: string
          title: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          published_at?: string | null
          slug: string
          status?: string
          title: string
        }
        Update: {
          content?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          published_at?: string | null
          slug?: string
          status?: string
          title?: string
        }
        Relationships: []
      }
      cases: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          id: string
          level: Database["public"]["Enums"]["content_level"]
          status: Database["public"]["Enums"]["content_status"]
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          level: Database["public"]["Enums"]["content_level"]
          status?: Database["public"]["Enums"]["content_status"]
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          level?: Database["public"]["Enums"]["content_level"]
          status?: Database["public"]["Enums"]["content_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cases_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cell_types: {
        Row: {
          code: string
          created_at: string
          id: string
          lineage: string
          name: string
          slug: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          lineage: string
          name: string
          slug: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          lineage?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      certificates: {
        Row: {
          curriculum_id: string
          id: string
          issued_at: string
          user_id: string
          verification_code: string
        }
        Insert: {
          curriculum_id: string
          id?: string
          issued_at?: string
          user_id: string
          verification_code: string
        }
        Update: {
          curriculum_id?: string
          id?: string
          issued_at?: string
          user_id?: string
          verification_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "certificates_curriculum_id_fkey"
            columns: ["curriculum_id"]
            isOneToOne: false
            referencedRelation: "curricula"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificates_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      content_reviews: {
        Row: {
          content_id: string
          content_type: string
          decision: string | null
          id: string
          notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          submitted_at: string
          submitted_by: string
        }
        Insert: {
          content_id: string
          content_type: string
          decision?: string | null
          id?: string
          notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          submitted_at?: string
          submitted_by: string
        }
        Update: {
          content_id?: string
          content_type?: string
          decision?: string | null
          id?: string
          notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          submitted_at?: string
          submitted_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_reviews_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_reviews_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      content_scopes: {
        Row: {
          content_id: string
          content_manager_id: string
          content_type: string
          created_at: string
          id: string
        }
        Insert: {
          content_id: string
          content_manager_id: string
          content_type: string
          created_at?: string
          id?: string
        }
        Update: {
          content_id?: string
          content_manager_id?: string
          content_type?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_scopes_content_manager_id_fkey"
            columns: ["content_manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      curricula: {
        Row: {
          created_at: string
          created_by: string
          id: string
          level: Database["public"]["Enums"]["content_level"]
          pass_threshold: number
          status: Database["public"]["Enums"]["content_status"]
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          level: Database["public"]["Enums"]["content_level"]
          pass_threshold?: number
          status?: Database["public"]["Enums"]["content_status"]
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          level?: Database["public"]["Enums"]["content_level"]
          pass_threshold?: number
          status?: Database["public"]["Enums"]["content_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "curricula_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      curriculum_modules: {
        Row: {
          curriculum_id: string
          id: string
          module_id: string
          position: number
        }
        Insert: {
          curriculum_id: string
          id?: string
          module_id: string
          position?: number
        }
        Update: {
          curriculum_id?: string
          id?: string
          module_id?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "curriculum_modules_curriculum_id_fkey"
            columns: ["curriculum_id"]
            isOneToOne: false
            referencedRelation: "curricula"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curriculum_modules_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
        ]
      }
      enquiries: {
        Row: {
          created_at: string
          email: string
          id: string
          message: string
          name: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          message: string
          name: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          message?: string
          name?: string
        }
        Relationships: []
      }
      features: {
        Row: {
          cell_type_id: string | null
          created_at: string
          created_by: string
          definition: string | null
          id: string
          status: Database["public"]["Enums"]["content_status"]
          title: string
          updated_at: string
        }
        Insert: {
          cell_type_id?: string | null
          created_at?: string
          created_by: string
          definition?: string | null
          id?: string
          status?: Database["public"]["Enums"]["content_status"]
          title: string
          updated_at?: string
        }
        Update: {
          cell_type_id?: string | null
          created_at?: string
          created_by?: string
          definition?: string | null
          id?: string
          status?: Database["public"]["Enums"]["content_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "features_cell_type_id_fkey"
            columns: ["cell_type_id"]
            isOneToOne: false
            referencedRelation: "cell_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "features_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      modules: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          id: string
          level: Database["public"]["Enums"]["content_level"]
          status: Database["public"]["Enums"]["content_status"]
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          level: Database["public"]["Enums"]["content_level"]
          status?: Database["public"]["Enums"]["content_status"]
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          level?: Database["public"]["Enums"]["content_level"]
          status?: Database["public"]["Enums"]["content_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "modules_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      org_catalog_selections: {
        Row: {
          added_by: string
          content_id: string
          content_type: string
          created_at: string
          id: string
          org_id: string
        }
        Insert: {
          added_by: string
          content_id: string
          content_type: string
          created_at?: string
          id?: string
          org_id: string
        }
        Update: {
          added_by?: string
          content_id?: string
          content_type?: string
          created_at?: string
          id?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_catalog_selections_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_catalog_selections_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_memberships: {
        Row: {
          created_at: string
          id: string
          org_id: string
          org_role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          org_id: string
          org_role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          org_id?: string
          org_role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_memberships_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          name: string
          seats: number | null
          slug: string
          status: string
          stripe_customer_id: string | null
          tier_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          seats?: number | null
          slug: string
          status?: string
          stripe_customer_id?: string | null
          tier_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          seats?: number | null
          slug?: string
          status?: string
          stripe_customer_id?: string | null
          tier_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organizations_tier_id_fkey"
            columns: ["tier_id"]
            isOneToOne: false
            referencedRelation: "tiers"
            referencedColumns: ["id"]
          },
        ]
      }
      pages: {
        Row: {
          content: string | null
          created_at: string
          id: string
          slug: string
          status: string
          title: string
          type: Database["public"]["Enums"]["page_type"]
          updated_at: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          id?: string
          slug: string
          status?: string
          title: string
          type?: Database["public"]["Enums"]["page_type"]
          updated_at?: string
        }
        Update: {
          content?: string | null
          created_at?: string
          id?: string
          slug?: string
          status?: string
          title?: string
          type?: Database["public"]["Enums"]["page_type"]
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      }
      quiz_attempts: {
        Row: {
          answers: Json
          case_id: string | null
          created_at: string
          id: string
          module_id: string | null
          passed: boolean
          score: number
          user_id: string
        }
        Insert: {
          answers: Json
          case_id?: string | null
          created_at?: string
          id?: string
          module_id?: string | null
          passed: boolean
          score: number
          user_id: string
        }
        Update: {
          answers?: Json
          case_id?: string | null
          created_at?: string
          id?: string
          module_id?: string | null
          passed?: boolean
          score?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_attempts_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_attempts_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_attempts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_questions: {
        Row: {
          case_id: string | null
          choices: Json
          correct_choice_id: string
          created_at: string
          created_by: string
          id: string
          module_id: string | null
          position: number
          question_text: string
        }
        Insert: {
          case_id?: string | null
          choices: Json
          correct_choice_id: string
          created_at?: string
          created_by: string
          id?: string
          module_id?: string | null
          position?: number
          question_text: string
        }
        Update: {
          case_id?: string | null
          choices?: Json
          correct_choice_id?: string
          created_at?: string
          created_by?: string
          id?: string
          module_id?: string | null
          position?: number
          question_text?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_questions_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_questions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_questions_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
        ]
      }
      slide_categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          parent_id: string | null
          slug: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          parent_id?: string | null
          slug: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          parent_id?: string | null
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "slide_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "slide_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      slides: {
        Row: {
          category_id: string | null
          created_at: string
          created_by: string
          file_path: string | null
          id: string
          size_bytes: number | null
          status: Database["public"]["Enums"]["content_status"]
          title: string
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          created_by: string
          file_path?: string | null
          id?: string
          size_bytes?: number | null
          status?: Database["public"]["Enums"]["content_status"]
          title: string
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          created_by?: string
          file_path?: string | null
          id?: string
          size_bytes?: number | null
          status?: Database["public"]["Enums"]["content_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "slides_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "slide_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "slides_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      testimonials: {
        Row: {
          author_name: string
          author_title: string | null
          created_at: string
          id: string
          published: boolean
          quote: string
        }
        Insert: {
          author_name: string
          author_title?: string | null
          created_at?: string
          id?: string
          published?: boolean
          quote: string
        }
        Update: {
          author_name?: string
          author_title?: string | null
          created_at?: string
          id?: string
          published?: boolean
          quote?: string
        }
        Relationships: []
      }
      tiers: {
        Row: {
          created_at: string
          id: string
          identifier: string
          monthly_price_cents: number
          name: string
          stripe_price_id_monthly: string | null
          stripe_price_id_yearly: string | null
          yearly_price_cents: number
        }
        Insert: {
          created_at?: string
          id?: string
          identifier: string
          monthly_price_cents: number
          name: string
          stripe_price_id_monthly?: string | null
          stripe_price_id_yearly?: string | null
          yearly_price_cents: number
        }
        Update: {
          created_at?: string
          id?: string
          identifier?: string
          monthly_price_cents?: number
          name?: string
          stripe_price_id_monthly?: string | null
          stripe_price_id_yearly?: string | null
          yearly_price_cents?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_manage_content: {
        Args: {
          p_content_id: string
          p_content_type: string
          p_created_by: string
        }
        Returns: boolean
      }
      is_org_admin: { Args: { target_org: string }; Returns: boolean }
      is_super_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      app_role: "super_admin" | "content_manager" | "org_admin" | "member"
      content_level: "beginner" | "intermediate" | "advanced"
      content_status: "draft" | "in_review" | "changes_requested" | "published"
      page_type: "homepage" | "about" | "contact" | "pilot" | "custom"
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
      app_role: ["super_admin", "content_manager", "org_admin", "member"],
      content_level: ["beginner", "intermediate", "advanced"],
      content_status: ["draft", "in_review", "changes_requested", "published"],
      page_type: ["homepage", "about", "contact", "pilot", "custom"],
    },
  },
} as const
