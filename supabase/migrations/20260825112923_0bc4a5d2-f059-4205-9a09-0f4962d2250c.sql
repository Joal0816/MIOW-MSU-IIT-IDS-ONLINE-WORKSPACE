-- Course materials: read access is staff-only (was any authenticated user).
DROP POLICY IF EXISTS "Staff read course materials" ON storage.objects;
CREATE POLICY "Staff read course materials"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'course-materials'
  AND private.current_profile_role() = ANY (ARRAY['teacher'::profile_role, 'admin'::profile_role])
);

-- Avatars: explicit least-privilege policies. Uploads and public kiosk display
-- go through server-side code; direct client access is staff-read plus
-- self-service on the caller's own folder (<profile id>/...).
DROP POLICY IF EXISTS "Staff read avatars" ON storage.objects;
CREATE POLICY "Staff read avatars"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'avatars'
  AND private.current_profile_role() = ANY (ARRAY['teacher'::profile_role, 'admin'::profile_role])
);

DROP POLICY IF EXISTS "Users read own avatar" ON storage.objects;
CREATE POLICY "Users read own avatar"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = private.current_profile_id()::text);

DROP POLICY IF EXISTS "Users upload own avatar" ON storage.objects;
CREATE POLICY "Users upload own avatar"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = private.current_profile_id()::text);

DROP POLICY IF EXISTS "Users replace own avatar" ON storage.objects;
CREATE POLICY "Users replace own avatar"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = private.current_profile_id()::text)
WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = private.current_profile_id()::text);

DROP POLICY IF EXISTS "Users delete own avatar" ON storage.objects;
CREATE POLICY "Users delete own avatar"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = private.current_profile_id()::text);