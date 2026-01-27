-- 1) Storage bucket for generated product images
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

-- Public read for generated images
create policy "Public can read product images"
on storage.objects
for select
using (bucket_id = 'product-images');

-- Only authenticated users can upload/update/delete within their own folder (user_id/..)
create policy "Users can upload product images"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'product-images'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "Users can update their product images"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'product-images'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "Users can delete their product images"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'product-images'
  and auth.uid()::text = (storage.foldername(name))[1]
);

-- 2) Store generated image URLs separately from scraped image URLs
alter table public.extracted_products
add column if not exists generated_image_urls text[] not null default '{}';

create index if not exists idx_extracted_products_saved
on public.extracted_products (user_id, is_saved, created_at desc);
