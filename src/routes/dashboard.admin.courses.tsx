import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, ClipboardList, FileQuestion } from "lucide-react";
import { toast } from "sonner";
import {
  deleteAssignment,
  deleteCourse,
  deleteQuiz,
  listAssignments,
  listCourses,
  listQuizzes,
  listTeachers,
  updateQuizRetakePolicy,
  type Assignment,
  type Course,
  type Quiz,
} from "@/lib/lms";
import { staffNav, AppShell, EmptyState, Modal, useProfile } from "@/components/lms";
import { EMPTY_POLICY, policyPayload } from "@/components/courses/constants";
import { PolicyFields } from "@/components/courses/policy-fields";
import { AttemptRoster } from "@/components/courses/attempt-roster";
import { CourseCardGrid } from "@/components/courses/course-card-grid";
import { WorksheetsSection } from "@/components/courses/worksheets-section";
import { AssignmentsSection } from "@/components/courses/assignments-section";
import { CourseWizardModal } from "@/components/courses/course-wizard-modal";
import { CreateAssignmentModal } from "@/components/courses/create-assignment-modal";
import { CreateQuizModal } from "@/components/courses/create-quiz-modal";
import { EditQuizModal } from "@/components/courses/edit-quiz-modal";
import { EditAssignmentModal } from "@/components/courses/edit-assignment-modal";
import { ConfirmRemoveModal } from "@/components/courses/confirm-remove-modal";
import { AnswerKeyModal } from "@/components/courses/answer-key-modal";

export const Route = createFileRoute("/dashboard/admin/courses")({
  head: () => ({
    meta: [
      { title: "Courses | MIOW - Integrated Developmental School" },
      { name: "description", content: "Manage courses, assignments and worksheets." },
      { property: "og:title", content: "Courses | MIOW - Integrated Developmental School" },
      { property: "og:description", content: "Manage courses, assignments and worksheets." },
    ],
  }),
  component: CoursesPage,
});

