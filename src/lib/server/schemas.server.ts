/* eslint-disable @typescript-eslint/no-explicit-any */
// Zod validation schemas for all server functions.
import { z } from "zod";

const uuid = z.string().uuid();
const nullableScore = z.number().min(0).max(100).nullable();
const dayCode = z.enum(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]);
const timeStr = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/);
const scheduleFields = {
  days_of_week: z.array(dayCode).max(7).nullable().optional(),
  start_time: timeStr.nullable().optional(),
  end_time: timeStr.nullable().optional(),
  late_threshold_minutes: z.number().int().min(0).max(60).optional(),
};

const token = { token: z.string().min(1).max(4096) };

const avatarUrl = z
  .string()
  .max(2048)
  .regex(/^(https:\/\/|\/api\/public\/avatar\?p=)/, "invalid avatar_url");

const attachmentMeta = z.object({
  name: z.string().min(1).max(200),
  url: z.string().max(2048),
  size: z.number().int().min(0).max(20_000_000),
  type: z.string().max(200),
  path: z.string().min(1).max(400),
});

export const schemas = {
  rfid: z.object({ uid: z.string().min(1).max(64) }),
  pinLogin: z.object({ login: z.string().min(1).max(320), secret: z.string().min(1).max(200) }),
  avatarUpload: z.object({
    data: z.string().min(1).max(3_000_000),
    content_type: z.enum(["image/png", "image/jpeg", "image/webp", "image/gif"]),
    ...token,
  }),
  session: z.object(token),
  id: z.object({ id: uuid, ...token }),
  studentScoped: z.object({ studentId: uuid, ...token }),
  courseScoped: z.object({ courseId: uuid, ...token }),
  courseQuarter: z.object({ courseId: uuid, quarter: z.number().int().min(1).max(4), ...token }),
  limit: z.object({ limit: z.number().int().min(1).max(500), ...token }),
  roleUpdate: z.object({ id: uuid, role: z.enum(["student", "teacher", "admin"]), ...token }),
  enrollment: z.object({ student_id: uuid, course_id: uuid, ...token }),
  attendance: z.object({
    student_id: uuid,
    scan_type: z.enum(["in", "out"]),
    status: z.enum(["on-time", "late", "excused"]),
    ...token,
  }),
  attendancePatch: z.object({
    id: uuid,
    patch: z
      .object({
        status: z.enum(["on-time", "late", "excused"]),
        scan_type: z.enum(["in", "out"]),
      })
      .partial(),
    ...token,
  }),
  profileInput: z.object({
    full_name: z.string().min(1).max(200),
    student_id: z.string().max(50).nullable().optional(),
    email: z.string().max(320).nullable().optional(),
    role: z.enum(["student", "teacher", "admin"]).optional(),
    grade_level: z.number().int().min(7).max(16).nullable().optional(),
    section: z.string().max(50).nullable().optional(),
    employee_id: z.string().max(50).nullable().optional(),
    prefix: z.string().max(20).nullable().optional(),
    department: z.string().max(100).nullable().optional(),
    pin: z
      .string()
      .regex(/^\d{4,8}$/)
      .nullable()
      .optional(),
    rfid_uid: z
      .string()
      .regex(/^\d{6,20}$/)
      .nullable()
      .optional(),
    avatar_url: avatarUrl.nullable().optional(),
    ...token,
  }),
  teacherInput: z.object({
    full_name: z.string().min(1).max(200),
    prefix: z.string().max(20).nullable().optional(),
    email: z.string().min(3).max(320),
    employee_id: z.string().min(1).max(50),
    department: z.string().min(1).max(100),
    pin: z.string().regex(/^\d{4,6}$/),
    rfid_uid: z
      .string()
      .regex(/^\d{6,20}$/)
      .nullable()
      .optional(),
    ...token,
  }),
  biometrics: z.object({
    id: uuid,
    face_embedding: z.string().max(20000).nullable().optional(),
    rfid_uid: z
      .string()
      .regex(/^\d{6,20}$/)
      .nullable()
      .optional(),
    ...token,
  }),
  profilePatch: z.object({
    id: uuid,
    patch: z
      .object({
        full_name: z.string().min(1).max(200),
        student_id: z.string().max(50).nullable(),
        email: z.string().max(320).nullable(),
        grade_level: z.number().int().min(7).max(16).nullable(),
        section: z.string().max(50).nullable(),
        employee_id: z.string().max(50).nullable(),
        prefix: z.string().max(20).nullable(),
        department: z.string().max(100).nullable(),
        pin: z
          .string()
          .regex(/^\d{4,8}$/)
          .nullable(),
        rfid_uid: z
          .string()
          .regex(/^\d{6,20}$/)
          .nullable(),
        avatar_url: avatarUrl.nullable(),
      })
      .partial(),
    ...token,
  }),
  teacherSettings: z.object({
    patch: z
      .object({
        full_name: z.string().min(1).max(200),
        email: z.string().max(320).nullable(),
        avatar_url: avatarUrl.nullable(),
        pin: z
          .string()
          .regex(/^\d{4,6}$/)
          .nullable(),
        rfid_uid: z
          .string()
          .regex(/^\d{6,20}$/)
          .nullable(),
        face_embedding: z.string().max(20000).nullable(),
      })
      .partial(),
    ...token,
  }),
  announcementInput: z.object({
    title: z.string().min(1).max(300),
    content: z.string().min(1).max(5000),
    category: z.enum(["urgent", "event", "academic"]),
    target_audience: z.string().max(50).optional(),
    author_id: uuid.nullable().optional(),
    ...token,
  }),
  courseInput: z.object({
    title: z.string().min(1).max(200),
    code: z.string().min(1).max(20),
    grade_level: z.number().int().min(7).max(16),
    education_level: z.enum(["jhs", "shs", "college"]).optional(),
    college_year: z.number().int().min(1).max(4).nullable().optional(),
    strand: z.string().max(50).nullable().optional(),
    program: z.string().max(80).nullable().optional(),
    teacher_id: uuid.nullable().optional(),
    color: z.string().max(20).optional(),
    ...scheduleFields,
    ...token,
  }),
  coursePatch: z.object({
    id: uuid,
    patch: z
      .object({
        title: z.string().min(1).max(200),
        code: z.string().min(1).max(20),
        grade_level: z.number().int().min(7).max(16),
        education_level: z.enum(["jhs", "shs", "college"]).nullable().optional(),
        college_year: z.number().int().min(1).max(4).nullable().optional(),
        strand: z.string().max(50).nullable().optional(),
        program: z.string().max(80).nullable().optional(),
        teacher_id: uuid.nullable(),
        color: z.string().max(20),
        days_of_week: z.array(dayCode).max(7).nullable(),
        start_time: timeStr.nullable(),
        end_time: timeStr.nullable(),
        late_threshold_minutes: z.number().int().min(0).max(60),
      })
      .partial(),
    ...token,
  }),
  tap: z.object({
    uid: z.string().min(1).max(64),
    at: z.string().max(40).optional(),
    ...token,
  }),
  announcementPatch: z.object({
    id: uuid,
    patch: z
      .object({
        title: z.string().min(1).max(300),
        content: z.string().min(1).max(5000),
        category: z.enum(["urgent", "event", "academic"]),
        target_audience: z.string().max(50),
        pinned: z.boolean(),
      })
      .partial(),
    ...token,
  }),
  assignmentInput: z.object({
    course_id: uuid,
    title: z.string().min(1).max(300),
    description: z.string().max(5000).nullable().optional(),
    due_date: z.string().max(40).nullable().optional(),
    total_points: z.number().int().min(1).max(1000).optional(),
    component_type: z.enum(["written_work", "performance_task", "quarterly_exam"]).optional(),
    attachments: z.array(attachmentMeta).max(10).optional(),
    ...token,
  }),
  submissionInput: z.object({
    assignment_id: uuid,
    student_id: uuid,
    content: z.string().max(20000).nullable().optional(),
    file_url: z.string().max(2048).nullable().optional(),
    status: z.enum(["pending", "submitted", "graded"]).optional(),
    submitted_at: z.string().max(40).nullable().optional(),
    ...token,
  }),
  gradeInput: z.object({
    student_id: uuid,
    course_id: uuid,
    quarter: z.number().int().min(1).max(4),
    written_work_score: nullableScore,
    performance_task_score: nullableScore,
    exam_score: nullableScore,
    transmuted_final_grade: z.number().min(0).max(100).nullable().optional(),
    ...token,
  }),
  quizBundle: z.object({
    quiz: z.object({
      course_id: uuid,
      title: z.string().min(1).max(300),
      duration_minutes: z.number().int().min(1).max(180).optional(),
      allow_retake: z.boolean().optional(),
      max_attempts: z.number().int().min(0).max(50).optional(),
      retake_score_policy: z.enum(["highest_score", "latest_attempt", "average_score"]).optional(),
      attachments: z.array(attachmentMeta).max(10).optional(),
    }),
    questions: z
      .array(
        z.object({
          question: z.string().min(1).max(2000),
          options: z.array(z.string().min(1).max(500)).max(12),
          correct_answer: z.string().min(1).max(1000),
        }),
      )
      .min(1)
      .max(100),
    ...token,
  }),
  quizGrade: z.object({
    quiz_id: uuid,
    answers: z.record(z.string().uuid(), z.string().max(500)),
    ...token,
  }),
  quizScoped: z.object({ quiz_id: uuid, ...token }),
  quizPolicy: z.object({
    id: uuid,
    allow_retake: z.boolean(),
    max_attempts: z.number().int().min(0).max(50),
    retake_score_policy: z.enum(["highest_score", "latest_attempt", "average_score"]),
    ...token,
  }),
  retakeGrant: z.object({ quiz_id: uuid, student_id: uuid, ...token }),
  materialUpload: z.object({
    course_id: uuid,
    name: z.string().min(1).max(200),
    data: z.string().min(1).max(21_000_000),
    content_type: z.string().min(3).max(200),
    ...token,
  }),
  materialAttach: z.object({
    target: z.enum(["quiz", "assignment"]),
    id: uuid,
    attachment: attachmentMeta,
    ...token,
  }),
  materialRemove: z.object({
    target: z.enum(["quiz", "assignment"]),
    id: uuid,
    path: z.string().min(1).max(400),
    ...token,
  }),
  quizUpdate: z.object({
    id: uuid,
    patch: z
      .object({
        title: z.string().min(1).max(300),
        duration_minutes: z.number().int().min(1).max(180),
        allow_retake: z.boolean(),
        max_attempts: z.number().int().min(0).max(50),
        retake_score_policy: z.enum(["highest_score", "latest_attempt", "average_score"]),
        attachments: z.array(attachmentMeta).max(10),
        score_released: z.boolean(),
        answer_key_released: z.boolean(),
      })
      .partial(),
    questions: z
      .array(
        z.object({
          question: z.string().min(1).max(2000),
          options: z.array(z.string().min(1).max(500)).max(12),
          correct_answer: z.string().min(1).max(1000),
        }),
      )
      .max(100)
      .optional(),
    ...token,
  }),
  assignmentPatch: z.object({
    id: uuid,
    patch: z
      .object({
        title: z.string().min(1).max(300),
        description: z.string().max(5000).nullable(),
        due_date: z.string().max(40).nullable(),
        total_points: z.number().int().min(1).max(1000),
        component_type: z.enum(["written_work", "performance_task", "quarterly_exam"]),
        attachments: z.array(attachmentMeta).max(10),
        score_released: z.boolean(),
      })
      .partial(),
    ...token,
  }),
  contentDelete: z.object({ id: uuid, mode: z.enum(["soft", "hard"]), ...token }),
  countable: z.object({
    table: z.enum([
      "profiles",
      "announcements",
      "courses",
      "enrollments",
      "assignments",
      "submissions",
      "quizzes",
      "quiz_questions",
      "grades",
      "attendance_logs",
    ]),
    ...token,
  }),
};
