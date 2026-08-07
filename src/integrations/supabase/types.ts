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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      activities: {
        Row: {
          action: string
          actor_id: string
          created_at: string
          department_id: string | null
          description: string
          entity_id: string | null
          entity_type: string
          id: string
        }
        Insert: {
          action: string
          actor_id: string
          created_at?: string
          department_id?: string | null
          description: string
          entity_id?: string | null
          entity_type: string
          id?: string
        }
        Update: {
          action?: string
          actor_id?: string
          created_at?: string
          department_id?: string | null
          description?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activities_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      attachments: {
        Row: {
          created_at: string
          customer_job_id: string | null
          department_id: string | null
          file_name: string
          file_path: string
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          kind: string
          owner_id: string
          project_id: string | null
          report_id: string | null
          task_id: string | null
        }
        Insert: {
          created_at?: string
          customer_job_id?: string | null
          department_id?: string | null
          file_name: string
          file_path: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          kind?: string
          owner_id: string
          project_id?: string | null
          report_id?: string | null
          task_id?: string | null
        }
        Update: {
          created_at?: string
          customer_job_id?: string | null
          department_id?: string | null
          file_name?: string
          file_path?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          kind?: string
          owner_id?: string
          project_id?: string | null
          report_id?: string | null
          task_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attachments_customer_job_id_fkey"
            columns: ["customer_job_id"]
            isOneToOne: false
            referencedRelation: "customer_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attachments_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attachments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attachments_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attachments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_job_departments: {
        Row: {
          created_at: string
          department_id: string
          id: string
          job_id: string
          status: string
        }
        Insert: {
          created_at?: string
          department_id: string
          id?: string
          job_id: string
          status?: string
        }
        Update: {
          created_at?: string
          department_id?: string
          id?: string
          job_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_job_departments_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_job_departments_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "customer_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_jobs: {
        Row: {
          company_name: string | null
          contact_info: string | null
          created_at: string
          created_by: string
          customer_name: string
          expected_delivery_date: string | null
          id: string
          notes: string | null
          project_description: string | null
          project_title: string
          requested_services: string | null
          source_file_name: string | null
          status: string
          updated_at: string
        }
        Insert: {
          company_name?: string | null
          contact_info?: string | null
          created_at?: string
          created_by: string
          customer_name: string
          expected_delivery_date?: string | null
          id?: string
          notes?: string | null
          project_description?: string | null
          project_title: string
          requested_services?: string | null
          source_file_name?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          company_name?: string | null
          contact_info?: string | null
          created_at?: string
          created_by?: string
          customer_name?: string
          expected_delivery_date?: string | null
          id?: string
          notes?: string | null
          project_description?: string | null
          project_title?: string
          requested_services?: string | null
          source_file_name?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      departments: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          actor_id: string | null
          audience: string
          body: string | null
          created_at: string
          department_id: string | null
          id: string
          read: boolean
          title: string
          type: string
          user_id: string | null
        }
        Insert: {
          actor_id?: string | null
          audience?: string
          body?: string | null
          created_at?: string
          department_id?: string | null
          id?: string
          read?: boolean
          title: string
          type?: string
          user_id?: string | null
        }
        Update: {
          actor_id?: string | null
          audience?: string
          body?: string | null
          created_at?: string
          department_id?: string | null
          id?: string
          read?: boolean
          title?: string
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          department_id: string | null
          email: string
          full_name: string
          id: string
          job_title: string | null
          last_seen_at: string
          phone: string | null
          status: string
          username: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          department_id?: string | null
          email: string
          full_name: string
          id: string
          job_title?: string | null
          last_seen_at?: string
          phone?: string | null
          status?: string
          username: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          department_id?: string | null
          email?: string
          full_name?: string
          id?: string
          job_title?: string | null
          last_seen_at?: string
          phone?: string | null
          status?: string
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          challenges: string | null
          completed_tasks: string | null
          created_at: string
          current_task: string | null
          delay_reason: string | null
          department_id: string | null
          description: string | null
          developer_notes: string | null
          due_date: string | null
          github_url: string | null
          id: string
          live_url: string | null
          owner_id: string
          priority: string
          progress: number
          project_type: string | null
          start_date: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          challenges?: string | null
          completed_tasks?: string | null
          created_at?: string
          current_task?: string | null
          delay_reason?: string | null
          department_id?: string | null
          description?: string | null
          developer_notes?: string | null
          due_date?: string | null
          github_url?: string | null
          id?: string
          live_url?: string | null
          owner_id: string
          priority?: string
          progress?: number
          project_type?: string | null
          start_date?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          challenges?: string | null
          completed_tasks?: string | null
          created_at?: string
          current_task?: string | null
          delay_reason?: string | null
          department_id?: string | null
          description?: string | null
          developer_notes?: string | null
          due_date?: string | null
          github_url?: string | null
          id?: string
          live_url?: string | null
          owner_id?: string
          priority?: string
          progress?: number
          project_type?: string | null
          start_date?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          achievements: string | null
          author_id: string
          challenges: string | null
          completed_work: string | null
          created_at: string
          department_id: string | null
          id: string
          next_steps: string | null
          report_date: string
          report_type: string
          status: string
          summary: string | null
          title: string
          updated_at: string
        }
        Insert: {
          achievements?: string | null
          author_id: string
          challenges?: string | null
          completed_work?: string | null
          created_at?: string
          department_id?: string | null
          id?: string
          next_steps?: string | null
          report_date?: string
          report_type?: string
          status?: string
          summary?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          achievements?: string | null
          author_id?: string
          challenges?: string | null
          completed_work?: string | null
          created_at?: string
          department_id?: string | null
          id?: string
          next_steps?: string | null
          report_date?: string
          report_type?: string
          status?: string
          summary?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_by: string | null
          completed_at: string | null
          created_at: string
          customer_job_id: string | null
          department_id: string | null
          description: string | null
          due_date: string | null
          expected_delivery_date: string | null
          id: string
          notes: string | null
          owner_id: string
          priority: string
          progress: number
          project_id: string | null
          start_date: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_by?: string | null
          completed_at?: string | null
          created_at?: string
          customer_job_id?: string | null
          department_id?: string | null
          description?: string | null
          due_date?: string | null
          expected_delivery_date?: string | null
          id?: string
          notes?: string | null
          owner_id: string
          priority?: string
          progress?: number
          project_id?: string | null
          start_date?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_by?: string | null
          completed_at?: string | null
          created_at?: string
          customer_job_id?: string | null
          department_id?: string | null
          description?: string | null
          due_date?: string | null
          expected_delivery_date?: string | null
          id?: string
          notes?: string | null
          owner_id?: string
          priority?: string
          progress?: number
          project_id?: string | null
          start_date?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_customer_job_id_fkey"
            columns: ["customer_job_id"]
            isOneToOne: false
            referencedRelation: "customer_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
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
      can_manage_dept: { Args: { _dept: string }; Returns: boolean }
      can_see_job: { Args: { _job_id: string }; Returns: boolean }
      claim_initial_role: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"]
      }
      current_app_role: { Args: never; Returns: string }
      expire_overdue_tasks: { Args: never; Returns: number }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      is_dept_admin: { Args: never; Returns: boolean }
      my_dept: { Args: never; Returns: string }
    }
    Enums: {
      app_role: "super_admin" | "employee" | "admin"
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
      app_role: ["super_admin", "employee", "admin"],
    },
  },
} as const
