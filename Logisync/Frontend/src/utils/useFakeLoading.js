import { useEffect, useState } from "react";

// Mock "loading" para makita ang skeleton. Alisin/palitan ng totoong loading state kapag API na ang source.
export function useFakeLoading(ms = 450) {
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setLoading(false), ms);
    return () => clearTimeout(t);
  }, [ms]);
  return loading;
}
