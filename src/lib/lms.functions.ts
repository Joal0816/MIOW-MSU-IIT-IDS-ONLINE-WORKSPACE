// Thin RPC wrappers around the server-only LMS data layer.
// Module scope intentionally contains only imports and server-function
// declarations so code splitting never ships runtime helpers to the client.
//
// Access model:
// - Login endpoints (RFID, PIN) are public and ISSUE a signed token. They
//   are the sole entry points — there is no demo/quick-login bypass.
// - listAnnouncements stays public for the kiosk sign-in screen ticker; it
//   exposes only non-sensitive, publicly displayed data.
// - Everything else verifies the caller's signed session token server-side:
//   admin-only for console settings/role management, teacher-only for
//   gradebook editing, staff-only for other management writes, self-or-staff
//   for student-scoped records, any valid session for catalog reads.
import { createServerFn } from "@tanstack/react-start";
import * as server from "./server";

/* ---------- Profiles & kiosk auth (public — they issue tokens) ---------- */

export const getProfileByRfidFn = createServerFn({ method: "POST" })
  .validator((data) => server.schemas.rfid.parse(data))
  .handler(async ({ data }) => server.findByRfid(data.uid));

// Unified sign-in for ALL roles: one identifier (student ID, email, or
// username) + secret (PIN or password). Public because it ISSUES the token;
// server-side lockout (5 attempts / 15 min) protects every account type.
export const pinLoginFn = createServerFn({ method: "POST" })
  .validator((data) => server.schemas.pinLogin.parse(data))
  .handler(async ({ data }) => server.verifyPinLogin(data.login, data.secret));

/* ---------- Profile management (staff only) ---------- */

export const createProfileFn = createServerFn({ method: "POST" })
  .validator((data) => server.schemas.profileInput.parse(data))
  .handler(async ({ data }) => {
    await server.requireStaff(data.token);
    return server.createProfile(data);
  });

export const updateProfileFn = createServerFn({ method: "POST" })
  .validator((data) => server.schemas.profilePatch.parse(data))
  .handler(async ({ data }) => {
    // Authorization lives server-side: self-service for the owner, roster
    // maintenance for staff on student records, and admin-only for staff
    // accounts or any credential (PIN/RFID/email) reset on someone else.
    const patch = await server.authorizeProfileUpdate(data.token, data.id, data.patch);
    return server.updateProfile(data.id, patch);
  });

// User removal is ADMIN-only (teachers cannot remove accounts) and runs
// as a soft delete with self-deletion and last-admin safeguards.
export const deleteProfileFn = createServerFn({ method: "POST" })
  .validator((data) => server.schemas.id.parse(data))
  .handler(async ({ data }) => {
    const admin = await server.requireAdmin(data.token);
    return server.deleteUser(admin.id, data.id);
  });

// Teacher-only self-service settings mutation. requireTeacher rejects
// students AND admins; the target row is always the caller's own profile.
export const updateTeacherSettingsFn = createServerFn({ method: "POST" })
  .validator((data) => server.schemas.teacherSettings.parse(data))
  .handler(async ({ data }) => {
    const teacher = await server.requireTeacher(data.token);
    return server.updateTeacherSettings(teacher.id, data.patch);
  });

// Avatar upload: any valid session may upload their OWN photo — the server
// resolves the caller from the token and always writes to their profile.
export const uploadAvatarFn = createServerFn({ method: "POST" })
  .validator((data) => server.schemas.avatarUpload.parse(data))
  .handler(async ({ data }) => server.uploadAvatar(data.token, data.data, data.content_type));

export const listStudentsFn = createServerFn({ method: "POST" })
  .validator((data) => server.schemas.session.parse(data))
  .handler(async ({ data }) => {
    await server.requireStaff(data.token);
    return server.listStudents();
  });

export const listStaffFn = createServerFn({ method: "POST" })
  .validator((data) => server.schemas.session.parse(data))
  .handler(async ({ data }) => {
    await server.requireStaff(data.token);
    return server.listStaff();
  });

