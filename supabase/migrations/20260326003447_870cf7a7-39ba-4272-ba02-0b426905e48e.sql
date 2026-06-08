
UPDATE admin_broadcast_contact_batches SET total_contacts = (
  SELECT count(*) FROM admin_broadcast_contacts WHERE batch_id = admin_broadcast_contact_batches.id
);
