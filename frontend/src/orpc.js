import { createORPCClient } from '@orpc/client';
import { RPCLink } from '@orpc/client/fetch';
import { createSWRUtils } from '@orpc/experimental-react-swr';

const configuredApiUrl = import.meta.env.VITE_API_URL?.trim();
const defaultApiUrl =
  typeof window === 'undefined'
    ? 'http://localhost:3000/rpc'
    : new URL('/rpc', window.location.origin).toString();
const url = new URL(configuredApiUrl || defaultApiUrl, defaultApiUrl).toString();

const link = new RPCLink({
  url,
  fetch: (input, init) =>
    fetch(input, {
      ...init,
      credentials: 'include',
    }),
});

const client = createORPCClient(link);

export const orpc = createSWRUtils(client);
