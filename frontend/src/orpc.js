import { createORPCClient } from '@orpc/client';
import { RPCLink } from '@orpc/client/fetch';
import { createSWRUtils } from '@orpc/experimental-react-swr';

const url = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/rpc';

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
