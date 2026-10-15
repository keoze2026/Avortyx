/**
 * Marketplace → Services directory — /api/marketplace/*.
 *
 * Partner websites (ad networks, hosting, proxies...) that platform staff list
 * for every user to browse, like the "Marketplace" of a payments wallet:
 * categories with a count, logo cards, "More details", "My services".
 * Everyone can read; only staff / superusers write.
 *
 *   GET    /api/marketplace/services                 → { categories, services }
 *   POST   /api/marketplace/categories               JSON { name, sort_order, name_translations }
 *   PATCH  /api/marketplace/categories/{id}          JSON (same fields, all optional)
 *   DELETE /api/marketplace/categories/{id}
 *   POST   /api/marketplace/services                 multipart (see toForm)  - create
 *   POST   /api/marketplace/services/{id}            multipart (see toForm)  - update
 *   DELETE /api/marketplace/services/{id}
 *   POST   /api/marketplace/services/{id}/favorite   add to "My services"
 *   DELETE /api/marketplace/services/{id}/favorite   remove from "My services"
 *
 * Updates go by POST, not PATCH: Django only reads multipart (the logo file)
 * on POST, so a PATCH with a logo would arrive empty.
 *
 * Until the backend ships these (404 / 405), the directory runs in "local"
 * mode: staff edits are kept in this browser only so the screen can be
 * reviewed, and the page shows a notice saying so. As soon as
 * GET /api/marketplace/services answers, everything switches to the server
 * by itself. See BACKEND-MARKETPLACE-SERVICES.md.
 */

import { http } from "@/lib/api/http";
import { ApiError } from "@/lib/api/errors";
import { API_BASE_URL } from "@/lib/api/env";

/** Text in the other portal languages; English is the main field. */
export type Translations = Partial<Record<"zh" | "ja" | "ru", string>>;

export interface ServiceCategory {
  id: string;
  name: string;
  sortOrder: number;
  /** The category name in Chinese / Japanese / Russian (optional). */
  nameTranslations?: Translations;
}

export interface MarketplaceService {
  id: string;
  categoryId: string;
  name: string;
  description: string;
  /** The description in Chinese / Japanese / Russian (optional). */
  descriptionTranslations?: Translations;
  websiteUrl: string;
  logoUrl?: string;
  /** Hidden services are only returned to staff. */
  isActive: boolean;
  sortOrder: number;
  /** In this user's "My services". */
  isFavorite?: boolean;
}

export interface Directory {
  categories: ServiceCategory[];
  services: MarketplaceService[];
  /** True when the backend endpoints are missing and data is browser-local. */
  local: boolean;
}

export interface ServiceInput {
  categoryId: string;
  name: string;
  description: string;
  descriptionTranslations?: Translations;
  websiteUrl: string;
  isActive: boolean;
  sortOrder: number;
  /** New logo file. Omit to keep the current logo. */
  logoFile?: File | null;
  /** Set true to remove the current logo. */
  removeLogo?: boolean;
}

/** The text for the chosen language, falling back to the English field. */
export function pickTranslation(main: string, translations: Translations | undefined, locale: string): string {
  if (locale === "en" || !translations) return main;
  const t = translations[locale as keyof Translations];
  return t && t.trim() ? t : main;
}

/* ─── local fallback ──────────────────────────────────────────────────── */

const LOCAL_KEY = "avortyx.marketplace.directory.v1";
const LOCAL_FAVORITES_KEY = "avortyx.marketplace.favorites.v1";

function readLocal(): Omit<Directory, "local"> {
  try {
    const raw = window.localStorage.getItem(LOCAL_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Omit<Directory, "local">;
      if (Array.isArray(parsed.categories) && Array.isArray(parsed.services)) return parsed;
    }
  } catch {
    /* storage unavailable or corrupt: start empty */
  }
  return { categories: [], services: [] };
}

