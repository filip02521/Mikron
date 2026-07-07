-- Bucket na zdjęcia kartek z zamówieniem zębów (OCR).
-- Używany przez /api/teeth-vision-ocr do zapisu i /zeby/weryfikacja do odczytu.

INSERT INTO storage.buckets (id, name, public)
VALUES ('teeth-ocr-images', 'teeth-ocr-images', false)
ON CONFLICT (id) DO NOTHING;

-- Odczyt plików: zalogowani użytkownicy (weryfikacja panel zębów)
CREATE POLICY teeth_ocr_images_read ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'teeth-ocr-images');

-- Zapis plików: zalogowani użytkownicy (upload przez API route)
CREATE POLICY teeth_ocr_images_write ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'teeth-ocr-images');

-- Usuwanie plików: tylko admin (porządki)
CREATE POLICY teeth_ocr_images_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'teeth-ocr-images' AND public.is_admin());
