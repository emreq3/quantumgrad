// Runtime configuration. Nothing here is a secret; the app is a static bundle that works from any sub-path.

/** Name shown in the studio intro. Configure with VITE_QTA6_STUDIO; "QTA6 STUDIO" is a neutral original placeholder (the team name is not assumed). */
export const STUDIO_NAME: string = ((import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env?.VITE_QTA6_STUDIO as string | undefined) || "QTA6 STUDIO";

export const REPO_URL = "https://github.com/emreq3/quantumgrad";
export const researchUrl = (ref: string): string => `${REPO_URL}/blob/main/${ref.replace(/^\/+/, "")}`;

const isLocalHost = (): boolean => typeof location !== "undefined" && ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname);

/** Base URL of the optional live-science API. `""` = same origin (dev proxy), `null` = disabled (static hosting). */
export function defaultApiBase(): string | null {
  const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env?.VITE_QTA6_API;
  if (env !== undefined && env !== "") return env.replace(/\/+$/, "");
  return isLocalHost() ? "" : null;
}

export function normalizeApiBase(v: string): string | null {
  const t = v.trim();
  if (!t) return null;
  try {
    const u = new URL(t);
    if (!["http:", "https:"].includes(u.protocol)) return null;
    return u.origin + u.pathname.replace(/\/+$/, "");
  } catch {
    return null;
  }
}

/** Team member names are not recorded anywhere in the repository; list them here when known (shown in Credits). */
export const TEAM_MEMBERS: string[] = [];
export const REPO_OWNER = "emreq3";
