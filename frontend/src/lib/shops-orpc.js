import useSWR from "swr";
import useSWRMutation from "swr/mutation";
import { mutate } from "swr";
import { orpc } from "../orpc";

const listShopsKey = orpc.shop.list.key();

function revalidateShopQueries() {
  // Revalidate in place so existing data stays mounted while fetching.
  return mutate(orpc.shop.list.matcher());
}

export function useShopsQuery(options) {
  const { enabled = true, ...restOptions } = options ?? {};
  const key = enabled ? listShopsKey : null;

  return useSWR(key, orpc.shop.list.fetcher(), restOptions);
}

export function useCreateShopMutation(options = {}) {
  const { onSuccess, ...restOptions } = options;

  return useSWRMutation(orpc.shop.create.key(), orpc.shop.create.mutator(), {
    ...restOptions,
    onSuccess: (data, key, config) => {
      void revalidateShopQueries();
      onSuccess?.(data, key, config);
    },
  });
}

export function useUpdateShopBasicSettingsMutation(options = {}) {
  const { onSuccess, ...restOptions } = options;

  return useSWRMutation(
    orpc.shop.updateBasicSettings.key(),
    orpc.shop.updateBasicSettings.mutator(),
    {
      ...restOptions,
      onSuccess: (data, key, config) => {
        void revalidateShopQueries();
        onSuccess?.(data, key, config);
      },
    },
  );
}

export function useUpdateShopAccessSettingsMutation(options = {}) {
  const { onSuccess, ...restOptions } = options;

  return useSWRMutation(
    orpc.shop.updateAccessSettings.key(),
    orpc.shop.updateAccessSettings.mutator(),
    {
      ...restOptions,
      onSuccess: (data, key, config) => {
        void revalidateShopQueries();
        onSuccess?.(data, key, config);
      },
    },
  );
}
