-- CreateTable
CREATE TABLE "ShopProcess" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopProcess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcessResource" (
    "id" TEXT NOT NULL,
    "processId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "unit" TEXT NOT NULL,
    "costPerUnit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "flatCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProcessResource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcessMaterial" (
    "id" TEXT NOT NULL,
    "processId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "unit" TEXT NOT NULL,
    "costPerUnit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "flatCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProcessMaterial_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ShopProcess_shopId_idx" ON "ShopProcess"("shopId");

-- CreateIndex
CREATE UNIQUE INDEX "ShopProcess_shopId_name_key" ON "ShopProcess"("shopId", "name");

-- CreateIndex
CREATE INDEX "ProcessResource_processId_idx" ON "ProcessResource"("processId");

-- CreateIndex
CREATE UNIQUE INDEX "ProcessResource_processId_name_key" ON "ProcessResource"("processId", "name");

-- CreateIndex
CREATE INDEX "ProcessMaterial_processId_idx" ON "ProcessMaterial"("processId");

-- CreateIndex
CREATE UNIQUE INDEX "ProcessMaterial_processId_name_key" ON "ProcessMaterial"("processId", "name");

-- AddForeignKey
ALTER TABLE "ShopProcess" ADD CONSTRAINT "ShopProcess_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessResource" ADD CONSTRAINT "ProcessResource_processId_fkey" FOREIGN KEY ("processId") REFERENCES "ShopProcess"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessMaterial" ADD CONSTRAINT "ProcessMaterial_processId_fkey" FOREIGN KEY ("processId") REFERENCES "ShopProcess"("id") ON DELETE CASCADE ON UPDATE CASCADE;
