import { useEffect, useRef, useState } from "react";

const BASE = (import.meta.env.VITE_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
const KEY = import.meta.env.VITE_API_KEY || "";

export async function api(path, options = {}) {
  const res = await fetch(BASE + path, {
    ...options,
    headers: { "Content-Type": "application/json", "X-API-Key": KEY, ...(options.headers || {}) },
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

/** Calls fn() now and then every `ms` milliseconds. Returns { data, error, reload }. */
export function usePoll(fn, ms = 3000, deps = []) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const load = async () => {
    try {
      setData(await fnRef.current());
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  };

  useEffect(() => {
    load();
    const id = setInterval(load, ms);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ms, ...deps]);

  return { data, error, reload: load };
}

export const fmtTime = (iso) => (iso ? new Date(iso).toLocaleTimeString() : "-");
export const fmtAge = (s) => (s == null ? "-" : s < 60 ? `${s}s ago` : `${Math.round(s / 60)} min ago`);
