-- DropIndex
DROP INDEX "Dokuman_path_idx";

-- AlterTable
ALTER TABLE "AdminApprovalRequest" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Dokuman" ALTER COLUMN "updatedAt" DROP DEFAULT;