// Teaching roster for course-lead pickers — admins are NOT included.
export const listTeachersFn = createServerFn({ method: "POST" })
  .validator((data) => server.schemas.session.parse(data))
  .handler(async ({ data }) => {
    await server.requireStaff(data.token);
    return server.listTeachers();
  });

// Faculty directory with assigned-course relations — ADMIN-only console read.
export const listTeacherDirectoryFn = createServerFn({ method: "POST" })
  .validator((data) => server.schemas.session.parse(data))
  .handler(async ({ data }) => {
    await server.requireAdmin(data.token);
    return server.listTeacherDirectory();
  });

// Faculty account creation — ADMIN-only; role is forced to 'teacher' and the
// initial PIN is hashed server-side before persistence.
export const createTeacherFn = createServerFn({ method: "POST" })
  .validator((data) => server.schemas.teacherInput.parse(data))
  .handler(async ({ data }) => {
    await server.requireAdmin(data.token);
    return server.createTeacher(data);
  });

// Biometric / RFID enrolment. Admins may enroll anyone; everyone else may
// only enroll their OWN record (target id is checked against the token).
export const enrollBiometricsFn = createServerFn({ method: "POST" })
  .validator((data) => server.schemas.biometrics.parse(data))
  .handler(async ({ data }) => {
    const caller = await server.requireSession(data.token);
    if (caller.role !== "admin" && caller.id !== data.id) throw new Error("Forbidden");
    const fields: { rfid_uid?: string | null } = {};
    if ("rfid_uid" in data) fields.rfid_uid = data.rfid_uid ?? null;
    return server.enrollBiometrics(data.id, fields);
  });

// Role administration is ADMIN-only (teachers cannot reassign roles).
export const listAllUsersFn = createServerFn({ method: "POST" })
  .validator((data) => server.schemas.session.parse(data))
  .handler(async ({ data }) => {
    await server.requireAdmin(data.token);
    return server.listAllUsers();
  });

export const updateUserRoleFn = createServerFn({ method: "POST" })
  .validator((data) => server.schemas.roleUpdate.parse(data))
  .handler(async ({ data }) => {
    const admin = await server.requireAdmin(data.token);
    return server.updateUserRole(admin.id, data.id, data.role);
  });

// Claims refresh: returns the caller's LIVE profile (role included) so the
// client session store can be updated after an admin changes their role —
// permissions re-evaluate without requiring a fresh sign-in.
export const refreshSessionFn = createServerFn({ method: "POST" })
  .validator((data) => server.schemas.session.parse(data))
  .handler(async ({ data }) => server.requireSession(data.token));

/* ---------- Announcements ---------- */

// Public: the kiosk sign-in screen shows the announcements ticker.
export const listAnnouncementsFn = createServerFn({ method: "GET" }).handler(async () =>
  server.listAnnouncements(),
);

export const createAnnouncementFn = createServerFn({ method: "POST" })
  .validator((data) => server.schemas.announcementInput.parse(data))
  .handler(async ({ data }) => {
    await server.requireStaff(data.token);
    return server.createAnnouncement(data);
  });

export const updateAnnouncementFn = createServerFn({ method: "POST" })
  .validator((data) => server.schemas.announcementPatch.parse(data))
  .handler(async ({ data }) => {
    await server.requireStaff(data.token);
    return server.updateAnnouncement(data.id, data.patch);
  });

export const deleteAnnouncementFn = createServerFn({ method: "POST" })
  .validator((data) => server.schemas.id.parse(data))
  .handler(async ({ data }) => {
    await server.requireStaff(data.token);
    return server.deleteAnnouncement(data.id);
  });

export const uploadAnnouncementMaterialFn = createServerFn({ method: "POST" })
  .validator((data) => server.schemas.announcementMaterialUpload.parse(data))
  .handler(async ({ data }) =>
    server.uploadAnnouncementMaterial(
      data.token,
      data.announcement_id,
      data.name,
      data.data,
      data.content_type,
    ),
  );

