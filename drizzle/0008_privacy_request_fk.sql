ALTER TABLE data_privacy_request
  DROP CONSTRAINT IF EXISTS data_privacy_request_customer_id_fkey;

ALTER TABLE data_privacy_request
  ADD CONSTRAINT data_privacy_request_customer_id_fkey
  FOREIGN KEY (customer_id)
  REFERENCES customer(id)
  ON DELETE CASCADE;
