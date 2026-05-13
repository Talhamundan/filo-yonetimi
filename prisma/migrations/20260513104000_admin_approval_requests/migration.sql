CREATE TABLE IF NOT EXISTS "AdminApprovalRequest" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "prismaModel" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "payload" JSONB,
    "beforeData" JSONB,
    "requestedById" TEXT,
    "companyId" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminApprovalRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AdminApprovalRequest_status_idx" ON "AdminApprovalRequest"("status");
CREATE INDEX IF NOT EXISTS "AdminApprovalRequest_action_idx" ON "AdminApprovalRequest"("action");
CREATE INDEX IF NOT EXISTS "AdminApprovalRequest_entityType_idx" ON "AdminApprovalRequest"("entityType");
CREATE INDEX IF NOT EXISTS "AdminApprovalRequest_entityId_idx" ON "AdminApprovalRequest"("entityId");
CREATE INDEX IF NOT EXISTS "AdminApprovalRequest_companyId_idx" ON "AdminApprovalRequest"("companyId");
CREATE INDEX IF NOT EXISTS "AdminApprovalRequest_requestedById_idx" ON "AdminApprovalRequest"("requestedById");
CREATE INDEX IF NOT EXISTS "AdminApprovalRequest_createdAt_idx" ON "AdminApprovalRequest"("createdAt");
