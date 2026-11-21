import { useEffect, useState } from "react";

/** A clock that moves every minute, so "Atualizado há 2 min" and the São Paulo month never go stale. */
export function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);
  return now;
}
