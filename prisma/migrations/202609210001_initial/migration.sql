-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "IntakeState" AS ENUM ('UPLOADING', 'ACCEPTED');

-- CreateEnum
CREATE TYPE "ArchiveState" AS ENUM ('PENDING', 'PROCESSING', 'SAVED', 'BLOCKED', 'FAILED');

-- CreateEnum
CREATE TYPE "OcrState" AS ENUM ('PENDING', 'PROCESSING', 'DONE', 'FAILED', 'LIMIT_REACHED');

-- CreateEnum
CREATE TYPE "ReviewState" AS ENUM ('UNREVIEWED', 'NEEDS_REVIEW', 'CONFIRMED');

-- CreateEnum
CREATE TYPE "JobKind" AS ENUM ('ARCHIVE', 'OCR', 'METADATA');

-- CreateEnum
CREATE TYPE "JobState" AS ENUM ('PENDING', 'RUNNING', 'DONE', 'BLOCKED', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "googleSub" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DriveConnection" (
    "userId" TEXT NOT NULL,
    "encryptedRefreshToken" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'CONNECTED',
    "rootFolderId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DriveConnection_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "DriveFolder" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,

    CONSTRAINT "DriveFolder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Receipt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "captureId" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "intakeState" "IntakeState" NOT NULL DEFAULT 'UPLOADING',
    "archiveState" "ArchiveState" NOT NULL DEFAULT 'PENDING',
    "ocrState" "OcrState" NOT NULL DEFAULT 'PENDING',
    "reviewState" "ReviewState" NOT NULL DEFAULT 'UNREVIEWED',
    "objectKey" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "byteLength" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "driveFileId" TEXT,
    "driveFolderId" TEXT,
    "archiveError" TEXT,
    "ocrError" TEXT,
    "rawOcr" JSONB,
    "extraction" JSONB,
    "values" JSONB,
    "reviewReasons" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "merchant" TEXT,
    "transactionDate" TEXT,
    "totalYen" INTEGER,
    "extractionVersion" TEXT,
    "userEdited" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 0,
    "duplicateGroupId" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Receipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "receiptId" TEXT NOT NULL,
    "kind" "JobKind" NOT NULL,
    "state" "JobState" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextRunAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leaseToken" TEXT,
    "leaseUntil" TIMESTAMP(3),
    "lastError" TEXT,
    "enqueuedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReceiptRevision" (
    "id" TEXT NOT NULL,
    "receiptId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "actorId" TEXT NOT NULL,
    "values" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReceiptRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsageDay" (
    "userId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "intake" INTEGER NOT NULL DEFAULT 0,
    "ocr" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "UsageDay_pkey" PRIMARY KEY ("userId","day")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_googleSub_key" ON "User"("googleSub");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "DriveFolder_fileId_key" ON "DriveFolder"("fileId");

-- CreateIndex
CREATE UNIQUE INDEX "DriveFolder_userId_path_key" ON "DriveFolder"("userId", "path");

-- CreateIndex
CREATE UNIQUE INDEX "Receipt_objectKey_key" ON "Receipt"("objectKey");

-- CreateIndex
CREATE UNIQUE INDEX "Receipt_driveFileId_key" ON "Receipt"("driveFileId");

-- CreateIndex
CREATE INDEX "Receipt_userId_createdAt_id_idx" ON "Receipt"("userId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "Receipt_intakeState_createdAt_idx" ON "Receipt"("intakeState", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Receipt_userId_captureId_key" ON "Receipt"("userId", "captureId");

-- CreateIndex
CREATE INDEX "Job_state_nextRunAt_idx" ON "Job"("state", "nextRunAt");

-- CreateIndex
CREATE UNIQUE INDEX "Job_receiptId_kind_key" ON "Job"("receiptId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "ReceiptRevision_receiptId_version_key" ON "ReceiptRevision"("receiptId", "version");

-- AddForeignKey
ALTER TABLE "DriveConnection" ADD CONSTRAINT "DriveConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriveFolder" ADD CONSTRAINT "DriveFolder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "Receipt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceiptRevision" ADD CONSTRAINT "ReceiptRevision_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "Receipt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsageDay" ADD CONSTRAINT "UsageDay_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
