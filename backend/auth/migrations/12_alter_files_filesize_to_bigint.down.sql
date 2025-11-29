-- Revert file_size column back to INTEGER
-- Note: This may fail if there are values larger than INTEGER max (2,147,483,647)

ALTER TABLE files ALTER COLUMN file_size TYPE INTEGER;

