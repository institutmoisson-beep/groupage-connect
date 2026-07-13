
CREATE POLICY "user upload own proofs" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'payment-proofs' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "user read own proofs" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'payment-proofs' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(),'admin')));
CREATE POLICY "user delete own proofs" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'payment-proofs' AND (storage.foldername(name))[1] = auth.uid()::text);
