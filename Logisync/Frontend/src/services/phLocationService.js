// Philippine Location Service
// Integrates PSGC API with reliable offline-first fallback to phLocations dataset.
import {
  PH_PROVINCES,
  PH_CITIES_BY_PROVINCE,
  searchBarangays as localSearchBarangays,
  searchCities as localSearchCities,
  searchProvinces as localSearchProvinces,
  getBarangaysForCity as localGetBarangaysForCity,
  findProvinceForCity as localFindProvinceForCity,
  findCityForBarangay as localFindCityForBarangay,
  cleanBarangayPrefix,
  normalizeText,
} from "../data/phLocations.js";

// In-memory cache for API queries
const apiCache = new Map();

/**
 * Searches barangays with optional online PSGC query and local instant fallback.
 */
export async function fetchBarangays(query, { city, province } = {}, limit = 8) {
  // Always query local dataset first for instant 0ms feedback
  const localResults = localSearchBarangays(query, { city, province }, limit);

  // If local results are sufficient, return them immediately
  if (localResults.length >= limit || !query) {
    return { data: localResults, source: "local", error: null };
  }

  // Attempt remote API lookup if city is provided and local results are sparse
  if (city) {
    const cacheKey = `brgy:${normalizeText(city)}:${normalizeText(query)}`;
    if (apiCache.has(cacheKey)) {
      return { data: apiCache.get(cacheKey), source: "cache", error: null };
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 1800); // 1.8s timeout
      const res = await fetch(
        `https://psgc.gitlab.io/api/cities-municipalities/${encodeURIComponent(
          city.toLowerCase()
        )}/barangays/`,
        { signal: controller.signal }
      );
      clearTimeout(timeout);

      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json)) {
          const q = normalizeText(cleanBarangayPrefix(query));
          const remoteList = json
            .map((item) => ({
              barangay: item.name,
              city: city,
              province: province || localFindProvinceForCity(city) || "",
            }))
            .filter((item) => {
              const bNorm = normalizeText(cleanBarangayPrefix(item.barangay));
              return !q || bNorm.includes(q);
            })
            .slice(0, limit);

          if (remoteList.length > 0) {
            apiCache.set(cacheKey, remoteList);
            return { data: remoteList, source: "api", error: null };
          }
        }
      }
    } catch {
      // Remote lookup failed or timed out — silently fallback to local
    }
  }

  return { data: localResults, source: "local", error: null };
}

/**
 * Searches cities with optional online PSGC query and local instant fallback.
 */
export async function fetchCities(query, { province } = {}, limit = 8) {
  const localResults = localSearchCities(query, { province }, limit);
  return { data: localResults, source: "local", error: null };
}

/**
 * Searches provinces.
 */
export function fetchProvinces(query, limit = 8) {
  return localSearchProvinces(query, limit);
}

export {
  PH_PROVINCES,
  PH_CITIES_BY_PROVINCE,
  localSearchBarangays as searchBarangays,
  localSearchCities as searchCities,
  localSearchProvinces as searchProvinces,
  localGetBarangaysForCity as getBarangaysForCity,
  localFindProvinceForCity as findProvinceForCity,
  localFindCityForBarangay as findCityForBarangay,
};

