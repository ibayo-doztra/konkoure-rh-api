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
      achievements: {
        Row: {
          achieved_at: string
          created_at: string
          description: string | null
          employee_id: string | null
          goal_id: string | null
          id: string
          impact: string | null
          organization_id: string
          title: string
          updated_at: string
        }
        Insert: {
          achieved_at?: string
          created_at?: string
          description?: string | null
          employee_id?: string | null
          goal_id?: string | null
          id?: string
          impact?: string | null
          organization_id: string
          title: string
          updated_at?: string
        }
        Update: {
          achieved_at?: string
          created_at?: string
          description?: string | null
          employee_id?: string | null
          goal_id?: string | null
          id?: string
          impact?: string | null
          organization_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "achievements_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_email: string | null
          actor_user_id: string | null
          after_data: Json | null
          before_data: Json | null
          created_at: string
          id: string
          ip: string | null
          organization_id: string | null
          target_id: string | null
          target_type: string | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_user_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          id?: string
          ip?: string | null
          organization_id?: string | null
          target_id?: string | null
          target_type?: string | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_user_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          id?: string
          ip?: string | null
          organization_id?: string | null
          target_id?: string | null
          target_type?: string | null
        }
        Relationships: []
      }
      billing_audit_log: {
        Row: {
          created_at: string
          event: string
          id: string
          org_id: string | null
          payload: Json
        }
        Insert: {
          created_at?: string
          event: string
          id?: string
          org_id?: string | null
          payload?: Json
        }
        Update: {
          created_at?: string
          event?: string
          id?: string
          org_id?: string | null
          payload?: Json
        }
        Relationships: []
      }
      candidate_activities: {
        Row: {
          actor_id: string | null
          candidate_id: string
          created_at: string
          id: string
          organization_id: string
          payload: Json
          type: Database["public"]["Enums"]["candidate_activity_type"]
        }
        Insert: {
          actor_id?: string | null
          candidate_id: string
          created_at?: string
          id?: string
          organization_id: string
          payload?: Json
          type: Database["public"]["Enums"]["candidate_activity_type"]
        }
        Update: {
          actor_id?: string | null
          candidate_id?: string
          created_at?: string
          id?: string
          organization_id?: string
          payload?: Json
          type?: Database["public"]["Enums"]["candidate_activity_type"]
        }
        Relationships: []
      }
      candidate_notes: {
        Row: {
          author_id: string | null
          body: string
          candidate_id: string
          created_at: string
          id: string
          organization_id: string
        }
        Insert: {
          author_id?: string | null
          body: string
          candidate_id: string
          created_at?: string
          id?: string
          organization_id: string
        }
        Update: {
          author_id?: string | null
          body?: string
          candidate_id?: string
          created_at?: string
          id?: string
          organization_id?: string
        }
        Relationships: []
      }
      candidates: {
        Row: {
          ai_candidate_name: string | null
          ai_fraud_alert: boolean | null
          ai_is_valid_cv: boolean | null
          ai_justification: string | null
          ai_score: number | null
          ai_scored_at: string | null
          ai_strengths: Json
          ai_weaknesses: Json
          cover_letter_url: string | null
          created_at: string
          cv_text: string | null
          cv_url: string | null
          documents: Json
          email: string | null
          full_name: string
          id: string
          job_id: string
          organization_id: string
          phone: string | null
          stage: Database["public"]["Enums"]["candidate_stage"]
        }
        Insert: {
          ai_candidate_name?: string | null
          ai_fraud_alert?: boolean | null
          ai_is_valid_cv?: boolean | null
          ai_justification?: string | null
          ai_score?: number | null
          ai_scored_at?: string | null
          ai_strengths?: Json
          ai_weaknesses?: Json
          cover_letter_url?: string | null
          created_at?: string
          cv_text?: string | null
          cv_url?: string | null
          documents?: Json
          email?: string | null
          full_name: string
          id?: string
          job_id: string
          organization_id: string
          phone?: string | null
          stage?: Database["public"]["Enums"]["candidate_stage"]
        }
        Update: {
          ai_candidate_name?: string | null
          ai_fraud_alert?: boolean | null
          ai_is_valid_cv?: boolean | null
          ai_justification?: string | null
          ai_score?: number | null
          ai_scored_at?: string | null
          ai_strengths?: Json
          ai_weaknesses?: Json
          cover_letter_url?: string | null
          created_at?: string
          cv_text?: string | null
          cv_url?: string | null
          documents?: Json
          email?: string | null
          full_name?: string
          id?: string
          job_id?: string
          organization_id?: string
          phone?: string | null
          stage?: Database["public"]["Enums"]["candidate_stage"]
        }
        Relationships: [
          {
            foreignKeyName: "candidates_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          created_at: string
          currency: string | null
          document_url: string | null
          employee_id: string
          end_date: string | null
          id: string
          notes: string | null
          organization_id: string
          salary: number | null
          start_date: string
          status: Database["public"]["Enums"]["contract_status"]
          trial_period_end: string | null
          type: Database["public"]["Enums"]["contract_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string | null
          document_url?: string | null
          employee_id: string
          end_date?: string | null
          id?: string
          notes?: string | null
          organization_id: string
          salary?: number | null
          start_date: string
          status?: Database["public"]["Enums"]["contract_status"]
          trial_period_end?: string | null
          type: Database["public"]["Enums"]["contract_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string | null
          document_url?: string | null
          employee_id?: string
          end_date?: string | null
          id?: string
          notes?: string | null
          organization_id?: string
          salary?: number | null
          start_date?: string
          status?: Database["public"]["Enums"]["contract_status"]
          trial_period_end?: string | null
          type?: Database["public"]["Enums"]["contract_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contracts_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      demo_requests: {
        Row: {
          company_name: string
          company_size: string
          created_at: string
          email: string
          email_error: string | null
          email_sent_at: string | null
          email_status: string
          full_name: string
          id: string
          message: string | null
          phone: string
          status: string
          updated_at: string
        }
        Insert: {
          company_name: string
          company_size: string
          created_at?: string
          email: string
          email_error?: string | null
          email_sent_at?: string | null
          email_status?: string
          full_name: string
          id?: string
          message?: string | null
          phone: string
          status?: string
          updated_at?: string
        }
        Update: {
          company_name?: string
          company_size?: string
          created_at?: string
          email?: string
          email_error?: string | null
          email_sent_at?: string | null
          email_status?: string
          full_name?: string
          id?: string
          message?: string | null
          phone?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      departments: {
        Row: {
          created_at: string
          deleted_at: string | null
          description: string | null
          id: string
          manager_id: string | null
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          manager_id?: string | null
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          manager_id?: string | null
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "departments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_skills: {
        Row: {
          employee_id: string
          id: string
          level: number
          organization_id: string
          skill_id: string
        }
        Insert: {
          employee_id: string
          id?: string
          level?: number
          organization_id: string
          skill_id: string
        }
        Update: {
          employee_id?: string
          id?: string
          level?: number
          organization_id?: string
          skill_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_skills_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_skills_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_skills_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          base_salary: number | null
          created_at: string
          department_id: string | null
          email: string | null
          first_name: string
          hire_date: string | null
          id: string
          job_title: string | null
          last_name: string
          leave_balance: number
          manager_id: string | null
          nfc_badge_active: boolean
          nfc_badge_assigned_at: string | null
          nfc_badge_uid: string | null
          organization_id: string
          phone: string | null
          photo_url: string | null
          position: string | null
          profile_details: Json
          status: Database["public"]["Enums"]["employee_status"]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          base_salary?: number | null
          created_at?: string
          department_id?: string | null
          email?: string | null
          first_name: string
          hire_date?: string | null
          id?: string
          job_title?: string | null
          last_name: string
          leave_balance?: number
          manager_id?: string | null
          nfc_badge_active?: boolean
          nfc_badge_assigned_at?: string | null
          nfc_badge_uid?: string | null
          organization_id: string
          phone?: string | null
          photo_url?: string | null
          position?: string | null
          profile_details?: Json
          status?: Database["public"]["Enums"]["employee_status"]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          base_salary?: number | null
          created_at?: string
          department_id?: string | null
          email?: string | null
          first_name?: string
          hire_date?: string | null
          id?: string
          job_title?: string | null
          last_name?: string
          leave_balance?: number
          manager_id?: string | null
          nfc_badge_active?: boolean
          nfc_badge_assigned_at?: string | null
          nfc_badge_uid?: string | null
          organization_id?: string
          phone?: string | null
          photo_url?: string | null
          position?: string | null
          profile_details?: Json
          status?: Database["public"]["Enums"]["employee_status"]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      feedbacks: {
        Row: {
          created_at: string
          from_employee_id: string | null
          goal_id: string | null
          id: string
          kind: Database["public"]["Enums"]["feedback_kind"]
          message: string
          okr_id: string | null
          organization_id: string
          to_employee_id: string
        }
        Insert: {
          created_at?: string
          from_employee_id?: string | null
          goal_id?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["feedback_kind"]
          message: string
          okr_id?: string | null
          organization_id: string
          to_employee_id: string
        }
        Update: {
          created_at?: string
          from_employee_id?: string | null
          goal_id?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["feedback_kind"]
          message?: string
          okr_id?: string | null
          organization_id?: string
          to_employee_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feedbacks_from_employee_id_fkey"
            columns: ["from_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedbacks_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedbacks_okr_id_fkey"
            columns: ["okr_id"]
            isOneToOne: false
            referencedRelation: "okrs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedbacks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedbacks_to_employee_id_fkey"
            columns: ["to_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      goal_activities: {
        Row: {
          completed_at: string | null
          created_at: string
          description: string | null
          employee_id: string | null
          goal_id: string
          id: string
          organization_id: string
          planned_date: string | null
          status: Database["public"]["Enums"]["goal_activity_status"]
          title: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          description?: string | null
          employee_id?: string | null
          goal_id: string
          id?: string
          organization_id: string
          planned_date?: string | null
          status?: Database["public"]["Enums"]["goal_activity_status"]
          title: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          description?: string | null
          employee_id?: string | null
          goal_id?: string
          id?: string
          organization_id?: string
          planned_date?: string | null
          status?: Database["public"]["Enums"]["goal_activity_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "goal_activities_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
        ]
      }
      goals: {
        Row: {
          category: Database["public"]["Enums"]["goal_category"]
          created_at: string
          created_by_id: string | null
          description: string | null
          due_date: string | null
          employee_id: string | null
          end_date: string | null
          id: string
          measurement: string | null
          organization_id: string
          owner_id: string | null
          parent_goal_id: string | null
          plan_id: string | null
          progress: number
          review_id: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["goal_status"]
          title: string
          updated_at: string
          weight: number
        }
        Insert: {
          category?: Database["public"]["Enums"]["goal_category"]
          created_at?: string
          created_by_id?: string | null
          description?: string | null
          due_date?: string | null
          employee_id?: string | null
          end_date?: string | null
          id?: string
          measurement?: string | null
          organization_id: string
          owner_id?: string | null
          parent_goal_id?: string | null
          plan_id?: string | null
          progress?: number
          review_id?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["goal_status"]
          title: string
          updated_at?: string
          weight?: number
        }
        Update: {
          category?: Database["public"]["Enums"]["goal_category"]
          created_at?: string
          created_by_id?: string | null
          description?: string | null
          due_date?: string | null
          employee_id?: string | null
          end_date?: string | null
          id?: string
          measurement?: string | null
          organization_id?: string
          owner_id?: string | null
          parent_goal_id?: string | null
          plan_id?: string | null
          progress?: number
          review_id?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["goal_status"]
          title?: string
          updated_at?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "goals_parent_goal_id_fkey"
            columns: ["parent_goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goals_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "performance_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          contract_type: Database["public"]["Enums"]["contract_type"]
          created_at: string
          created_by: string | null
          deadline: string | null
          department_id: string | null
          description: string | null
          id: string
          inclusive_score: number | null
          location: string | null
          organization_id: string
          required_documents: Json
          requirements: string | null
          slug: string | null
          status: Database["public"]["Enums"]["job_status"]
          title: string
        }
        Insert: {
          contract_type?: Database["public"]["Enums"]["contract_type"]
          created_at?: string
          created_by?: string | null
          deadline?: string | null
          department_id?: string | null
          description?: string | null
          id?: string
          inclusive_score?: number | null
          location?: string | null
          organization_id: string
          required_documents?: Json
          requirements?: string | null
          slug?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          title: string
        }
        Update: {
          contract_type?: Database["public"]["Enums"]["contract_type"]
          created_at?: string
          created_by?: string | null
          deadline?: string | null
          department_id?: string | null
          description?: string | null
          id?: string
          inclusive_score?: number | null
          location?: string | null
          organization_id?: string
          required_documents?: Json
          requirements?: string | null
          slug?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobs_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_requests: {
        Row: {
          balance_applied: boolean
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_comment: string | null
          employee_id: string
          end_date: string
          id: string
          organization_id: string
          reason: string | null
          requested_days: number
          start_date: string
          status: Database["public"]["Enums"]["leave_status"]
          type: Database["public"]["Enums"]["leave_type"]
          updated_at: string
        }
        Insert: {
          balance_applied?: boolean
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_comment?: string | null
          employee_id: string
          end_date: string
          id?: string
          organization_id: string
          reason?: string | null
          requested_days?: number
          start_date: string
          status?: Database["public"]["Enums"]["leave_status"]
          type: Database["public"]["Enums"]["leave_type"]
          updated_at?: string
        }
        Update: {
          balance_applied?: boolean
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_comment?: string | null
          employee_id?: string
          end_date?: string
          id?: string
          organization_id?: string
          reason?: string | null
          requested_days?: number
          start_date?: string
          status?: Database["public"]["Enums"]["leave_status"]
          type?: Database["public"]["Enums"]["leave_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leave_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      nfc_badge_history: {
        Row: {
          actor_user_id: string | null
          created_at: string
          employee_id: string
          event: string
          id: string
          organization_id: string
          reason: string | null
          uid: string
        }
        Insert: {
          actor_user_id?: string | null
          created_at?: string
          employee_id: string
          event: string
          id?: string
          organization_id: string
          reason?: string | null
          uid: string
        }
        Update: {
          actor_user_id?: string | null
          created_at?: string
          employee_id?: string
          event?: string
          id?: string
          organization_id?: string
          reason?: string | null
          uid?: string
        }
        Relationships: [
          {
            foreignKeyName: "nfc_badge_history_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          link: string | null
          organization_id: string
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          organization_id: string
          read_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          organization_id?: string
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      okr_checkins: {
        Row: {
          author_employee_id: string | null
          created_at: string
          id: string
          message: string
          okr_id: string
          organization_id: string
          progress_snapshot: number
          updated_at: string
        }
        Insert: {
          author_employee_id?: string | null
          created_at?: string
          id?: string
          message: string
          okr_id: string
          organization_id: string
          progress_snapshot?: number
          updated_at?: string
        }
        Update: {
          author_employee_id?: string | null
          created_at?: string
          id?: string
          message?: string
          okr_id?: string
          organization_id?: string
          progress_snapshot?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "okr_checkins_author_employee_id_fkey"
            columns: ["author_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "okr_checkins_okr_id_fkey"
            columns: ["okr_id"]
            isOneToOne: false
            referencedRelation: "okrs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "okr_checkins_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      okrs: {
        Row: {
          created_at: string
          employee_id: string | null
          id: string
          key_results: Json
          manager_comment: string | null
          objective: string
          organization_id: string
          progress: number
          quarter: string
          review_status: Database["public"]["Enums"]["okr_review_status"]
          status: Database["public"]["Enums"]["okr_status"]
          submitted_at: string | null
          validated_at: string | null
          validated_by: string | null
        }
        Insert: {
          created_at?: string
          employee_id?: string | null
          id?: string
          key_results?: Json
          manager_comment?: string | null
          objective: string
          organization_id: string
          progress?: number
          quarter: string
          review_status?: Database["public"]["Enums"]["okr_review_status"]
          status?: Database["public"]["Enums"]["okr_status"]
          submitted_at?: string | null
          validated_at?: string | null
          validated_by?: string | null
        }
        Update: {
          created_at?: string
          employee_id?: string | null
          id?: string
          key_results?: Json
          manager_comment?: string | null
          objective?: string
          organization_id?: string
          progress?: number
          quarter?: string
          review_status?: Database["public"]["Enums"]["okr_review_status"]
          status?: Database["public"]["Enums"]["okr_status"]
          submitted_at?: string | null
          validated_at?: string | null
          validated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "okrs_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "okrs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          created_by: string | null
          cycle: string
          default_currency: string
          default_language: string
          id: string
          logo_url: string | null
          max_employes_override: number | null
          modules_override: Json | null
          name: string
          performance_model: Database["public"]["Enums"]["performance_model"]
          periode_fin: string | null
          plan: Database["public"]["Enums"]["plan_type"]
          plan_id: string | null
          slug: string
          statut_abo: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          cycle?: string
          default_currency?: string
          default_language?: string
          id?: string
          logo_url?: string | null
          max_employes_override?: number | null
          modules_override?: Json | null
          name: string
          performance_model?: Database["public"]["Enums"]["performance_model"]
          periode_fin?: string | null
          plan?: Database["public"]["Enums"]["plan_type"]
          plan_id?: string | null
          slug: string
          statut_abo?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          cycle?: string
          default_currency?: string
          default_language?: string
          id?: string
          logo_url?: string | null
          max_employes_override?: number | null
          modules_override?: Json | null
          name?: string
          performance_model?: Database["public"]["Enums"]["performance_model"]
          periode_fin?: string | null
          plan?: Database["public"]["Enums"]["plan_type"]
          plan_id?: string | null
          slug?: string
          statut_abo?: string
        }
        Relationships: [
          {
            foreignKeyName: "organizations_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      performance_cycles: {
        Row: {
          created_at: string
          created_by: string | null
          frequency: Database["public"]["Enums"]["perf_cycle_frequency"]
          id: string
          name: string
          organization_id: string
          period_end: string
          period_start: string
          self_eval_closes_at: string | null
          self_eval_opens_at: string | null
          status: Database["public"]["Enums"]["perf_cycle_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          frequency?: Database["public"]["Enums"]["perf_cycle_frequency"]
          id?: string
          name: string
          organization_id: string
          period_end: string
          period_start: string
          self_eval_closes_at?: string | null
          self_eval_opens_at?: string | null
          status?: Database["public"]["Enums"]["perf_cycle_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          frequency?: Database["public"]["Enums"]["perf_cycle_frequency"]
          id?: string
          name?: string
          organization_id?: string
          period_end?: string
          period_start?: string
          self_eval_closes_at?: string | null
          self_eval_opens_at?: string | null
          status?: Database["public"]["Enums"]["perf_cycle_status"]
          updated_at?: string
        }
        Relationships: []
      }
      performance_plans: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
          organization_id: string
          period_end: string
          period_start: string
          status: Database["public"]["Enums"]["perf_plan_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          organization_id: string
          period_end: string
          period_start: string
          status?: Database["public"]["Enums"]["perf_plan_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          organization_id?: string
          period_end?: string
          period_start?: string
          status?: Database["public"]["Enums"]["perf_plan_status"]
          updated_at?: string
        }
        Relationships: []
      }
      performance_reviews: {
        Row: {
          created_at: string
          cycle_id: string | null
          employee_id: string
          id: string
          manager_global_comment: string | null
          manager_id: string | null
          manager_score: number | null
          manager_submitted_at: string | null
          organization_id: string
          plan_id: string | null
          self_global_comment: string | null
          self_score: number | null
          signed_at: string | null
          status: Database["public"]["Enums"]["perf_review_status"]
          submitted_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          cycle_id?: string | null
          employee_id: string
          id?: string
          manager_global_comment?: string | null
          manager_id?: string | null
          manager_score?: number | null
          manager_submitted_at?: string | null
          organization_id: string
          plan_id?: string | null
          self_global_comment?: string | null
          self_score?: number | null
          signed_at?: string | null
          status?: Database["public"]["Enums"]["perf_review_status"]
          submitted_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          cycle_id?: string | null
          employee_id?: string
          id?: string
          manager_global_comment?: string | null
          manager_id?: string | null
          manager_score?: number | null
          manager_submitted_at?: string | null
          organization_id?: string
          plan_id?: string | null
          self_global_comment?: string | null
          self_score?: number | null
          signed_at?: string | null
          status?: Database["public"]["Enums"]["perf_review_status"]
          submitted_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "performance_reviews_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "performance_cycles"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          code: string
          created_at: string
          credits_ia_mois: number
          features: Json
          id: string
          max_employes: number
          nom: string
          prix_gnf: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          credits_ia_mois?: number
          features?: Json
          id?: string
          max_employes?: number
          nom: string
          prix_gnf?: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          credits_ia_mois?: number
          features?: Json
          id?: string
          max_employes?: number
          nom?: string
          prix_gnf?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      platform_admins: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          level: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          level?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          level?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      platform_settings: {
        Row: {
          created_at: string
          description: string | null
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          created_at?: string
          description?: string | null
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Update: {
          created_at?: string
          description?: string | null
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      prepaid_email_codes: {
        Row: {
          attempts: number
          code_hash: string
          consumed_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
        }
        Insert: {
          attempts?: number
          code_hash: string
          consumed_at?: string | null
          created_at?: string
          email: string
          expires_at: string
          id?: string
        }
        Update: {
          attempts?: number
          code_hash?: string
          consumed_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          preferred_language: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          preferred_language?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          preferred_language?: string | null
        }
        Relationships: []
      }
      public_holidays: {
        Row: {
          created_at: string
          date: string
          id: string
          is_movable: boolean
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          is_movable?: boolean
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          is_movable?: boolean
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "public_holidays_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      recruitment_webhook_configs: {
        Row: {
          active_env: string
          organization_id: string
          prod_webhook_url: string | null
          test_webhook_url: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          active_env?: string
          organization_id: string
          prod_webhook_url?: string | null
          test_webhook_url?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          active_env?: string
          organization_id?: string
          prod_webhook_url?: string | null
          test_webhook_url?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recruitment_webhook_configs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      review_goal_comments: {
        Row: {
          created_at: string
          goal_id: string
          id: string
          manager_comment: string | null
          organization_id: string
          review_id: string
          self_comment: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          goal_id: string
          id?: string
          manager_comment?: string | null
          organization_id: string
          review_id: string
          self_comment?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          goal_id?: string
          id?: string
          manager_comment?: string | null
          organization_id?: string
          review_id?: string
          self_comment?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_goal_comments_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_goal_comments_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "performance_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          ai_summary: string | null
          created_at: string
          employee_id: string
          id: string
          manager_text: string | null
          organization_id: string
          performance_score: number | null
          period: string
          potential_score: number | null
          self_text: string | null
          status: Database["public"]["Enums"]["review_status"]
        }
        Insert: {
          ai_summary?: string | null
          created_at?: string
          employee_id: string
          id?: string
          manager_text?: string | null
          organization_id: string
          performance_score?: number | null
          period: string
          potential_score?: number | null
          self_text?: string | null
          status?: Database["public"]["Enums"]["review_status"]
        }
        Update: {
          ai_summary?: string | null
          created_at?: string
          employee_id?: string
          id?: string
          manager_text?: string | null
          organization_id?: string
          performance_score?: number | null
          period?: string
          potential_score?: number | null
          self_text?: string | null
          status?: Database["public"]["Enums"]["review_status"]
        }
        Relationships: [
          {
            foreignKeyName: "reviews_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      skills: {
        Row: {
          category: string | null
          created_at: string
          id: string
          name: string
          organization_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          id?: string
          name: string
          organization_id: string
        }
        Update: {
          category?: string | null
          created_at?: string
          id?: string
          name?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "skills_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      social_accounts: {
        Row: {
          account_id: string
          account_name: string
          connected_at: string
          connected_by: string | null
          id: string
          metadata: Json
          organization_id: string
          provider: Database["public"]["Enums"]["social_provider"]
          scopes: string[]
          status: Database["public"]["Enums"]["social_account_status"]
          token_expires_at: string | null
        }
        Insert: {
          account_id: string
          account_name: string
          connected_at?: string
          connected_by?: string | null
          id?: string
          metadata?: Json
          organization_id: string
          provider: Database["public"]["Enums"]["social_provider"]
          scopes?: string[]
          status?: Database["public"]["Enums"]["social_account_status"]
          token_expires_at?: string | null
        }
        Update: {
          account_id?: string
          account_name?: string
          connected_at?: string
          connected_by?: string | null
          id?: string
          metadata?: Json
          organization_id?: string
          provider?: Database["public"]["Enums"]["social_provider"]
          scopes?: string[]
          status?: Database["public"]["Enums"]["social_account_status"]
          token_expires_at?: string | null
        }
        Relationships: []
      }
      social_posts: {
        Row: {
          content: string
          created_at: string
          created_by: string | null
          error_message: string | null
          external_post_id: string | null
          external_url: string | null
          id: string
          job_id: string
          media_urls: Json
          organization_id: string
          provider: Database["public"]["Enums"]["social_provider"]
          published_at: string | null
          social_account_id: string
          status: Database["public"]["Enums"]["social_post_status"]
        }
        Insert: {
          content: string
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          external_post_id?: string | null
          external_url?: string | null
          id?: string
          job_id: string
          media_urls?: Json
          organization_id: string
          provider: Database["public"]["Enums"]["social_provider"]
          published_at?: string | null
          social_account_id: string
          status?: Database["public"]["Enums"]["social_post_status"]
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          external_post_id?: string | null
          external_url?: string | null
          id?: string
          job_id?: string
          media_urls?: Json
          organization_id?: string
          provider?: Database["public"]["Enums"]["social_provider"]
          published_at?: string | null
          social_account_id?: string
          status?: Database["public"]["Enums"]["social_post_status"]
        }
        Relationships: [
          {
            foreignKeyName: "social_posts_social_account_id_fkey"
            columns: ["social_account_id"]
            isOneToOne: false
            referencedRelation: "social_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_payments: {
        Row: {
          claim_email: string | null
          claim_token: string | null
          claimed_at: string | null
          created_at: string
          currency: string
          cycle: string
          djomy_transaction_id: string | null
          expected_amount: number
          id: string
          merchant_reference: string
          method: string | null
          org_id: string | null
          plan_id: string
          raw_event: Json | null
          status: string
          updated_at: string
        }
        Insert: {
          claim_email?: string | null
          claim_token?: string | null
          claimed_at?: string | null
          created_at?: string
          currency?: string
          cycle: string
          djomy_transaction_id?: string | null
          expected_amount: number
          id?: string
          merchant_reference: string
          method?: string | null
          org_id?: string | null
          plan_id: string
          raw_event?: Json | null
          status?: string
          updated_at?: string
        }
        Update: {
          claim_email?: string | null
          claim_token?: string | null
          claimed_at?: string | null
          created_at?: string
          currency?: string
          cycle?: string
          djomy_transaction_id?: string | null
          expected_amount?: number
          id?: string
          merchant_reference?: string
          method?: string | null
          org_id?: string | null
          plan_id?: string
          raw_event?: Json | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_payments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_payments_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      succession_plans: {
        Row: {
          created_at: string
          current_employee_id: string | null
          id: string
          notes: string | null
          organization_id: string
          position_title: string
          readiness: string | null
          successor_employee_id: string | null
        }
        Insert: {
          created_at?: string
          current_employee_id?: string | null
          id?: string
          notes?: string | null
          organization_id: string
          position_title: string
          readiness?: string | null
          successor_employee_id?: string | null
        }
        Update: {
          created_at?: string
          current_employee_id?: string | null
          id?: string
          notes?: string | null
          organization_id?: string
          position_title?: string
          readiness?: string | null
          successor_employee_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "succession_plans_current_employee_id_fkey"
            columns: ["current_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "succession_plans_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "succession_plans_successor_employee_id_fkey"
            columns: ["successor_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      system_log: {
        Row: {
          channel: string
          context: Json
          created_at: string
          duration_ms: number | null
          id: string
          level: string
          message: string
          organization_id: string | null
          status_code: number | null
        }
        Insert: {
          channel: string
          context?: Json
          created_at?: string
          duration_ms?: number | null
          id?: string
          level?: string
          message: string
          organization_id?: string | null
          status_code?: number | null
        }
        Update: {
          channel?: string
          context?: Json
          created_at?: string
          duration_ms?: number | null
          id?: string
          level?: string
          message?: string
          organization_id?: string | null
          status_code?: number | null
        }
        Relationships: []
      }
      time_logs: {
        Row: {
          created_at: string
          employee_id: string
          id: string
          latitude: number | null
          longitude: number | null
          organization_id: string
          source: string | null
          timestamp: string
          type: Database["public"]["Enums"]["punch_type"]
        }
        Insert: {
          created_at?: string
          employee_id: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          organization_id: string
          source?: string | null
          timestamp?: string
          type: Database["public"]["Enums"]["punch_type"]
        }
        Update: {
          created_at?: string
          employee_id?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          organization_id?: string
          source?: string | null
          timestamp?: string
          type?: Database["public"]["Enums"]["punch_type"]
        }
        Relationships: [
          {
            foreignKeyName: "time_logs_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_events: {
        Row: {
          created_at: string
          id: string
          kind: string
          metadata: Json
          module: string | null
          organization_id: string | null
          path: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          metadata?: Json
          module?: string | null
          organization_id?: string | null
          path?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          metadata?: Json
          module?: string | null
          organization_id?: string | null
          path?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_events: {
        Row: {
          event_id: string
          processed_at: string
        }
        Insert: {
          event_id: string
          processed_at?: string
        }
        Update: {
          event_id?: string
          processed_at?: string
        }
        Relationships: []
      }
      work_zones: {
        Row: {
          created_at: string
          id: string
          latitude: number | null
          longitude: number | null
          name: string
          organization_id: string
          polygon: Json | null
          radius_meters: number
          shape: string
        }
        Insert: {
          created_at?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          name: string
          organization_id: string
          polygon?: Json | null
          radius_meters?: number
          shape?: string
        }
        Update: {
          created_at?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          name?: string
          organization_id?: string
          polygon?: Json | null
          radius_meters?: number
          shape?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_zones_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _leave_balance_adjust: {
        Args: { p_delta: number; p_employee: string }
        Returns: undefined
      }
      accrue_monthly_leave: { Args: never; Returns: undefined }
      admin_assign_employee_badge: {
        Args: {
          p_active: boolean
          p_actor: string
          p_employee: string
          p_uid: string
        }
        Returns: {
          out_id: string
          out_nfc_badge_active: boolean
          out_nfc_badge_assigned_at: string
          out_nfc_badge_uid: string
        }[]
      }
      admin_revoke_employee_badge: {
        Args: { p_actor: string; p_employee: string }
        Returns: {
          out_id: string
          out_nfc_badge_active: boolean
          out_nfc_badge_assigned_at: string
          out_nfc_badge_uid: string
        }[]
      }
      compute_working_days: {
        Args: { p_end: string; p_org: string; p_start: string }
        Returns: number
      }
      get_employee_leave_balance: {
        Args: { p_actor?: string; p_employee: string }
        Returns: number
      }
      get_employee_sensitive: {
        Args: { p_employee: string }
        Returns: {
          base_salary: number
          profile_details: Json
        }[]
      }
      get_public_organization: {
        Args: { p_slug: string }
        Returns: {
          id: string
          logo_url: string
          name: string
          slug: string
        }[]
      }
      get_social_account_token: {
        Args: { _account_id: string }
        Returns: {
          access_token: string
          refresh_token: string
        }[]
      }
      list_public_organization_slugs: {
        Args: never
        Returns: {
          slug: string
        }[]
      }
      record_punch: {
        Args: {
          p_dedupe_seconds?: number
          p_employee: string
          p_lat: number
          p_lng: number
          p_org: string
          p_source: string
        }
        Returns: {
          deduped: boolean
          ts: string
          type: Database["public"]["Enums"]["punch_type"]
        }[]
      }
      seed_fixed_holidays_for_org: {
        Args: { p_org: string; p_year?: number }
        Returns: undefined
      }
      seed_movable_holidays_for_org: {
        Args: { p_org: string; p_year?: number }
        Returns: undefined
      }
      set_leave_request_status:
        | {
            Args: { p_actor?: string; p_request: string; p_status: string }
            Returns: {
              balance_applied: boolean
              created_at: string
              decided_at: string | null
              decided_by: string | null
              decision_comment: string | null
              employee_id: string
              end_date: string
              id: string
              organization_id: string
              reason: string | null
              requested_days: number
              start_date: string
              status: Database["public"]["Enums"]["leave_status"]
              type: Database["public"]["Enums"]["leave_type"]
              updated_at: string
            }
            SetofOptions: {
              from: "*"
              to: "leave_requests"
              isOneToOne: true
              isSetofReturn: false
            }
          }
        | {
            Args: {
              p_actor?: string
              p_comment?: string
              p_request: string
              p_status: string
            }
            Returns: {
              balance_applied: boolean
              created_at: string
              decided_at: string | null
              decided_by: string | null
              decision_comment: string | null
              employee_id: string
              end_date: string
              id: string
              organization_id: string
              reason: string | null
              requested_days: number
              start_date: string
              status: Database["public"]["Enums"]["leave_status"]
              type: Database["public"]["Enums"]["leave_type"]
              updated_at: string
            }
            SetofOptions: {
              from: "*"
              to: "leave_requests"
              isOneToOne: true
              isSetofReturn: false
            }
          }
      update_employee_profile_details: {
        Args: { p_details: Json; p_employee: string }
        Returns: undefined
      }
      verify_cron_token: {
        Args: { p_name: string; p_token: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "owner"
        | "hr_admin"
        | "manager"
        | "employee"
        | "recruiter"
        | "security_agent"
      candidate_activity_type:
        | "created"
        | "stage_changed"
        | "scored"
        | "note_added"
        | "note_deleted"
      candidate_stage:
        | "new"
        | "screening"
        | "interview"
        | "offer"
        | "hired"
        | "rejected"
      contract_status: "draft" | "active" | "terminated"
      contract_type:
        | "cdi"
        | "cdd"
        | "stage"
        | "freelance"
        | "apprenticeship"
        | "Journalier"
      employee_status: "active" | "on_leave" | "terminated"
      feedback_kind: "kudos" | "suggestion" | "concern"
      goal_activity_status: "planned" | "in_progress" | "done"
      goal_category: "business" | "development" | "behavioral"
      goal_status:
        | "active"
        | "achieved"
        | "cancelled"
        | "not_started"
        | "in_progress"
        | "late"
      job_status: "draft" | "published" | "closed"
      leave_status: "pending" | "approved" | "rejected" | "cancelled"
      leave_type: "annuel" | "maladie" | "maternite" | "sans_solde"
      okr_review_status: "draft" | "pending" | "validated" | "needs_revision"
      okr_status: "draft" | "active" | "completed" | "archived"
      perf_cycle_frequency: "annual" | "semestrial" | "quarterly" | "custom"
      perf_cycle_status: "draft" | "open" | "closed"
      perf_plan_status: "draft" | "active" | "closed"
      perf_review_status:
        | "not_started"
        | "in_progress"
        | "submitted"
        | "sent_back"
        | "validated"
        | "signed"
      performance_model: "classic" | "sap"
      plan_type: "trial" | "starter" | "pro" | "enterprise"
      punch_type: "ARRIVEE" | "DEPART"
      review_status: "draft" | "self_done" | "manager_done" | "finalized"
      social_account_status: "active" | "expired" | "revoked"
      social_post_status: "pending" | "published" | "failed"
      social_provider: "facebook" | "linkedin" | "twitter"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: [
        "owner",
        "hr_admin",
        "manager",
        "employee",
        "recruiter",
        "security_agent",
      ],
      candidate_activity_type: [
        "created",
        "stage_changed",
        "scored",
        "note_added",
        "note_deleted",
      ],
      candidate_stage: [
        "new",
        "screening",
        "interview",
        "offer",
        "hired",
        "rejected",
      ],
      contract_status: ["draft", "active", "terminated"],
      contract_type: [
        "cdi",
        "cdd",
        "stage",
        "freelance",
        "apprenticeship",
        "Journalier",
      ],
      employee_status: ["active", "on_leave", "terminated"],
      feedback_kind: ["kudos", "suggestion", "concern"],
      goal_activity_status: ["planned", "in_progress", "done"],
      goal_category: ["business", "development", "behavioral"],
      goal_status: [
        "active",
        "achieved",
        "cancelled",
        "not_started",
        "in_progress",
        "late",
      ],
      job_status: ["draft", "published", "closed"],
      leave_status: ["pending", "approved", "rejected", "cancelled"],
      leave_type: ["annuel", "maladie", "maternite", "sans_solde"],
      okr_review_status: ["draft", "pending", "validated", "needs_revision"],
      okr_status: ["draft", "active", "completed", "archived"],
      perf_cycle_frequency: ["annual", "semestrial", "quarterly", "custom"],
      perf_cycle_status: ["draft", "open", "closed"],
      perf_plan_status: ["draft", "active", "closed"],
      perf_review_status: [
        "not_started",
        "in_progress",
        "submitted",
        "sent_back",
        "validated",
        "signed",
      ],
      performance_model: ["classic", "sap"],
      plan_type: ["trial", "starter", "pro", "enterprise"],
      punch_type: ["ARRIVEE", "DEPART"],
      review_status: ["draft", "self_done", "manager_done", "finalized"],
      social_account_status: ["active", "expired", "revoked"],
      social_post_status: ["pending", "published", "failed"],
      social_provider: ["facebook", "linkedin", "twitter"],
    },
  },
} as const
