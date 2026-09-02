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
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      announcements: {
        Row: {
          author_id: string | null
          category: Database["public"]["Enums"]["announcement_category"]
          content: string
          created_at: string
          id: string
          pinned: boolean
          target_audience: string
          title: string
        }
        Insert: {
          author_id?: string | null
          category?: Database["public"]["Enums"]["announcement_category"]
          content: string
          created_at?: string
          id?: string
          pinned?: boolean
          target_audience?: string
          title: string
        }
        Update: {
          author_id?: string | null
          category?: Database["public"]["Enums"]["announcement_category"]
          content?: string
          created_at?: string
          id?: string
          pinned?: boolean
          target_audience?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      assignments: {
        Row: {
          attachments: Json
          component_type: Database["public"]["Enums"]["component_type"]
          course_id: string
          created_at: string
          deleted_at: string | null
          description: string | null
          due_date: string | null
          id: string
          score_released: boolean
          title: string
          total_points: number
        }
        Insert: {
          attachments?: Json
          component_type?: Database["public"]["Enums"]["component_type"]
          course_id: string
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          score_released?: boolean
          title: string
          total_points?: number
        }
        Update: {
          attachments?: Json
          component_type?: Database["public"]["Enums"]["component_type"]
          course_id?: string
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          score_released?: boolean
          title?: string
          total_points?: number
        }
        Relationships: [
          {
            foreignKeyName: "assignments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_logs: {
        Row: {
          auth_method: string
          confidence_score: number | null
          device_id: string | null
          id: string
          scan_type: Database["public"]["Enums"]["scan_type"]
          status: Database["public"]["Enums"]["attendance_mark"]
          student_id: string
          timestamp: string
        }
        Insert: {
          auth_method?: string
          confidence_score?: number | null
          device_id?: string | null
          id?: string
          scan_type: Database["public"]["Enums"]["scan_type"]
          status?: Database["public"]["Enums"]["attendance_mark"]
          student_id: string
          timestamp?: string
        }
        Update: {
          auth_method?: string
          confidence_score?: number | null
          device_id?: string | null
          id?: string
          scan_type?: Database["public"]["Enums"]["scan_type"]
          status?: Database["public"]["Enums"]["attendance_mark"]
          student_id?: string
          timestamp?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_logs_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          code: string
          color: string
          created_at: string
          days_of_week: string[] | null
          end_time: string | null
          grade_level: number
          id: string
          late_threshold_minutes: number
          start_time: string | null
          teacher_id: string | null
          title: string
        }
        Insert: {
          code: string
          color?: string
          created_at?: string
          days_of_week?: string[] | null
          end_time?: string | null
          grade_level: number
          id?: string
          late_threshold_minutes?: number
          start_time?: string | null
          teacher_id?: string | null
          title: string
        }
        Update: {
          code?: string
          color?: string
          created_at?: string
          days_of_week?: string[] | null
          end_time?: string | null
          grade_level?: number
          id?: string
          late_threshold_minutes?: number
          start_time?: string | null
          teacher_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "courses_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      enrollments: {
        Row: {
          course_id: string
          id: string
          student_id: string
        }
        Insert: {
          course_id: string
          id?: string
          student_id: string
        }
        Update: {
          course_id?: string
          id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      grades: {
        Row: {
          course_id: string
          exam_score: number | null
          id: string
          performance_task_score: number | null
          quarter: number
          student_id: string
          transmuted_final_grade: number | null
          written_work_score: number | null
        }
        Insert: {
          course_id: string
          exam_score?: number | null
          id?: string
          performance_task_score?: number | null
          quarter: number
          student_id: string
          transmuted_final_grade?: number | null
          written_work_score?: number | null
        }
        Update: {
          course_id?: string
          exam_score?: number | null
          id?: string
          performance_task_score?: number | null
          quarter?: number
          student_id?: string
          transmuted_final_grade?: number | null
          written_work_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "grades_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grades_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          biometric_enrolled_at: string | null
          created_at: string
          deleted_at: string | null
          department: string | null
          email: string | null
          employee_id: string | null
          face_embedding: string | null
          failed_login_attempts: number
          full_name: string
          grade_level: number | null
          id: string
          is_face_enrolled: boolean | null
          locked_until: string | null
          password_hash: string | null
          pin: string | null
          pin_hash: string | null
          prefix: string | null
          rfid_uid: string | null
          role: Database["public"]["Enums"]["profile_role"]
          section: string | null
          student_id: string | null
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          biometric_enrolled_at?: string | null
          created_at?: string
          deleted_at?: string | null
          department?: string | null
          email?: string | null
          employee_id?: string | null
          face_embedding?: string | null
          failed_login_attempts?: number
          full_name: string
          grade_level?: number | null
          id?: string
          is_face_enrolled?: boolean | null
          locked_until?: string | null
          password_hash?: string | null
          pin?: string | null
          pin_hash?: string | null
          prefix?: string | null
          rfid_uid?: string | null
          role?: Database["public"]["Enums"]["profile_role"]
          section?: string | null
          student_id?: string | null
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          biometric_enrolled_at?: string | null
          created_at?: string
          deleted_at?: string | null
          department?: string | null
          email?: string | null
          employee_id?: string | null
          face_embedding?: string | null
          failed_login_attempts?: number
          full_name?: string
          grade_level?: number | null
          id?: string
          is_face_enrolled?: boolean | null
          locked_until?: string | null
          password_hash?: string | null
          pin?: string | null
          pin_hash?: string | null
          prefix?: string | null
          rfid_uid?: string | null
          role?: Database["public"]["Enums"]["profile_role"]
          section?: string | null
          student_id?: string | null
          username?: string | null
        }
        Relationships: []
      }
      quiz_attempts: {
        Row: {
          attempt_number: number
          created_at: string
          id: string
          quiz_id: string
          released: boolean
          results: Json
          score: number
          student_id: string
          total: number
        }
        Insert: {
          attempt_number?: number
          created_at?: string
          id?: string
          quiz_id: string
          released?: boolean
          results?: Json
          score?: number
          student_id: string
          total?: number
        }
        Update: {
          attempt_number?: number
          created_at?: string
          id?: string
          quiz_id?: string
          released?: boolean
          results?: Json
          score?: number
          student_id?: string
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "quiz_attempts_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_attempts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_questions: {
        Row: {
          correct_answer: string
          id: string
          options: Json
          position: number
          question: string
          quiz_id: string
        }
        Insert: {
          correct_answer: string
          id?: string
          options?: Json
          position?: number
          question: string
          quiz_id: string
        }
        Update: {
          correct_answer?: string
          id?: string
          options?: Json
          position?: number
          question?: string
          quiz_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_questions_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_retake_grants: {
        Row: {
          created_at: string
          extra_attempts: number
          granted_by: string | null
          id: string
          quiz_id: string
          student_id: string
        }
        Insert: {
          created_at?: string
          extra_attempts?: number
          granted_by?: string | null
          id?: string
          quiz_id: string
          student_id: string
        }
        Update: {
          created_at?: string
          extra_attempts?: number
          granted_by?: string | null
          id?: string
          quiz_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_retake_grants_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_retake_grants_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_retake_grants_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      quizzes: {
        Row: {
          allow_retake: boolean
          answer_key_released: boolean
          attachments: Json
          course_id: string
          created_at: string
          deleted_at: string | null
          duration_minutes: number
          id: string
          max_attempts: number
          retake_score_policy: string
          score_released: boolean
          title: string
        }
        Insert: {
          allow_retake?: boolean
          answer_key_released?: boolean
          attachments?: Json
          course_id: string
          created_at?: string
          deleted_at?: string | null
          duration_minutes?: number
          id?: string
          max_attempts?: number
          retake_score_policy?: string
          score_released?: boolean
          title: string
        }
        Update: {
          allow_retake?: boolean
          answer_key_released?: boolean
          attachments?: Json
          course_id?: string
          created_at?: string
          deleted_at?: string | null
          duration_minutes?: number
          id?: string
          max_attempts?: number
          retake_score_policy?: string
          score_released?: boolean
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "quizzes_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      submissions: {
        Row: {
          assignment_id: string
          content: string | null
          feedback: string | null
          file_url: string | null
          id: string
          score: number | null
          status: Database["public"]["Enums"]["submission_status"]
          student_id: string
          submitted_at: string | null
        }
        Insert: {
          assignment_id: string
          content?: string | null
          feedback?: string | null
          file_url?: string | null
          id?: string
          score?: number | null
          status?: Database["public"]["Enums"]["submission_status"]
          student_id: string
          submitted_at?: string | null
        }
        Update: {
          assignment_id?: string
          content?: string | null
          feedback?: string | null
          file_url?: string | null
          id?: string
          score?: number | null
          status?: Database["public"]["Enums"]["submission_status"]
          student_id?: string
          submitted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "submissions_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      auth_email: { Args: never; Returns: string }
    }
    Enums: {
      announcement_category: "urgent" | "event" | "academic"
      attendance_mark: "on-time" | "late" | "excused"
      component_type: "written_work" | "performance_task" | "quarterly_exam"
      profile_role: "student" | "teacher" | "admin"
      scan_type: "in" | "out"
      submission_status: "pending" | "submitted" | "graded"
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
      announcement_category: ["urgent", "event", "academic"],
      attendance_mark: ["on-time", "late", "excused"],
      component_type: ["written_work", "performance_task", "quarterly_exam"],
      profile_role: ["student", "teacher", "admin"],
      scan_type: ["in", "out"],
      submission_status: ["pending", "submitted", "graded"],
    },
  },
} as const
