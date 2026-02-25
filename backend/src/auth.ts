import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { prisma } from './db';

const frontendOrigin = process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173';

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),
  emailAndPassword: {
    enabled: true,
  },
  trustedOrigins: [frontendOrigin],
});

