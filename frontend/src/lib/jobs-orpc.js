import useSWR from "swr";
import useSWRMutation from "swr/mutation";
import { mutate } from "swr";
import { orpc } from "../orpc";

function jobListKey(shopId) {
  return orpc.job.listByShop.key({
    input: {
      shopId,
    },
  });
}

function revalidateJobsQuery(shopId) {
  return mutate(
    orpc.job.listByShop.matcher({
      input: {
        shopId,
      },
    }),
  );
}

export function useShopJobsQuery(options) {
  const { shopId, enabled = true, ...restOptions } = options ?? {};
  const canQuery = enabled && !!shopId;
  const key = canQuery ? jobListKey(shopId) : null;
  const fetcher = canQuery ? orpc.job.listByShop.fetcher() : null;

  return useSWR(key, fetcher, restOptions);
}

export function useUpdateJobStatusMutation(options = {}) {
  const { shopId, onSuccess, ...restOptions } = options;

  return useSWRMutation(orpc.job.updateStatus.key(), orpc.job.updateStatus.mutator(), {
    ...restOptions,
    onSuccess: (data, key, config) => {
      const effectiveShopId = config.arg?.shopId ?? shopId;
      if (effectiveShopId) {
        void revalidateJobsQuery(effectiveShopId);
      }
      onSuccess?.(data, key, config);
    },
  });
}
