
-- Insert default business hours for all existing establishments that don't have them
INSERT INTO public.business_hours (establishment_id, weekday, open_time, close_time, closed)
SELECT e.id, w.weekday,
  CASE WHEN w.weekday = 0 THEN NULL ELSE '09:00' END,
  CASE WHEN w.weekday = 0 THEN NULL WHEN w.weekday = 6 THEN '13:00' ELSE '18:00' END,
  CASE WHEN w.weekday = 0 THEN true ELSE false END
FROM public.establishments e
CROSS JOIN (SELECT generate_series(0, 6) AS weekday) w
WHERE NOT EXISTS (
  SELECT 1 FROM public.business_hours bh
  WHERE bh.establishment_id = e.id AND bh.weekday = w.weekday
);
