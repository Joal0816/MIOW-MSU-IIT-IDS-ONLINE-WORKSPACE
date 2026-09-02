// Database row types — mirror the Postgres `profiles` schema (see migrations).
// The pg QueryBuilder returns plain objects; these interfaces give the server
// domain modules a typed surface instead of `any`.

export type ProfileRole = "student" | "teacher" | "admin";

export interface ProfileRow {
  id: string;
  student_id: string | null;
  email: string | null;
  pin: string | null;
  full_name: string;
  role: ProfileRole;
  rfid_uid: string | null;
  avatar_url: string | null;
  grade_level: number | null;
  section: string | null;
  created_at: string;
  deleted_at: string | null;
  pin_hash: string | null;
  username: string | null;
  password_hash: string | null;
  failed_login_attempts: number;
  locked_until: string | null;
  employee_id: string | null;
  prefix: string | null;
  department: string | null;
}

export interface CourseRow {
  id: string;
  title: string;
  code: string;
  grade_level: number;
  teacher_id: string | null;
  color: string;
  education_level: string | null;
  college_year: number | null;
  strand: string | null;
  program: string | null;
  days_of_week: string[] | null;
  start_time: string | null;
  end_time: string | null;
  late_threshold_minutes: number | null;
  created_at: string;
}

/** Error with an attached HTTP status (thrown by rate-limited paths). */
export interface HttpError extends Error {
  status?: number;
}
