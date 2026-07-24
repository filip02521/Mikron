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
-- Bucket is private (public=false) — all access via server actions using service role key (bypasses RLS)
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
