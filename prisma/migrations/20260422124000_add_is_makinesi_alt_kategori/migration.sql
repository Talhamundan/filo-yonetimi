DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_type t
        JOIN pg_enum e ON e.enumtypid = t.oid
        WHERE t.typname = 'AracAltKategori'
          AND e.enumlabel = 'IS_MAKINESI'
    ) THEN
        ALTER TYPE "AracAltKategori" ADD VALUE 'IS_MAKINESI';
    END IF;
END $$;
