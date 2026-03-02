import useSWR from "swr";
import useSWRMutation from "swr/mutation";
import { mutate } from "swr";
import { orpc } from "../orpc";

const listShopsKey = orpc.shop.list.key();

function revalidateShopQueries() {
  // Revalidate in place so existing data stays mounted while fetching.
  return mutate(orpc.shop.list.matcher());
}

function processCatalogKey(shopId) {
  return orpc.shop.listProcessCatalog.key({
    input: {
      shopId,
    },
  });
}

function revalidateProcessCatalogQuery(shopId) {
  return mutate(
    orpc.shop.listProcessCatalog.matcher({
      input: {
        shopId,
      },
    }),
  );
}

export function useShopsQuery(options) {
  const { enabled = true, ...restOptions } = options ?? {};
  const key = enabled ? listShopsKey : null;

  return useSWR(key, orpc.shop.list.fetcher(), restOptions);
}

export function useShopProcessCatalogQuery(options) {
  const { shopId, enabled = true, ...restOptions } = options ?? {};
  const canQuery = enabled && !!shopId;
  const key = canQuery ? processCatalogKey(shopId) : null;
  const fetcher = canQuery ? orpc.shop.listProcessCatalog.fetcher() : null;

  return useSWR(key, fetcher, restOptions);
}

export function useCreateShopProcessMutation(options = {}) {
  const { shopId, onSuccess, ...restOptions } = options;

  return useSWRMutation(
    orpc.shop.createProcess.key(),
    orpc.shop.createProcess.mutator(),
    {
      ...restOptions,
      onSuccess: (data, key, config) => {
        const effectiveShopId = config.arg?.shopId ?? shopId;
        if (effectiveShopId) {
          void revalidateProcessCatalogQuery(effectiveShopId);
        }
        onSuccess?.(data, key, config);
      },
    },
  );
}

export function useCreateShopProcessResourceMutation(options = {}) {
  const { shopId, onSuccess, ...restOptions } = options;

  return useSWRMutation(
    orpc.shop.createResource.key(),
    orpc.shop.createResource.mutator(),
    {
      ...restOptions,
      onSuccess: (data, key, config) => {
        const effectiveShopId = config.arg?.shopId ?? shopId;
        if (effectiveShopId) {
          void revalidateProcessCatalogQuery(effectiveShopId);
        }
        onSuccess?.(data, key, config);
      },
    },
  );
}

export function useCreateShopProcessMaterialMutation(options = {}) {
  const { shopId, onSuccess, ...restOptions } = options;

  return useSWRMutation(
    orpc.shop.createMaterial.key(),
    orpc.shop.createMaterial.mutator(),
    {
      ...restOptions,
      onSuccess: (data, key, config) => {
        const effectiveShopId = config.arg?.shopId ?? shopId;
        if (effectiveShopId) {
          void revalidateProcessCatalogQuery(effectiveShopId);
        }
        onSuccess?.(data, key, config);
      },
    },
  );
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
