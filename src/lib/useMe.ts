import { useEffect, useState } from "react";

type MeResponse =
  | { user: { username: string } }
  | { user: null };

export function useMe() {
  const [username, setUsername] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/auth/me");
        const data = (await res.json()) as MeResponse;

        setUsername(data.user ? data.user.username : null);
      } catch {
        setUsername(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return { username, loading };
}
