-- Add agency field for insurance and casco records
ALTER TABLE "Kasko"
ADD COLUMN "acente" TEXT;

ALTER TABLE "TrafikSigortasi"
ADD COLUMN "acente" TEXT;
