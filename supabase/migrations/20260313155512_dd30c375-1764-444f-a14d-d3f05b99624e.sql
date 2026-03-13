
-- Insert commission entries for completed appointments (40% commission)
INSERT INTO commission_entries (
  establishment_id, appointment_id, professional_id, professional_name,
  service_id, service_name, service_price_cents, customer_id, customer_name,
  appointment_date, commission_type, commission_value, commission_amount_cents, status
)
SELECT 
  a.establishment_id,
  a.id,
  a.professional_id,
  p.name,
  a.service_id,
  s.name,
  COALESCE(s.price_cents, 0),
  a.customer_id,
  c.name,
  a.start_at,
  'percentage',
  40,
  ROUND(COALESCE(s.price_cents, 0) * 0.40),
  'pending'
FROM appointments a
JOIN professionals p ON p.id = a.professional_id
JOIN services s ON s.id = a.service_id
JOIN customers c ON c.id = a.customer_id
WHERE a.establishment_id = 'eb6dad22-27b9-49e1-a8bf-59cf4dea9d09'
  AND a.status = 'completed'
  AND NOT EXISTS (
    SELECT 1 FROM commission_entries ce WHERE ce.appointment_id = a.id
  );

-- Insert ratings for some completed appointments (varied stars)
INSERT INTO ratings (establishment_id, appointment_id, customer_id, stars, comment)
SELECT 
  a.establishment_id,
  a.id,
  a.customer_id,
  CASE 
    WHEN ROW_NUMBER() OVER (ORDER BY a.start_at) % 5 = 0 THEN 4
    WHEN ROW_NUMBER() OVER (ORDER BY a.start_at) % 7 = 0 THEN 3
    ELSE 5
  END,
  CASE 
    WHEN ROW_NUMBER() OVER (ORDER BY a.start_at) % 3 = 0 THEN 'Excelente atendimento! Voltarei com certeza.'
    WHEN ROW_NUMBER() OVER (ORDER BY a.start_at) % 4 = 0 THEN 'Profissional muito habilidoso, recomendo!'
    WHEN ROW_NUMBER() OVER (ORDER BY a.start_at) % 5 = 0 THEN 'Bom serviço, ambiente agradável.'
    WHEN ROW_NUMBER() OVER (ORDER BY a.start_at) % 7 = 0 THEN 'Atendimento ok, mas poderia melhorar o tempo de espera.'
    ELSE NULL
  END
FROM appointments a
WHERE a.establishment_id = 'eb6dad22-27b9-49e1-a8bf-59cf4dea9d09'
  AND a.status = 'completed'
  AND NOT EXISTS (
    SELECT 1 FROM ratings r WHERE r.appointment_id = a.id
  )
-- Only rate ~60% of appointments
AND (EXTRACT(EPOCH FROM a.start_at)::int % 5) < 3;
