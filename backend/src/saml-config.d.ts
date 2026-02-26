export type SsoProviderType = 'saml';

export type SsoDomainMatch = {
  providerId: string;
  providerType: SsoProviderType;
  domain: string;
};

export type DefaultSsoProvider = {
  domain: string;
  providerId: string;
  domains?: string[];
  enabled?: boolean;
  providerType?: SsoProviderType;
  samlConfig: {
    issuer: string;
    entryPoint: string;
    entryPointBinding?: 'redirect' | 'post';
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
export function findDefaultSamlProviderForSignIn(input: {
  providerId?: string | null;
  email?: string | null;
  domain?: string | null;
}): DefaultSsoProvider | null;