function writeLocal(data: Omit<Directory, "local">) {
  try {
    window.localStorage.setItem(LOCAL_KEY, JSON.stringify(data));
  } catch {
    /* quota or private mode: edits last until reload */
  }
}

function readLocalFavorites(): Set<string> {
  try {
    const raw = window.localStorage.getItem(LOCAL_FAVORITES_KEY);
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    return new Set(Array.isArray(list) ? list.map(String) : []);
  } catch {
    return new Set();
  }
}

function writeLocalFavorites(ids: Set<string>) {
  try {
    window.localStorage.setItem(LOCAL_FAVORITES_KEY, JSON.stringify([...ids]));
  } catch {
    /* private mode: lasts until reload */
  }
}

function newId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

let localMode = false;

function isMissingEndpoint(e: unknown) {
  return e instanceof ApiError && (e.status === 404 || e.status === 405);
}

/* ─── wire ────────────────────────────────────────────────────────────── */

interface DirectoryWire {
  categories?: ServiceCategory[];
  services?: MarketplaceService[];
}

/** Only the languages that were filled in. */
function cleanTranslations(t: Translations | undefined): Translations {
  const out: Translations = {};
  for (const k of ["zh", "ja", "ru"] as const) {
    const v = t?.[k]?.trim();
    if (v) out[k] = v;
  }
  return out;
}

function toForm(input: ServiceInput): FormData {
  const f = new FormData();
  f.append("category_id", input.categoryId);
  f.append("name", input.name);
  f.append("description", input.description);
  // JSON text: { "zh": "...", "ja": "...", "ru": "..." } - only filled languages.
  f.append("description_translations", JSON.stringify(cleanTranslations(input.descriptionTranslations)));
  f.append("website_url", input.websiteUrl);
  f.append("is_active", input.isActive ? "true" : "false");
  f.append("sort_order", String(input.sortOrder));
  if (input.logoFile) f.append("logo", input.logoFile);
  if (input.removeLogo) f.append("remove_logo", "true");
  return f;
}

/** The backend may return `/media/...`; images need the API origin. */
function absolute(url?: string | null): string | undefined {
  if (!url) return undefined;
  return url.startsWith("/") ? `${API_BASE_URL}${url}` : url;
}

function fromWire(s: MarketplaceService): MarketplaceService {
  return {
    ...s,
    description: s.description ?? "",
    descriptionTranslations: s.descriptionTranslations ?? {},
    isActive: s.isActive !== false,
    isFavorite: s.isFavorite === true,
    logoUrl: absolute(s.logoUrl),
  };
}

function sortDirectory(d: Omit<Directory, "local">): Omit<Directory, "local"> {
  const byOrder = <T extends { sortOrder: number; name: string }>(a: T, b: T) =>
    a.sortOrder - b.sortOrder || a.name.localeCompare(b.name);
  return {
    categories: [...d.categories].sort(byOrder),
    services: [...d.services].sort(byOrder),
  };
}

/* ─── service ─────────────────────────────────────────────────────────── */

