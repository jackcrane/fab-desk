export type SsoProviderType = 'saml';

export type SsoDomainMatch = {
  providerId: string;
  providerType: SsoProviderType;
  domain: string;
};

export type DefaultSsoProvider = {
  domain: string;
  providerId: string;
  samlConfig: {
    issuer: string;
    entryPoint: string;
    cert: string;
    callbackUrl: string;
    spMetadata: {
      entityID?: string;
      privateKey?: string;
      privateKeyPass?: string;
    };
    mapping?: {
      id?: string;
      email?: string;
      emailVerified?: string;
      name?: string;
      firstName?: string;
      lastName?: string;
      extraFields?: Record<string, string>;
    };
    wantAssertionsSigned?: boolean;
    authnRequestsSigned?: boolean;
  };
};

export const authPublicUrl: string;

export function getDefaultSsoProviders(): DefaultSsoProvider[];
export function findSsoProviderByDomain(domain: string): SsoDomainMatch | null;
export function findSsoProviderByEmail(email: string): SsoDomainMatch | null;
