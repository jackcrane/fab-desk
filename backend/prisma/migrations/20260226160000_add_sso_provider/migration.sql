-- CreateTable
CREATE TABLE "SsoProvider" (
    "id" TEXT NOT NULL,
    "issuer" TEXT NOT NULL,
    "oidcConfig" TEXT,
    "samlConfig" TEXT,
    "userId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "organizationId" TEXT,
    "domain" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SsoProvider_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SsoProvider_providerId_key" ON "SsoProvider"("providerId");

-- AddForeignKey
ALTER TABLE "SsoProvider" ADD CONSTRAINT "SsoProvider_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
