-- Add cover image URL for saved products
alter table public.extracted_products
add column if not exists cover_image_url text;

-- Helpful indexes for monthly limit counting and library views
create index if not exists idx_usage_logs_user_created_at
on public.usage_logs (user_id, created_at desc);

create index if not exists idx_extracted_products_user_saved_created
on public.extracted_products (user_id, is_saved, created_at desc);
