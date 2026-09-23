-- Optional shipment id from the packing list. Prefills Shipment # (MRC) on the MTR request.

alter table public.check_ins
  add column if not exists shipment_number text;