export const removeAnnouncementMaterialFn = createServerFn({ method: "POST" })
  .validator((data) => server.schemas.announcementMaterialRemove.parse(data))
  .handler(async ({ data }) => server.removeAnnouncementAttachment(data.token, data.attachment_id));

export const listAnnouncementAttachmentsFn = createServerFn({ method: "POST" })
  .validator((data) => server.schemas.id.parse(data))
  .handler(async ({ data }) => {
    await server.requireSession(data.token);
    return server.listAnnouncementAttachments(data.id);
  });

/* ---------- Courses, assignments, enrollments ---------- */

export const listCoursesFn = createServerFn({ method: "POST" })
  .validator((data) => server.schemas.session.parse(data))
  .handler(async ({ data }) => {
    await server.requireSession(data.token);
    return server.listCourses();
  });

// Course lifecycle (create / reassign lead / delete) is ADMIN-ONLY: teachers
// may only edit metadata on courses they already lead.
export const createCourseFn = createServerFn({ method: "POST" })
  .validator((data) => server.schemas.courseInput.parse(data))
  .handler(async ({ data }) => {
    await server.requireAdmin(data.token);
    return server.createCourse(data);
  });

export const updateCourseFn = createServerFn({ method: "POST" })
  .validator((data) => server.schemas.coursePatch.parse(data))
  .handler(async ({ data }) => {
    const patch = await server.authorizeCourseUpdate(data.token, data.id, data.patch);
    return server.updateCourse(data.id, patch);
  });

export const deleteCourseFn = createServerFn({ method: "POST" })
  .validator((data) => server.schemas.id.parse(data))
  .handler(async ({ data }) => {
    await server.requireAdmin(data.token);
    return server.deleteCourse(data.id);
  });

export const listAssignmentsFn = createServerFn({ method: "POST" })
  .validator((data) => server.schemas.session.parse(data))
  .handler(async ({ data }) => {
    await server.requireSession(data.token);
    return server.listAssignments();
  });

export const createAssignmentFn = createServerFn({ method: "POST" })
  .validator((data) => server.schemas.assignmentInput.parse(data))
  .handler(async ({ data }) => {
    // Teachers may only post into courses they lead; admins are universal.
    await server.requireCourseOwnerOrAdmin(data.token, data.course_id);
    return server.createAssignment(data);
  });

export const enrollmentsForCourseFn = createServerFn({ method: "POST" })
  .validator((data) => server.schemas.courseScoped.parse(data))
  .handler(async ({ data }) => {
    await server.requireStaff(data.token);
    return server.enrollmentsForCourse(data.courseId);
  });

export const enrollmentsForStudentFn = createServerFn({ method: "POST" })
  .validator((data) => server.schemas.studentScoped.parse(data))
  .handler(async ({ data }) => {
    await server.requireSelfOrStaff(data.token, data.studentId);
    return server.enrollmentsForStudent(data.studentId);
  });

export const enrollStudentFn = createServerFn({ method: "POST" })
  .validator((data) => server.schemas.enrollment.parse(data))
  .handler(async ({ data }) => {
    await server.requireStaff(data.token);
    return server.enrollStudent(data.student_id, data.course_id);
  });

/* ---------- Submissions ---------- */

export const listSubmissionsForStudentFn = createServerFn({ method: "POST" })
  .validator((data) => server.schemas.studentScoped.parse(data))
  .handler(async ({ data }) => {
    await server.requireSelfOrStaff(data.token, data.studentId);
    return server.listSubmissionsForStudent(data.studentId);
  });

export const submitAssignmentFn = createServerFn({ method: "POST" })
  .validator((data) => server.schemas.submissionInput.parse(data))
  .handler(async ({ data }) => {
    await server.requireSelfOrStaff(data.token, data.student_id);
    return server.submitAssignment(data);
  });

/* ---------- Quizzes ---------- */

export const listQuizzesFn = createServerFn({ method: "POST" })
  .validator((data) => server.schemas.session.parse(data))
  .handler(async ({ data }) => {
    await server.requireSession(data.token);
    return server.listQuizzes();
  });

