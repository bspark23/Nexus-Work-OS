
CREATE POLICY "work_files_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'work-files' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_admin()));
CREATE POLICY "work_files_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'work-files' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "work_files_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'work-files' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "work_files_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'work-files' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_admin()));
