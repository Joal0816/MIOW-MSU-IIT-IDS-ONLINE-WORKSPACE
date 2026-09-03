// Barrel re-export: aggregates all server domain modules.
// This preserves backward compatibility — existing `import * as server from "./lms.server"`
// patterns can migrate to `import * as server from "./server"` gradually.

export {
  createSessionToken,
  verifySessionToken,
  revokeSessions,
  sessionSecret,
} from "./sessions.server";

export {
  requireSession,
  requireStaff,
  requireAdmin,
  requireTeacher,
  requireSelfOrStaff,
} from "./auth.server";

export {
  safeProfile,
  findByRfid,
  verifyPinLogin,
  getProfileById,
  createProfile,
  updateProfile,
  updateTeacherSettings,
  deleteUser,
  listStudents,
  listStaff,
  listTeachers,
  listTeacherDirectory,
  listAllUsers,
  updateUserRole,
  createTeacher,
  enrollRfid,
  uploadAvatar,
  avatarUrlForPath,
  selfServicePatch,
  authorizeProfileUpdate,
  assertUniqueIdentity,
} from "./profiles.server";

export {
  listAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
} from "./announcements.server";

export {
  listCourses,
  createCourse,
  updateCourse,
  deleteCourse,
  authorizeCourseUpdate,
  listAssignments,
  createAssignment,
  enrollmentsForCourse,
  enrollmentsForStudent,
  enrollStudent,
  listSubmissionsForStudent,
  submitAssignment,
  requireCourseOwnerOrAdmin,
} from "./courses.server";

export {
  listQuizzes,
  getQuizPublic,
  submitQuizAttempt,
  quizAttemptInfo,
  listMyQuizSummaries,
  updateQuizRetakePolicy,
  listQuizAttemptsForQuiz,
  grantQuizRetake,
  resetQuizAttempts,
  createQuizWithQuestions,
  updateQuiz,
  deleteQuiz,
  requireQuizOwnerOrAdmin,
  gradeEssay,
  parseKeywordCategories,
} from "./quizzes.server";

export { listGradesForStudent, listGradesForCourse, upsertGrade } from "./grades.server";

export {
  listAttendance,
  listAllAttendance,
  logAttendance,
  recordTap,
  recordTapByProfileId,
  updateAttendanceLog,
  deleteAttendanceLog,
} from "./attendance.server";

export {
  uploadCourseMaterial,
  removeCourseMaterial,
  attachCourseMaterial,
  updateAssignment,
  deleteAssignment,
  requireAssignmentOwnerOrAdmin,
  materialUrlForPath,
  countRows,
  hardwareRoster,
} from "./materials.server";

export type { Attachment } from "./materials.server";

export { schemas } from "./schemas.server";
