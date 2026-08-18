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
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: string
          metadata: Json
          target_id: string | null
          target_type: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          target_id?: string | null
          target_type: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          target_id?: string | null
          target_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      case_features: {
        Row: {
          case_id: string
          feature_id: string
        }
        Insert: {
          case_id: string
          feature_id: string
        }
        Update: {
          case_id?: string
          feature_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_features_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_features_feature_id_fkey"
            columns: ["feature_id"]
            isOneToOne: false
            referencedRelation: "features"
            referencedColumns: ["id"]
          },
        ]
      }
      case_modules: {
        Row: {
          case_id: string
          module_id: string
        }
        Insert: {
          case_id: string
          module_id: string
        }
        Update: {
          case_id?: string
          module_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_modules_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_modules_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
        ]
      }
      case_slides: {
        Row: {
          case_id: string
          slide_id: string
        }
        Insert: {
          case_id: string
          slide_id: string
        }
        Update: {
          case_id?: string
          slide_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_slides_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_slides_slide_id_fkey"
            columns: ["slide_id"]
            isOneToOne: false
            referencedRelation: "slides"
            referencedColumns: ["id"]
          },
        ]
      }
      case_tags: {
        Row: {
          case_id: string
          tag_id: string
        }
        Insert: {
          case_id: string
          tag_id: string
        }
        Update: {
          case_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_tags_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      cases: {
        Row: {
          audio_path: string | null
          audio_transcript: string | null
          case_category: string | null
          case_context: string | null
          cpd_points: number
          created_at: string
          created_by: string
          description: string | null
          escalation_decision: string | null
          estimated_time_minutes: number | null
          final_diagnosis: string | null
          id: string
          lab_values: string | null
          learning_points: string | null
          level: Database["public"]["Enums"]["content_level"]
          slide_id: string | null
          status: Database["public"]["Enums"]["content_status"]
          suggested_report_comment: string | null
          title: string
          updated_at: string
          video_path: string | null
        }
        Insert: {
          audio_path?: string | null
          audio_transcript?: string | null
          case_category?: string | null
          case_context?: string | null
          cpd_points?: number
          created_at?: string
          created_by: string
          description?: string | null
          escalation_decision?: string | null
          estimated_time_minutes?: number | null
          final_diagnosis?: string | null
          id?: string
          lab_values?: string | null
          learning_points?: string | null
          level: Database["public"]["Enums"]["content_level"]
          slide_id?: string | null
          status?: Database["public"]["Enums"]["content_status"]
          suggested_report_comment?: string | null
          title: string
          updated_at?: string
          video_path?: string | null
        }
        Update: {
          audio_path?: string | null
          audio_transcript?: string | null
          case_category?: string | null
          case_context?: string | null
          cpd_points?: number
          created_at?: string
          created_by?: string
          description?: string | null
          escalation_decision?: string | null
          estimated_time_minutes?: number | null
          final_diagnosis?: string | null
          id?: string
          lab_values?: string | null
          learning_points?: string | null
          level?: Database["public"]["Enums"]["content_level"]
          slide_id?: string | null
          status?: Database["public"]["Enums"]["content_status"]
          suggested_report_comment?: string | null
          title?: string
          updated_at?: string
          video_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cases_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cases_slide_id_fkey"
            columns: ["slide_id"]
            isOneToOne: false
            referencedRelation: "slides"
            referencedColumns: ["id"]
          },
        ]
      }
      cell_types: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          is_wbc_diff_countable: boolean
          lineage: string
          name: string
          slug: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          is_wbc_diff_countable?: boolean
          lineage: string
          name: string
          slug: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          is_wbc_diff_countable?: boolean
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
          certificate_awarded: boolean
          certificate_title: string | null
          cpd_points: number
          created_at: string
          created_by: string
          description: string | null
          estimated_completion_minutes: number | null
          id: string
          learning_outcomes: string | null
          level: Database["public"]["Enums"]["content_level"]
          pass_threshold: number
          pathway_type: string | null
          previous_version_id: string | null
          status: Database["public"]["Enums"]["content_status"]
          title: string
          updated_at: string
          version: number
        }
        Insert: {
          certificate_awarded?: boolean
          certificate_title?: string | null
          cpd_points?: number
          created_at?: string
          created_by: string
          description?: string | null
          estimated_completion_minutes?: number | null
          id?: string
          learning_outcomes?: string | null
          level: Database["public"]["Enums"]["content_level"]
          pass_threshold?: number
          pathway_type?: string | null
          previous_version_id?: string | null
          status?: Database["public"]["Enums"]["content_status"]
          title: string
          updated_at?: string
          version?: number
        }
        Update: {
          certificate_awarded?: boolean
          certificate_title?: string | null
          cpd_points?: number
          created_at?: string
          created_by?: string
          description?: string | null
          estimated_completion_minutes?: number | null
          id?: string
          learning_outcomes?: string | null
          level?: Database["public"]["Enums"]["content_level"]
          pass_threshold?: number
          pathway_type?: string | null
          previous_version_id?: string | null
          status?: Database["public"]["Enums"]["content_status"]
          title?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "curricula_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curricula_previous_version_id_fkey"
            columns: ["previous_version_id"]
            isOneToOne: false
            referencedRelation: "curricula"
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
          audio_path: string | null
          audio_transcript: string | null
          cell_type_id: string | null
          common_confusions: string | null
          created_at: string
          created_by: string
          definition: string | null
          differential_diagnoses: string | null
          id: string
          image_path: string | null
          status: Database["public"]["Enums"]["content_status"]
          title: string
          updated_at: string
          video_path: string | null
          why_it_matters: string | null
        }
        Insert: {
          audio_path?: string | null
          audio_transcript?: string | null
          cell_type_id?: string | null
          common_confusions?: string | null
          created_at?: string
          created_by: string
          definition?: string | null
          differential_diagnoses?: string | null
          id?: string
          image_path?: string | null
          status?: Database["public"]["Enums"]["content_status"]
          title: string
          updated_at?: string
          video_path?: string | null
          why_it_matters?: string | null
        }
        Update: {
          audio_path?: string | null
          audio_transcript?: string | null
          cell_type_id?: string | null
          common_confusions?: string | null
          created_at?: string
          created_by?: string
          definition?: string | null
          differential_diagnoses?: string | null
          id?: string
          image_path?: string | null
          status?: Database["public"]["Enums"]["content_status"]
          title?: string
          updated_at?: string
          video_path?: string | null
          why_it_matters?: string | null
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
      impersonation_sessions: {
        Row: {
          actor_id: string
          ended_at: string | null
          id: string
          started_at: string
          target_id: string
        }
        Insert: {
          actor_id: string
          ended_at?: string | null
          id?: string
          started_at?: string
          target_id: string
        }
        Update: {
          actor_id?: string
          ended_at?: string | null
          id?: string
          started_at?: string
          target_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "impersonation_sessions_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "impersonation_sessions_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lessons: {
        Row: {
          audio_path: string | null
          audio_transcript: string | null
          body: string | null
          created_at: string
          created_by: string
          id: string
          module_id: string
          position: number
          slide_id: string | null
          title: string
          updated_at: string
          video_path: string | null
        }
        Insert: {
          audio_path?: string | null
          audio_transcript?: string | null
          body?: string | null
          created_at?: string
          created_by: string
          id?: string
          module_id: string
          position?: number
          slide_id?: string | null
          title: string
          updated_at?: string
          video_path?: string | null
        }
        Update: {
          audio_path?: string | null
          audio_transcript?: string | null
          body?: string | null
          created_at?: string
          created_by?: string
          id?: string
          module_id?: string
          position?: number
          slide_id?: string | null
          title?: string
          updated_at?: string
          video_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lessons_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_slide_id_fkey"
            columns: ["slide_id"]
            isOneToOne: false
            referencedRelation: "slides"
            referencedColumns: ["id"]
          },
        ]
      }
      module_prerequisites: {
        Row: {
          module_id: string
          prerequisite_module_id: string
        }
        Insert: {
          module_id: string
          prerequisite_module_id: string
        }
        Update: {
          module_id?: string
          prerequisite_module_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "module_prerequisites_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "module_prerequisites_prerequisite_module_id_fkey"
            columns: ["prerequisite_module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
        ]
      }
      module_tags: {
        Row: {
          module_id: string
          tag_id: string
        }
        Insert: {
          module_id: string
          tag_id: string
        }
        Update: {
          module_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "module_tags_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "module_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      modules: {
        Row: {
          audio_path: string | null
          audio_transcript: string | null
          cpd_points: number
          created_at: string
          created_by: string
          description: string | null
          estimated_duration_minutes: number | null
          id: string
          learning_objectives: string | null
          level: Database["public"]["Enums"]["content_level"]
          module_type: string | null
          status: Database["public"]["Enums"]["content_status"]
          teaching_notes: string | null
          title: string
          updated_at: string
          video_path: string | null
        }
        Insert: {
          audio_path?: string | null
          audio_transcript?: string | null
          cpd_points?: number
          created_at?: string
          created_by: string
          description?: string | null
          estimated_duration_minutes?: number | null
          id?: string
          learning_objectives?: string | null
          level: Database["public"]["Enums"]["content_level"]
          module_type?: string | null
          status?: Database["public"]["Enums"]["content_status"]
          teaching_notes?: string | null
          title: string
          updated_at?: string
          video_path?: string | null
        }
        Update: {
          audio_path?: string | null
          audio_transcript?: string | null
          cpd_points?: number
          created_at?: string
          created_by?: string
          description?: string | null
          estimated_duration_minutes?: number | null
          id?: string
          learning_objectives?: string | null
          level?: Database["public"]["Enums"]["content_level"]
          module_type?: string | null
          status?: Database["public"]["Enums"]["content_status"]
          teaching_notes?: string | null
          title?: string
          updated_at?: string
          video_path?: string | null
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
      onboarding_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string
          due_date: string | null
          id: string
          plan_id: string
          user_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by: string
          due_date?: string | null
          id?: string
          plan_id: string
          user_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string
          due_date?: string | null
          id?: string
          plan_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_assignments_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "onboarding_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_assignments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_plan_items: {
        Row: {
          curriculum_id: string | null
          id: string
          module_id: string | null
          plan_id: string
          position: number
        }
        Insert: {
          curriculum_id?: string | null
          id?: string
          module_id?: string | null
          plan_id: string
          position?: number
        }
        Update: {
          curriculum_id?: string | null
          id?: string
          module_id?: string | null
          plan_id?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_plan_items_curriculum_id_fkey"
            columns: ["curriculum_id"]
            isOneToOne: false
            referencedRelation: "curricula"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_plan_items_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_plan_items_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "onboarding_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_plans: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          id: string
          name: string
          org_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          name: string
          org_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          name?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_plans_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_plans_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          manual_grades: Json | null
          module_id: string | null
          passed: boolean
          pending_manual_grading: boolean
          score: number
          user_id: string
        }
        Insert: {
          answers: Json
          case_id?: string | null
          created_at?: string
          id?: string
          manual_grades?: Json | null
          module_id?: string | null
          passed: boolean
          pending_manual_grading?: boolean
          score: number
          user_id: string
        }
        Update: {
          answers?: Json
          case_id?: string | null
          created_at?: string
          id?: string
          manual_grades?: Json | null
          module_id?: string | null
          passed?: boolean
          pending_manual_grading?: boolean
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
          correct_choice_id: string | null
          correct_choice_ids: Json | null
          created_at: string
          created_by: string
          feature_id: string | null
          id: string
          model_answer: string | null
          module_id: string | null
          position: number
          question_text: string
          question_type: string
        }
        Insert: {
          case_id?: string | null
          choices: Json
          correct_choice_id?: string | null
          correct_choice_ids?: Json | null
          created_at?: string
          created_by: string
          feature_id?: string | null
          id?: string
          model_answer?: string | null
          module_id?: string | null
          position?: number
          question_text: string
          question_type?: string
        }
        Update: {
          case_id?: string | null
          choices?: Json
          correct_choice_id?: string | null
          correct_choice_ids?: Json | null
          created_at?: string
          created_by?: string
          feature_id?: string | null
          id?: string
          model_answer?: string | null
          module_id?: string | null
          position?: number
          question_text?: string
          question_type?: string
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
            foreignKeyName: "quiz_questions_feature_id_fkey"
            columns: ["feature_id"]
            isOneToOne: false
            referencedRelation: "features"
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
      slide_annotations: {
        Row: {
          body: string | null
          created_at: string
          created_by: string
          id: string
          label: string
          position: number
          slide_id: string
          x_pct: number
          y_pct: number
        }
        Insert: {
          body?: string | null
          created_at?: string
          created_by: string
          id?: string
          label: string
          position?: number
          slide_id: string
          x_pct: number
          y_pct: number
        }
        Update: {
          body?: string | null
          created_at?: string
          created_by?: string
          id?: string
          label?: string
          position?: number
          slide_id?: string
          x_pct?: number
          y_pct?: number
        }
        Relationships: [
          {
            foreignKeyName: "slide_annotations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "slide_annotations_slide_id_fkey"
            columns: ["slide_id"]
            isOneToOne: false
            referencedRelation: "slides"
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
      slide_views: {
        Row: {
          id: string
          slide_id: string
          user_id: string
          viewed_at: string
        }
        Insert: {
          id?: string
          slide_id: string
          user_id: string
          viewed_at?: string
        }
        Update: {
          id?: string
          slide_id?: string
          user_id?: string
          viewed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "slide_views_slide_id_fkey"
            columns: ["slide_id"]
            isOneToOne: false
            referencedRelation: "slides"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "slide_views_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
          tile_manifest_url: string | null
          tiling_status: string
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
          tile_manifest_url?: string | null
          tiling_status?: string
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
          tile_manifest_url?: string | null
          tiling_status?: string
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
      tags: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
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
      tiling_jobs: {
        Row: {
          attempts: number
          cmd_id: string | null
          created_at: string
          error: string | null
          id: string
          sandbox_id: string | null
          slide_id: string
          status: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          cmd_id?: string | null
          created_at?: string
          error?: string | null
          id?: string
          sandbox_id?: string | null
          slide_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          cmd_id?: string | null
          created_at?: string
          error?: string | null
          id?: string
          sandbox_id?: string | null
          slide_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tiling_jobs_slide_id_fkey"
            columns: ["slide_id"]
            isOneToOne: false
            referencedRelation: "slides"
            referencedColumns: ["id"]
          },
        ]
      }
      wbc_diff_attempts: {
        Row: {
          accuracy_pct: number
          created_at: string
          exercise_id: string
          id: string
          results: Json
          user_id: string
        }
        Insert: {
          accuracy_pct: number
          created_at?: string
          exercise_id: string
          id?: string
          results: Json
          user_id: string
        }
        Update: {
          accuracy_pct?: number
          created_at?: string
          exercise_id?: string
          id?: string
          results?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wbc_diff_attempts_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "wbc_diff_exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wbc_diff_attempts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      wbc_diff_exercises: {
        Row: {
          case_id: string | null
          cpd_points: number
          created_at: string
          created_by: string
          id: string
          instructions: string | null
          level: Database["public"]["Enums"]["content_level"]
          module_id: string | null
          slide_id: string
          status: Database["public"]["Enums"]["content_status"]
          title: string
          updated_at: string
        }
        Insert: {
          case_id?: string | null
          cpd_points?: number
          created_at?: string
          created_by: string
          id?: string
          instructions?: string | null
          level: Database["public"]["Enums"]["content_level"]
          module_id?: string | null
          slide_id: string
          status?: Database["public"]["Enums"]["content_status"]
          title: string
          updated_at?: string
        }
        Update: {
          case_id?: string | null
          cpd_points?: number
          created_at?: string
          created_by?: string
          id?: string
          instructions?: string | null
          level?: Database["public"]["Enums"]["content_level"]
          module_id?: string | null
          slide_id?: string
          status?: Database["public"]["Enums"]["content_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wbc_diff_exercises_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wbc_diff_exercises_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wbc_diff_exercises_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wbc_diff_exercises_slide_id_fkey"
            columns: ["slide_id"]
            isOneToOne: false
            referencedRelation: "slides"
            referencedColumns: ["id"]
          },
        ]
      }
      wbc_diff_hotspots: {
        Row: {
          cell_type_id: string
          created_at: string
          exercise_id: string
          id: string
          tolerance_pct: number
          x_pct: number
          y_pct: number
        }
        Insert: {
          cell_type_id: string
          created_at?: string
          exercise_id: string
          id?: string
          tolerance_pct?: number
          x_pct: number
          y_pct: number
        }
        Update: {
          cell_type_id?: string
          created_at?: string
          exercise_id?: string
          id?: string
          tolerance_pct?: number
          x_pct?: number
          y_pct?: number
        }
        Relationships: [
          {
            foreignKeyName: "wbc_diff_hotspots_cell_type_id_fkey"
            columns: ["cell_type_id"]
            isOneToOne: false
            referencedRelation: "cell_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wbc_diff_hotspots_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "wbc_diff_exercises"
            referencedColumns: ["id"]
          },
        ]
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
      find_profile_id_by_email: { Args: { p_email: string }; Returns: string }
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
