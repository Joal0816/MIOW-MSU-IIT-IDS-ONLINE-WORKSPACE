# MIOW- MSU-IIT I D S ONLINE WORKSPACE

Build a comprehensive, modern Learning Management System (LMS) for Junior and Senior High School using React, TypeScript, Tailwind CSS, Lucide React, and Supabase. Implement the entire database schema, responsive UI, mock data, and functional routing in this single build.

### 1. Database Schema & Supabase Setup

Generate the SQL schema and types for:

- `profiles`: id, full_name, role ('student' | 'teacher' | 'admin'), rfid_uid, avatar_url, face_embedding (text/vector), grade_level, section.

- `announcements`: id, title, content, category ('urgent' | 'event' | 'academic'), target_audience, author_id, created_at.

- `courses`: id, title, code, grade_level, teacher_id.

- `assignments`: id, course_id, title, description, due_date, total_points, component_type ('written_work' | 'performance_task' | 'quarterly_exam').

- `submissions`: id, assignment_id, student_id, file_url, content, score, feedback, status ('pending' | 'submitted' | 'graded').

- `quizzes` & `quiz_questions`: id, course_id, title, duration_minutes, questions (JSON or relational), correct_answers.

- `grades`: id, student_id, course_id, quarter (1-4), written_work_score, performance_task_score, exam_score, transmuted_final_grade.

- `attendance_logs`: id, student_id, timestamp, scan_type ('in' | 'out'), status ('on-time' | 'late').

### 2. Dual Role Dashboards & Pages

* **Student View (`/student`):**

  - **Dashboard:** Modern welcome banner, daily class schedule, attendance streak card, GPA overview, and urgent announcement ticker.

  - **Academic Hub (`/student/courses`):** Course list with progress bars; module viewer; assignment submission modal with file upload UI and status tags.

  - **Quiz Interface (`/student/quizzes/:id`):** Full-screen timed assessment view, question stepper, instant auto-save, and score review screen.

  - **Grade Portal (`/student/grades`):** Visual DepEd grading matrix breakdown (Written 40%, Performance 40%, Exam 20%), raw-to-transmuted grade tables, and quarterly remarks.

* **Teacher & Admin View (`/admin`):**

  - **Announcement Manager:** Rich markdown editor with audience filters and priority badges.

  - **Gradebook Matrix:** Editable spreadsheet-style table with real-time weighted grade calculation, transmuted score previews, and bulk export to CSV.

  - **Assessment Creator:** Form builder for both file-based assignments and multiple-choice auto-graded quizzes.

  - **Hardware & Student Registry:** Table to view student profiles, bind physical RFID cards, and manage live photo enrollments.

### 3. Passwordless Hardware Authentication (`/auth`)

* **Kiosk Terminal Login:**

  - Auto-focused input listener that immediately captures 10-to-13-digit RFID card scanner keystrokes (USB keyboard emulation).

  - Integrated WebRTC camera interface showing live video stream with an animated scanning overlay for facial verification.

  - Mock client-side biometric matching logic verifying RFID UID + camera capture before auto-redirecting to the role dashboard.

  - Manual fallback toggle for Student ID / Email + PIN.

* **Onboarding & Sign-Up:**

  - Step-by-step registration wizard: Step 1 (Personal Info & Grade Level) -> Step 2 (RFID Tap Capture) -> Step 3 (Webcam Photo Capture) -> Step 4 (Account Summary & Confirmation).

### 4. UI/UX & Design Standards

- Aesthetic: Clean modern aesthetic (Slate/Indigo palette, rounded-2xl cards, micro-interactions with Framer Motion, accessible high-contrast text).

- Include comprehensive mock seed data across all views so the app is fully testable immediately after generation.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
