-- 113_teeth_order_file_attachment.sql
-- Add columns for teeth order file attachment (XML, Excel, PDF) uploaded by teeth panel staff.
-- The file is stored in Supabase Storage bucket "teeth-order-files".

-- Add attachment columns to individual_orders
ALTER TABLE public.individual_orders
  ADD COLUMN IF NOT EXISTS teeth_order_file_path text,
  ADD COLUMN IF NOT EXISTS teeth_order_file_name text;

-- Index for quick lookup of orders with attachments
CREATE INDEX IF NOT EXISTS idx_individual_orders_teeth_order_file_path
  ON public.individual_orders (teeth_order_file_path)
  WHERE teeth_order_file_path IS NOT NULL;

-- Insert the storage bucket record if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'teeth-order-files',
  'teeth-order-files',
  false,
  10485760, -- 10 MB limit
  ARRAY[
    'application/xml',
    'text/xml',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'application/pdf'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for the bucket: only service role (admin client) can manage files
-- Sales users get signed URLs via server actions, not direct storage access
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Allow service role full access to teeth-order-files bucket
DROP POLICY IF EXISTS "teeth_order_files_service_all" ON storage.objects;
CREATE POLICY "teeth_order_files_service_all"
  ON storage.objects
  FOR ALL
  TO service_role
  USING (bucket_id = 'teeth-order-files')
  WITH CHECK (bucket_id = 'teeth-order-files');
