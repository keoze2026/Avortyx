/**
 * Marketplace → Services directory — /api/marketplace/*.
 *
 * Partner websites (ad networks, hosting, proxies...) that platform staff list
 * for every user to browse. Everyone can read; only staff / superusers write.
 *
 *   GET    /api/marketplace/services            → { categories, services }
 *   POST   /api/marketplace/categories          { name, sort_order }
 *   PATCH  /api/marketplace/categories/{id}     { name?, sort_order? }
 *   DELETE /api/marketplace/categories/{id}
 *   POST   /api/marketplace/services            multipart (see toForm)
 *   PATCH  /api/marketplace/services/{id}       multipart (see toForm)
 *   DELETE /api/marketplace/services/{id}
 *
 * Until the backend ships these (404), the directory runs in "local" mode:
 * staff edits are kept in this browser only so the screen can be reviewed,
 * and the page shows a notice saying so. See BACKEND-MARKETPLACE-SERVICES.md.
 */

import { http } from "@/lib/api/http";
import { ApiError } from "@/lib/api/errors";
import { API_BASE_URL } from "@/lib/api/env";

export interface ServiceCategory {
  id: string;
  name: string;
  sortOrder: number;
}

export interface MarketplaceService {
  id: string;
  categoryId: string;
  name: string;
  description: string;
  websiteUrl: string;
  logoUrl?: string;
  /** Hidden services are only returned to staff. */
  isActive: boolean;
  sortOrder: number;
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
  websiteUrl: string;
  isActive: boolean;
  sortOrder: number;
  /** New logo file. Omit to keep the current logo. */
  logoFile?: File | null;
  /** Set true to remove the current logo. */
  removeLogo?: boolean;
}

/* ─── local fallback ──────────────────────────────────────────────────── */

const LOCAL_KEY = "avortyx.marketplace.directory.v1";

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

function toForm(input: ServiceInput): FormData {
  const f = new FormData();
  f.append("category_id", input.categoryId);
  f.append("name", input.name);
  f.append("description", input.description);
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
  return { ...s, isActive: s.isActive !== false, logoUrl: absolute(s.logoUrl) };
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
          categories: res?.categories ?? [],
          services: (res?.services ?? []).map(fromWire),
        }),
        local: false,
      };
    } catch (e) {
      if (!isMissingEndpoint(e)) throw e;
      localMode = true;
      return { ...sortDirectory(readLocal()), local: true };
    }
  },

  async saveCategory(input: { id?: string; name: string; sortOrder: number }): Promise<ServiceCategory> {
    if (localMode) {
      const d = readLocal();
      const cat: ServiceCategory = { id: input.id ?? newId(), name: input.name, sortOrder: input.sortOrder };
      d.categories = input.id
        ? d.categories.map((c) => (c.id === input.id ? cat : c))
        : [...d.categories, cat];
      writeLocal(d);
      return cat;
    }
    const body = { name: input.name, sortOrder: input.sortOrder };
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
    const saved = id
      ? await http.patch<MarketplaceService>(`/api/marketplace/services/${id}`, { body })
      : await http.post<MarketplaceService>("/api/marketplace/services", { body });
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
};
