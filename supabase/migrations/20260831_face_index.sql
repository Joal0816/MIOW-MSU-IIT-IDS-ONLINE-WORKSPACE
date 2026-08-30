-- Task 27: face recognition index (optional / no-op)
-- Profiles.face_embedding already stores descriptors; index deferred until
-- face recognition is enabled via VITE_FACE_ENABLED. This migration is
-- intentionally a no-op so future vector/pgvector indexes can be layered here.

-- No schema change required yet; comment marks the stub.
comment on column public.profiles.face_embedding is
  'Face descriptor / embedding (base64 or JSON). Feature-gated by VITE_FACE_ENABLED. Vector index deferred.';