export const getQuizFn = createServerFn({ method: "POST" })
  .validator((data) => server.schemas.id.parse(data))
  .handler(async ({ data }) => {
    await server.requireSession(data.token);
    return server.getQuizPublic(data.id);
  });

// Submit a worksheet attempt. The server enforces the worksheet's retake
// policy BEFORE recording: submissions past the attempt ceiling are rejected
// with a typed { ok: false, reason } payload and nothing is written.
export const submitQuizAttemptFn = createServerFn({ method: "POST" })
  .validator((data) => server.schemas.quizGrade.parse(data))
  .handler(async ({ data }) =>
    server.submitQuizAttempt(data.quiz_id, data.answers, data.token, data.question_ids),
  );

// Attempt summaries for every worksheet, for the signed-in student.
export const myQuizSummariesFn = createServerFn({ method: "POST" })
  .validator((data) => server.schemas.session.parse(data))
  .handler(async ({ data }) => server.listMyQuizSummaries(data.token));

export const quizAttemptInfoFn = createServerFn({ method: "POST" })
  .validator((data) => server.schemas.quizScoped.parse(data))
  .handler(async ({ data }) => server.quizAttemptInfo(data.quiz_id, data.token));

/* ----- Retake policy management (staff; teachers limited to own courses) ----- */

export const updateQuizRetakePolicyFn = createServerFn({ method: "POST" })
  .validator((data) => server.schemas.quizPolicy.parse(data))
  .handler(async ({ data }) =>
    server.updateQuizRetakePolicy(
      data.id,
      {
        allow_retake: data.allow_retake,
        max_attempts: data.max_attempts,
        retake_score_policy: data.retake_score_policy,
      },
      data.token,
    ),
  );

export const listQuizAttemptsFn = createServerFn({ method: "POST" })
  .validator((data) => server.schemas.quizScoped.parse(data))
  .handler(async ({ data }) => server.listQuizAttemptsForQuiz(data.quiz_id, data.token));

export const grantQuizRetakeFn = createServerFn({ method: "POST" })
  .validator((data) => server.schemas.retakeGrant.parse(data))
  .handler(async ({ data }) => server.grantQuizRetake(data.quiz_id, data.student_id, data.token));

export const resetQuizAttemptsFn = createServerFn({ method: "POST" })
  .validator((data) => server.schemas.retakeGrant.parse(data))
  .handler(async ({ data }) => server.resetQuizAttempts(data.quiz_id, data.student_id, data.token));

export const createQuizWithQuestionsFn = createServerFn({ method: "POST" })
  .validator((data) => server.schemas.quizBundle.parse(data))
  .handler(async ({ data }) => {
    // Worksheets (answer key included) may only be created in a course the
    // caller leads; admins may create anywhere.
    await server.requireCourseOwnerOrAdmin(data.token, data.quiz.course_id);
    return server.createQuizWithQuestions(data.quiz, data.questions);
  });

/* ---------- Grades ---------- */

export const listGradesForStudentFn = createServerFn({ method: "POST" })
  .validator((data) => server.schemas.studentScoped.parse(data))
  .handler(async ({ data }) => {
    await server.requireSelfOrStaff(data.token, data.studentId);
    return server.listGradesForStudent(data.studentId);
  });

export const listGradesForCourseFn = createServerFn({ method: "POST" })
  .validator((data) => server.schemas.courseQuarter.parse(data))
  .handler(async ({ data }) => {
    await server.requireStaff(data.token);
    return server.listGradesForCourse(data.courseId, data.quarter);
  });

// Gradebook editing is TEACHER-only: admins manage the system, not grades.
export const upsertGradeFn = createServerFn({ method: "POST" })
  .validator((data) => server.schemas.gradeInput.parse(data))
  .handler(async ({ data }) => {
    await server.requireTeacher(data.token);
    return server.upsertGrade(data);
  });

/* ---------- Attendance ---------- */

export const listAttendanceFn = createServerFn({ method: "POST" })
  .validator((data) => server.schemas.studentScoped.parse(data))
  .handler(async ({ data }) => {
    await server.requireSelfOrStaff(data.token, data.studentId);
    return server.listAttendance(data.studentId);
  });