export function CoursesPage() {
  const profile = useProfile(["admin", "teacher"]);
  const qc = useQueryClient();
  const { data: courses } = useQuery({
    queryKey: ["courses"],
    queryFn: listCourses,
    enabled: !!profile,
  });
  const { data: teachers } = useQuery({
    queryKey: ["teachers"],
    queryFn: listTeachers,
    enabled: !!profile,
  });
  const { data: quizzes } = useQuery({
    queryKey: ["quizzes"],
    queryFn: listQuizzes,
    enabled: !!profile,
  });
  const { data: assignments } = useQuery({
    queryKey: ["assignments"],
    queryFn: listAssignments,
    enabled: !!profile,
  });

  const [modal, setModal] = useState<"course" | "assignment" | "quiz" | null>(null);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [policyQuiz, setPolicyQuiz] = useState<Quiz | null>(null);
  const [policyForm, setPolicyForm] = useState(EMPTY_POLICY);
  const [rosterQuiz, setRosterQuiz] = useState<Quiz | null>(null);
  const [editQuiz, setEditQuiz] = useState<Quiz | null>(null);
  const [answerKeyQuiz, setAnswerKeyQuiz] = useState<Quiz | null>(null);
  const [editAssign, setEditAssign] = useState<Assignment | null>(null);
  const [removeTarget, setRemoveTarget] = useState<{
    kind: "quiz" | "assignment";
    id: string;
    title: string;
  } | null>(null);
  const [saving, setSaving] = useState(false);

  if (!profile) return null;
  const isAdmin = profile.role === "admin";
  const refresh = () => qc.invalidateQueries({ queryKey: ["courses"] });
  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["courses"] });
    qc.invalidateQueries({ queryKey: ["quizzes"] });
    qc.invalidateQueries({ queryKey: ["assignments"] });
  };

  const openEdit = (c: Course) => {
    setEditingCourse(c);
    setModal("course");
  };

  const removeCourse = async (c: Course) => {
    if (
      !confirm(
        `Delete ${c.code} — ${c.title}? Its assignments and worksheets will also be removed.`,
      )
    )
      return;
    try {
      await deleteCourse(c.id);
      toast.success("Course deleted.");
      refresh();
    } catch {
      toast.error("Delete failed.");
    }
  };

  const openPolicy = (q: Quiz) => {
    setPolicyForm({
      allow_retake: q.allow_retake,
      unlimited: q.max_attempts === 0,
      max_attempts: String(q.max_attempts || 1),
      retake_score_policy: q.retake_score_policy,
    });
    setPolicyQuiz(q);
  };

  const savePolicy = async () => {
    if (!policyQuiz) return;
    setSaving(true);
    try {
      await updateQuizRetakePolicy(policyQuiz.id, policyPayload(policyForm));
      toast.success("Retake policy updated.");
      setPolicyQuiz(null);
      qc.invalidateQueries({ queryKey: ["quizzes"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update the retake policy.");
    } finally {
      setSaving(false);
    }
  };

  const confirmRemove = async (mode: "soft" | "hard") => {
    if (!removeTarget) return;
    setSaving(true);
    try {
      if (removeTarget.kind === "quiz") await deleteQuiz(removeTarget.id, mode);
      else await deleteAssignment(removeTarget.id, mode);
      toast.success(mode === "soft" ? "Archived — student records kept." : "Permanently deleted.");
      setRemoveTarget(null);
      qc.invalidateQueries({ queryKey: ["quizzes"] });
      qc.invalidateQueries({ queryKey: ["assignments"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not remove this item.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell
      nav={staffNav(profile.role)}
      profile={profile}
      subtitle={profile.role === "admin" ? "MIOW Admin Console" : "MIOW Teacher Portal"}
    >
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold sm:text-3xl">Courses</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {courses?.length ?? 0} active courses
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isAdmin && (
            <button
              onClick={() => {
                setEditingCourse(null);
                setModal("course");
              }}
              className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
            >
              <BookOpen className="h-4 w-4" /> Course
            </button>
          )}
          <button
            onClick={() => setModal("assignment")}
            className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold hover:bg-muted"
          >
            <ClipboardList className="h-4 w-4" /> Assignment
          </button>
          <button
            onClick={() => setModal("quiz")}
            className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold hover:bg-muted"
          >
            <FileQuestion className="h-4 w-4" /> Worksheet
          </button>
        </div>
      </div>

      {(courses ?? []).length === 0 ? (
        <EmptyState
          title="No courses yet"
          sub={
            isAdmin
              ? "Create your first course to begin."
              : "An administrator will assign courses to you."
          }
        />
      ) : (
        <CourseCardGrid
          courses={courses ?? []}
          profile={profile}
          isAdmin={isAdmin}
          onEdit={openEdit}
          onRemove={removeCourse}
        />
      )}

      {(quizzes ?? []).length > 0 && (
        <WorksheetsSection
          quizzes={quizzes ?? []}
          courses={courses ?? []}
          onPolicy={openPolicy}
          onEdit={setEditQuiz}
          onRemove={(q) => setRemoveTarget({ kind: "quiz", id: q.id, title: q.title })}
          onRoster={setRosterQuiz}
          onAnswerKey={setAnswerKeyQuiz}
        />
      )}

      {(assignments ?? []).length > 0 && (
        <AssignmentsSection
          assignments={assignments ?? []}
          courses={courses ?? []}
          onEdit={setEditAssign}
          onRemove={(a) => setRemoveTarget({ kind: "assignment", id: a.id, title: a.title })}
        />
      )}

      <CourseWizardModal
        open={modal === "course"}
        onClose={() => {
          setModal(null);
          setEditingCourse(null);
        }}
        editing={editingCourse}
        teachers={teachers ?? []}
        isAdmin={isAdmin}
        onSaved={invalidateAll}
      />

      <CreateAssignmentModal
        open={modal === "assignment"}
        onClose={() => setModal(null)}
        courses={courses ?? []}
        onSaved={invalidateAll}
      />

      <CreateQuizModal
        open={modal === "quiz"}
        onClose={() => setModal(null)}
        courses={courses ?? []}
        onSaved={invalidateAll}
      />

      <Modal
        open={!!policyQuiz}
        onClose={() => setPolicyQuiz(null)}
        title={`Retake policy — ${policyQuiz?.title ?? ""}`}
      >
        <PolicyFields
          value={policyForm}
          onChange={(patch) => setPolicyForm((f) => ({ ...f, ...patch }))}
        />
        <button
          onClick={savePolicy}
          disabled={saving}
          className="mt-4 h-11 w-full rounded-xl bg-primary text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save policy"}
        </button>
      </Modal>

      <EditQuizModal quiz={editQuiz} onClose={() => setEditQuiz(null)} onSaved={invalidateAll} />

      <EditAssignmentModal
        assignment={editAssign}
        onClose={() => setEditAssign(null)}
        onSaved={invalidateAll}
      />

      <AnswerKeyModal
        quizId={answerKeyQuiz?.id ?? null}
        quizTitle={answerKeyQuiz?.title ?? ""}
        onClose={() => setAnswerKeyQuiz(null)}
      />

      <ConfirmRemoveModal
        target={removeTarget}
        saving={saving}
        onConfirm={confirmRemove}
        onClose={() => setRemoveTarget(null)}
      />

      <Modal
        open={!!rosterQuiz}
        onClose={() => setRosterQuiz(null)}
        title={`Attempts — ${rosterQuiz?.title ?? ""}`}
        wide
      >
        {rosterQuiz && <AttemptRoster quizId={rosterQuiz.id} />}
      </Modal>
    </AppShell>
  );
}
