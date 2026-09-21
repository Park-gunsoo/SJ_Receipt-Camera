-- Additive rollout: keep legacy archive states and every existing Drive file.
ALTER TYPE "ArchiveState" ADD VALUE 'NOT_REQUESTED';
ALTER TYPE "JobKind" ADD VALUE 'PDF';
CREATE TYPE "PdfState" AS ENUM ('PENDING', 'PROCESSING', 'SAVED', 'FAILED');
ALTER TABLE "Receipt" ADD COLUMN "pdfState" "PdfState" NOT NULL DEFAULT 'PENDING', ADD COLUMN "pdfError" TEXT;
ALTER TABLE "DriveConnection" ADD COLUMN "backupEnabled" BOOLEAN NOT NULL DEFAULT true;
CREATE INDEX "Receipt_pdfState_createdAt_idx" ON "Receipt"("pdfState", "createdAt");
-- The worker creates missing PDF jobs after rollout; no OCR or Drive re-upload is needed.
