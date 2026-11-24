import { useCallback, useEffect, useRef, useState } from "react";
import {
  isOnline,
  readViewCache,
  useNetworkStatus,
  useReconnectRefresh,
  writeViewCache,
} from "../utils/network.js";

/**
 * Reusable data-loading hook with:
 * - Immediate cached-data hydration when offline (no endless skeleton!)
 * - Skeleton state only when loading with no data yet
 * - Clean offline state when offline & no cached data exists
 * - Automatic deduplicated refresh when internet connectivity returns
 * - Error state + manual retry for non-offline failures
 */
export function useNetworkResource(cacheKey, fetcher, { initialData = null, enabled = true, deps = [] } = {}) {
  const { online } = useNetworkStatus();
  const cachedOnMount = cacheKey ? readViewCache(cacheKey) : null;

  const [data, setData] = useState(() => (cachedOnMount ? cachedOnMount.data : initialData));
  const [hasData, setHasData] = useState(() => Boolean(cachedOnMount));
  const [cachedAt, setCachedAt] = useState(() => cachedOnMount?.updatedAt || null);
  const [fromCache, setFromCache] = useState(() => Boolean(cachedOnMount && !isOnline()));
  const [loading, setLoading] = useState(() => Boolean(enabled && isOnline() && !cachedOnMount));
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const hasDataRef = useRef(hasData);
  hasDataRef.current = hasData;
  const inFlightRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const load = useCallback(
    async ({ silent = false } = {}) => {
      if (!enabled || inFlightRef.current) return;

      if (!isOnline()) {
        const latestCache = cacheKey ? readViewCache(cacheKey) : null;
        if (mountedRef.current) {
          if (latestCache) {
            setData(latestCache.data);
            setHasData(true);
            setCachedAt(latestCache.updatedAt || null);
            setFromCache(true);
            setError("");
          } else if (hasDataRef.current) {
            setFromCache(true);
            setError("");
          } else {
            setFromCache(false);
          }
          setLoading(false);
          setRefreshing(false);
        }
        return;
      }

      inFlightRef.current = true;
      if (mountedRef.current) {
        if (!silent && !hasDataRef.current) {
          setLoading(true);
        } else {
          setRefreshing(true);
        }
        setError("");
      }

      try {
        const result = await fetcherRef.current();
        if (!mountedRef.current) return;
        setData(result);
        setHasData(true);
        setFromCache(false);
        setError("");
        const now = Date.now();
        setCachedAt(now);
        if (cacheKey) writeViewCache(cacheKey, result);
      } catch (err) {
        if (!mountedRef.current) return;
        if (!isOnline()) {
          // Dropped offline mid-flight: fall back to cache if present rather than showing error or endless skeleton
          const latestCache = cacheKey ? readViewCache(cacheKey) : null;
          if (latestCache || hasDataRef.current) {
            setFromCache(true);
            setError("");
          }
        } else if (!silent || !hasDataRef.current) {
          setError(err?.message || "Unable to load data. Please try again.");
        }
      } finally {
        inFlightRef.current = false;
        if (mountedRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [cacheKey, enabled]
  );

  // Initial load & dependency changes
  useEffect(() => {
    if (!enabled) return;
    load({ silent: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, cacheKey, ...deps]);

  // If browser goes offline while data is already on screen, mark it as cached/potentially outdated
  useEffect(() => {
    if (!online) {
      setLoading(false);
      setRefreshing(false);
      if (hasDataRef.current) {
        setFromCache(true);
        setError("");
      }
    }
  }, [online]);

  // Automatically refresh when connectivity returns (deduplicated)
  useReconnectRefresh(() => load({ silent: hasDataRef.current }), enabled);

  const offlineEmpty = !online && !hasData;
  const showSkeleton = loading && !hasData && online;
  const isStaleOffline = !online && hasData && fromCache;

  return {
    data,
    setData,
    hasData,
    loading: showSkeleton,
    refreshing,
    error: !online ? "" : error,
    offlineEmpty,
    isStaleOffline,
    cachedAt,
    online,
    reload: () => load({ silent: false }),
    silentReload: () => load({ silent: true }),
  };
}