export const marketplaceDirectoryService = {
  async load(): Promise<Directory> {
    try {
      const res = await http.get<DirectoryWire>("/api/marketplace/services");
      localMode = false;
      return {
        ...sortDirectory({
          categories: (res?.categories ?? []).map((c) => ({ ...c, nameTranslations: c.nameTranslations ?? {} })),
          services: (res?.services ?? []).map(fromWire),
        }),
        local: false,
      };
    } catch (e) {
      if (!isMissingEndpoint(e)) throw e;
      localMode = true;
      const favorites = readLocalFavorites();
      const local = readLocal();
      return {
        ...sortDirectory({
          categories: local.categories,
          services: local.services.map((s) => ({ ...s, isFavorite: favorites.has(s.id) })),
        }),
        local: true,
      };
    }
  },

  /**
   * Is this login platform staff (is_staff / is_superuser) on the server?
   *
   * /api/accounts/me does not send those two flags yet (its response schema
   * leaves them out), so the portal can't tell staff from anyone else and
   * never showed the staff controls or the hidden services. Until /me sends
   * them, ask the marketplace itself: a staff-only edit of a category that
   * doesn't exist. Staff get 404 (nothing to edit, nothing changed); everyone
   * else gets 403. Nothing is ever written.
   */
  async isStaff(): Promise<boolean> {
    if (localMode) return false;
    try {
      await http.patch("/api/marketplace/categories/00000000-0000-0000-0000-000000000000", { body: {} });
      return true; // cannot happen (the id doesn't exist), but would mean staff
    } catch (e) {
      return e instanceof ApiError && e.status === 404;
    }
  },

  async saveCategory(input: {
    id?: string;
    name: string;
    sortOrder: number;
    nameTranslations?: Translations;
  }): Promise<ServiceCategory> {
    const nameTranslations = cleanTranslations(input.nameTranslations);
    if (localMode) {
      const d = readLocal();
      const cat: ServiceCategory = { id: input.id ?? newId(), name: input.name, sortOrder: input.sortOrder, nameTranslations };
      d.categories = input.id
        ? d.categories.map((c) => (c.id === input.id ? cat : c))
        : [...d.categories, cat];
      writeLocal(d);
      return cat;
    }
    // The http layer sends keys in snake_case; the language codes inside the
    // translations object have no capitals, so they arrive unchanged.
    const body = { name: input.name, sortOrder: input.sortOrder, nameTranslations };
    return input.id
      ? http.patch<ServiceCategory>(`/api/marketplace/categories/${input.id}`, { body })
      : http.post<ServiceCategory>("/api/marketplace/categories", { body });
  },

  async deleteCategory(id: string): Promise<void> {
    if (localMode) {
      const d = readLocal();
      d.categories = d.categories.filter((c) => c.id !== id);
      d.services = d.services.filter((s) => s.categoryId !== id);
      writeLocal(d);
      return;
    }
    await http.delete(`/api/marketplace/categories/${id}`);
  },

  async saveService(id: string | undefined, input: ServiceInput): Promise<MarketplaceService> {
    if (localMode) {
      const d = readLocal();
      const prev = id ? d.services.find((s) => s.id === id) : undefined;
      let logoUrl = input.removeLogo ? undefined : prev?.logoUrl;
      if (input.logoFile) logoUrl = await fileToDataUrl(input.logoFile);
      const svc: MarketplaceService = {
        id: id ?? newId(),
        categoryId: input.categoryId,
        name: input.name,
        description: input.description,
        descriptionTranslations: cleanTranslations(input.descriptionTranslations),
        websiteUrl: input.websiteUrl,
        isActive: input.isActive,
        sortOrder: input.sortOrder,
        logoUrl,
      };
      d.services = id ? d.services.map((s) => (s.id === id ? svc : s)) : [...d.services, svc];
      writeLocal(d);
      return svc;
    }
    const body = toForm(input);
    // Create and update are both POST (multipart is only parsed on POST).
    const saved = await http.post<MarketplaceService>(
      id ? `/api/marketplace/services/${id}` : "/api/marketplace/services",
      { body },
    );
    return fromWire(saved);
  },

  async deleteService(id: string): Promise<void> {
    if (localMode) {
      const d = readLocal();
      d.services = d.services.filter((s) => s.id !== id);
      writeLocal(d);
      return;
    }
    await http.delete(`/api/marketplace/services/${id}`);
  },

  /** Add to / remove from this user's "My services". */
  async setFavorite(id: string, favorite: boolean): Promise<void> {
    if (localMode) {
      const ids = readLocalFavorites();
      if (favorite) ids.add(id);
      else ids.delete(id);
      writeLocalFavorites(ids);
      return;
    }
    if (favorite) await http.post(`/api/marketplace/services/${id}/favorite`);
    else await http.delete(`/api/marketplace/services/${id}/favorite`);
  },
};
