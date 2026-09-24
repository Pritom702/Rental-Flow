-- ============================================================
--  RentalFlow  |  Marketplace  |  Owner: M2 - Tawheed Bin Hamid (Pritom)
--  GitHub: @pritom702  |  Part: categories added after the first release
-- ============================================================
-- Raw SQL, safe to run repeatedly (npm run db:migrate): a category that is
-- already there is left alone.
INSERT INTO categories (name) VALUES ('Phones'), ('Home Appliances')
ON CONFLICT (name) DO NOTHING;