export const listAllAttendanceFn = createServerFn({ method: "POST" })
  .validator((data) => server.schemas.limit.parse(data))
  .handler(async ({ data }) => {
    await server.requireStaff(data.token);
    return server.listAllAttendance(data.limit);
  });

export const logAttendanceFn = createServerFn({ method: "POST" })
  .validator((data) => server.schemas.attendance.parse(data))
  .handler(async ({ data }) => {
    await server.requireStaff(data.token);
    return server.logAttendance(data.student_id, data.scan_type, data.status);
  });

// Kiosk tap endpoint — the staff-operated gate kiosk submits a card UID plus
// the reader's timestamp; the server toggles in/out and evaluates on-time vs
// late against the tapped person's class schedule for the day.
export const recordTapFn = createServerFn({ method: "POST" })
  .validator((data) => server.schemas.tap.parse(data))
  .handler(async ({ data }) => {
    await server.requireStaff(data.token);
    return server.recordTap(data.uid, data.at);
  });

export const updateAttendanceLogFn = createServerFn({ method: "POST" })
  .validator((data) => server.schemas.attendancePatch.parse(data))
  .handler(async ({ data }) => {
    await server.requireStaff(data.token);
    return server.updateAttendanceLog(data.id, data.patch);
  });

export const deleteAttendanceLogFn = createServerFn({ method: "POST" })
  .validator((data) => server.schemas.id.parse(data))
  .handler(async ({ data }) => {
    await server.requireStaff(data.token);
    return server.deleteAttendanceLog(data.id);
  });

/* ---------- Misc ---------- */

export const countRowsFn = createServerFn({ method: "POST" })
  .validator((data) => server.schemas.countable.parse(data))
  .handler(async ({ data }) => {
    await server.requireStaff(data.token);
    return server.countRows(data.table);
  });

/* ---------- Course materials, content editing & deletion (staff) ----------
 * Admins have universal rights; teachers are restricted server-side to
 * courses where they are the assigned lead. */

export const uploadCourseMaterialFn = createServerFn({ method: "POST" })
  .validator((data) => server.schemas.materialUpload.parse(data))
  .handler(async ({ data }) =>
    server.uploadCourseMaterial(
      data.token,
      data.course_id,
      data.name,
      data.data,
      data.content_type,
    ),
  );

export const attachCourseMaterialFn = createServerFn({ method: "POST" })
  .validator((data) => server.schemas.materialAttach.parse(data))
  .handler(async ({ data }) =>
    server.attachCourseMaterial(data.token, data.target, data.id, data.attachment),
  );

export const removeCourseMaterialFn = createServerFn({ method: "POST" })
  .validator((data) => server.schemas.materialRemove.parse(data))
  .handler(async ({ data }) =>
    server.removeCourseMaterial(data.token, data.target, data.id, data.path),
  );

export const updateQuizFn = createServerFn({ method: "POST" })
  .validator((data) => server.schemas.quizUpdate.parse(data))
  .handler(async ({ data }) => server.updateQuiz(data.token, data.id, data.patch, data.questions));

export const deleteQuizFn = createServerFn({ method: "POST" })
  .validator((data) => server.schemas.contentDelete.parse(data))
  .handler(async ({ data }) => server.deleteQuiz(data.token, data.id, data.mode));

export const updateAssignmentFn = createServerFn({ method: "POST" })
  .validator((data) => server.schemas.assignmentPatch.parse(data))
  .handler(async ({ data }) => server.updateAssignment(data.token, data.id, data.patch));

export const deleteAssignmentFn = createServerFn({ method: "POST" })
  .validator((data) => server.schemas.contentDelete.parse(data))
  .handler(async ({ data }) => server.deleteAssignment(data.token, data.id, data.mode));

export const listQuizScoresForCourseFn = createServerFn({ method: "POST" })
  .validator((data) => server.schemas.courseScoped.parse(data))
  .handler(async ({ data }) => server.listQuizScoresForCourse(data.courseId, data.token));
