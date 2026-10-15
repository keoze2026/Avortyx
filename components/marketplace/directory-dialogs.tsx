"use client";

/**
 * Staff-only dialogs for the Marketplace → Services directory:
 *   ServiceFormDialog   add / edit one partner website (logo, link, description
 *                       and, optionally, the description in zh / ja / ru)
 *   CategoriesDialog    add, rename, reorder, translate and delete categories
 *   ConfirmDelete       shared "are you sure" prompt
 */

import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, ImagePlus, Languages, Loader2, Plus, Save, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useTranslation } from "@/hooks/use-translation";
import { friendlyErrorMessage } from "@/lib/api/errors";
import {
  marketplaceDirectoryService,
  pickTranslation,
  type MarketplaceService,
  type ServiceCategory,
  type Translations,
} from "@/lib/api/services/marketplace-directory.service";

const LOGO_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
const LOGO_MAX_BYTES = 1024 * 1024; // 1 MB
const LANGS = ["zh", "ja", "ru"] as const;

function isValidUrl(v: string) {
  try {
    const u = new URL(v);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/* ─── Add / edit service ─────────────────────────────────────────────── */

export function ServiceFormDialog({
  open,
  onOpenChange,
  categories,
  service,
  defaultCategoryId,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: ServiceCategory[];
  /** Present when editing. */
  service?: MarketplaceService | null;
  defaultCategoryId?: string;
  onSaved: () => void;
}) {
  const { t, locale } = useTranslation();
  const editing = !!service;
  const [categoryId, setCategoryId] = useState("");
  const [name, setName] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [description, setDescription] = useState("");
  const [translations, setTranslations] = useState<Translations>({});
  const [showTranslations, setShowTranslations] = useState(false);
  const [sortOrder, setSortOrder] = useState("0");
  const [isActive, setIsActive] = useState(true);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | undefined>();
  const [removeLogo, setRemoveLogo] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Reset the form each time it opens.
  useEffect(() => {
    if (!open) return;
    setCategoryId(service?.categoryId ?? defaultCategoryId ?? categories[0]?.id ?? "");
    setName(service?.name ?? "");
    setWebsiteUrl(service?.websiteUrl ?? "");
    setDescription(service?.description ?? "");
    setTranslations({ ...(service?.descriptionTranslations ?? {}) });
    setShowTranslations(Object.values(service?.descriptionTranslations ?? {}).some((v) => !!v));
    setSortOrder(String(service?.sortOrder ?? 0));
    setIsActive(service?.isActive ?? true);
    setLogoFile(null);
    setLogoPreview(service?.logoUrl);
    setRemoveLogo(false);
  }, [open, service, defaultCategoryId, categories]);

  // Free the object URL made for a picked file.
  useEffect(() => {
    return () => {
      if (logoPreview?.startsWith("blob:")) URL.revokeObjectURL(logoPreview);
    };
  }, [logoPreview]);

  function pickLogo(file: File | undefined) {
    if (!file) return;
    if (!LOGO_TYPES.includes(file.type)) {
      toast.error(t("marketplace.form.logoType"));
      return;
    }
    if (file.size > LOGO_MAX_BYTES) {
      toast.error(t("marketplace.form.logoSize"));
      return;
    }
    setLogoFile(file);
    setRemoveLogo(false);
    setLogoPreview(URL.createObjectURL(file));
  }

  function clearLogo() {
    setLogoFile(null);
    setLogoPreview(undefined);
    setRemoveLogo(true);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function submit() {
    const url = websiteUrl.trim();
    if (!categoryId) return toast.error(t("marketplace.form.needCategory"));
    if (!name.trim()) return toast.error(t("marketplace.form.needName"));
    if (!isValidUrl(url)) return toast.error(t("marketplace.form.needUrl"));

    setSaving(true);
    try {
      await marketplaceDirectoryService.saveService(service?.id, {
        categoryId,
        name: name.trim(),
        websiteUrl: url,
        description: description.trim(),
        descriptionTranslations: translations,
        sortOrder: Number(sortOrder) || 0,
        isActive,
        logoFile,
        removeLogo: removeLogo && !logoFile,
      });
      toast.success(editing ? t("marketplace.form.updated") : t("marketplace.form.added"));
      onSaved();
      onOpenChange(false);
    } catch (e) {
      toast.error(friendlyErrorMessage(e, t("marketplace.form.saveError")));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? t("marketplace.form.editTitle") : t("marketplace.form.addTitle")}</DialogTitle>
          <DialogDescription>{t("marketplace.form.desc")}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          {/* Logo */}
          <div className="flex items-center gap-4">
            <div className="flex h-20 w-32 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-white p-2">
              {logoPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoPreview} alt="" className="max-h-full max-w-full object-contain" />
              ) : (
                <ImagePlus className="h-6 w-6 text-neutral-400" />
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="flex gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
                  {logoPreview ? t("marketplace.form.changeLogo") : t("marketplace.form.uploadLogo")}
                </Button>
                {logoPreview && (
                  <Button type="button" size="sm" variant="ghost" onClick={clearLogo}>
                    <X className="h-3.5 w-3.5" />
                    {t("marketplace.form.remove")}
                  </Button>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">{t("marketplace.form.logoHint")}</p>
              <input
                ref={fileRef}
                type="file"
                accept={LOGO_TYPES.join(",")}
                className="hidden"
                onChange={(e) => pickLogo(e.target.files?.[0])}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>{t("marketplace.form.category")}</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger>
                  <SelectValue placeholder={t("marketplace.form.pickCategory")} />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {pickTranslation(c.name, c.nameTranslations, locale)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="svc-name">{t("marketplace.form.name")}</Label>
              <Input
                id="svc-name"
                value={name}
                maxLength={120}
                onChange={(e) => setName(e.target.value)}
                placeholder="Adsterra"
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="svc-url">{t("marketplace.form.website")}</Label>
            <Input
              id="svc-url"
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
              placeholder="https://example.com/?ref=avortyx"
              inputMode="url"
            />
            <p className="text-[11px] text-muted-foreground">{t("marketplace.form.websiteHint")}</p>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="svc-desc">{t("marketplace.form.description")}</Label>
            <Textarea
              id="svc-desc"
              value={description}
              maxLength={1000}
              rows={4}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("marketplace.form.descriptionPlaceholder")}
            />
          </div>

          {/* Description in the other portal languages (optional). */}
          <div className="rounded-lg border">
            <button
              type="button"
              onClick={() => setShowTranslations((v) => !v)}
              className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm font-medium"
            >
              <span className="inline-flex items-center gap-2">
                <Languages className="h-4 w-4 text-muted-foreground" />
                {t("marketplace.form.translations")}
              </span>
              {showTranslations ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            {showTranslations && (
              <div className="grid gap-3 border-t px-3 py-3">
                <p className="text-[11px] text-muted-foreground">{t("marketplace.form.translationsHint")}</p>
                {LANGS.map((lang) => (
                  <div key={lang} className="grid gap-1.5">
                    <Label htmlFor={`svc-desc-${lang}`} className="text-xs">
                      {t(`marketplace.lang.${lang}`)}
                    </Label>
                    <Textarea
                      id={`svc-desc-${lang}`}
                      value={translations[lang] ?? ""}
                      maxLength={1000}
                      rows={3}
                      onChange={(e) => setTranslations((tr) => ({ ...tr, [lang]: e.target.value }))}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="svc-order">{t("marketplace.form.position")}</Label>
              <Input
                id="svc-order"
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">{t("marketplace.form.positionHint")}</p>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
              <div>
                <p className="text-sm font-medium">{t("marketplace.form.visible")}</p>
                <p className="text-[11px] text-muted-foreground">{t("marketplace.form.visibleHint")}</p>
              </div>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            {t("marketplace.cancel")}
          </Button>
          <Button onClick={() => void submit()} disabled={saving}>
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {editing ? t("marketplace.form.save") : t("marketplace.form.add")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Categories ─────────────────────────────────────────────────────── */

interface Row {
  id: string;
  name: string;
  sortOrder: string;
  nameTranslations: Translations;
}

function sameTranslations(a: Translations | undefined, b: Translations | undefined) {
  return LANGS.every((l) => (a?.[l] ?? "").trim() === (b?.[l] ?? "").trim());
}

export function CategoriesDialog({
  open,
  onOpenChange,
  categories,
  countFor,
  onChanged,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: ServiceCategory[];
  countFor: (categoryId: string) => number;
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  const [rows, setRows] = useState<Row[]>([]);
  const [newName, setNewName] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<ServiceCategory | null>(null);
  const [translating, setTranslating] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setRows(
        categories.map((c) => ({
          id: c.id,
          name: c.name,
          sortOrder: String(c.sortOrder),
          nameTranslations: { ...(c.nameTranslations ?? {}) },
        })),
      );
      setNewName("");
      setTranslating(null);
    }
  }, [open, categories]);

  async function save(row: Row) {
    if (!row.name.trim()) return toast.error(t("marketplace.cat.emptyName"));
    setBusyId(row.id);
    try {
      await marketplaceDirectoryService.saveCategory({
        id: row.id,
        name: row.name.trim(),
        sortOrder: Number(row.sortOrder) || 0,
        nameTranslations: row.nameTranslations,
      });
      toast.success(t("marketplace.cat.saved"));
      onChanged();
    } catch (e) {
      toast.error(friendlyErrorMessage(e, t("marketplace.cat.saveError")));
    } finally {
      setBusyId(null);
    }
  }

  async function add() {
    if (!newName.trim()) return;
    setBusyId("new");
    try {
      const max = categories.reduce((m, c) => Math.max(m, c.sortOrder), 0);
      await marketplaceDirectoryService.saveCategory({ name: newName.trim(), sortOrder: max + 10 });
      toast.success(t("marketplace.cat.added"));
      setNewName("");
      onChanged();
    } catch (e) {
      toast.error(friendlyErrorMessage(e, t("marketplace.cat.addError")));
    } finally {
      setBusyId(null);
    }
  }

  async function remove(cat: ServiceCategory) {
    setBusyId(cat.id);
    try {
      await marketplaceDirectoryService.deleteCategory(cat.id);
      toast.success(t("marketplace.cat.deleted"));
      onChanged();
    } catch (e) {
      toast.error(friendlyErrorMessage(e, t("marketplace.cat.deleteError")));
    } finally {
      setBusyId(null);
      setToDelete(null);
    }
  }

  const deleteCount = toDelete ? countFor(toDelete.id) : 0;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("marketplace.cat.title")}</DialogTitle>
            <DialogDescription>{t("marketplace.cat.desc")}</DialogDescription>
          </DialogHeader>

          <div className="grid gap-2">
            {rows.length === 0 && <p className="py-2 text-sm text-muted-foreground">{t("marketplace.cat.none")}</p>}
            {rows.map((row, i) => {
              const original = categories.find((c) => c.id === row.id);
              const dirty =
                !!original &&
                (original.name !== row.name ||
                  String(original.sortOrder) !== row.sortOrder ||
                  !sameTranslations(original.nameTranslations, row.nameTranslations));
              const update = (patch: Partial<Row>) =>
                setRows((r) => r.map((x, j) => (j === i ? { ...x, ...patch } : x)));
              return (
                <div key={row.id} className="grid gap-2">
                  <div className="grid grid-cols-[1fr_4.5rem_auto_auto_auto] items-center gap-2">
                    <Input value={row.name} maxLength={80} onChange={(e) => update({ name: e.target.value })} />
                    <Input
                      type="number"
                      aria-label={t("marketplace.cat.position")}
                      value={row.sortOrder}
                      onChange={(e) => update({ sortOrder: e.target.value })}
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={t("marketplace.cat.translate")}
                      title={t("marketplace.cat.translate")}
                      onClick={() => setTranslating((id) => (id === row.id ? null : row.id))}
                    >
                      <Languages className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={t("marketplace.cat.save")}
                      disabled={!dirty || busyId === row.id}
                      onClick={() => void save(row)}
                    >
                      {busyId === row.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={t("marketplace.cat.delete")}
                      disabled={busyId === row.id}
                      onClick={() => original && setToDelete(original)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                  {translating === row.id && (
                    <div className="grid gap-2 rounded-lg border bg-secondary/20 p-2 sm:grid-cols-3">
                      {LANGS.map((lang) => (
                        <div key={lang} className="grid gap-1">
                          <Label className="text-[11px] text-muted-foreground">{t(`marketplace.lang.${lang}`)}</Label>
                          <Input
                            value={row.nameTranslations[lang] ?? ""}
                            maxLength={80}
                            onChange={(e) =>
                              update({ nameTranslations: { ...row.nameTranslations, [lang]: e.target.value } })
                            }
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex gap-2 border-t pt-4">
            <Input
              value={newName}
              maxLength={80}
              placeholder={t("marketplace.cat.newName")}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void add()}
            />
            <Button onClick={() => void add()} disabled={!newName.trim() || busyId === "new"}>
              {busyId === "new" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              {t("marketplace.cat.add")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDelete
        open={!!toDelete}
        title={t("marketplace.deleteTitle").replace("{name}", toDelete?.name ?? "")}
        description={
          deleteCount > 0
            ? t("marketplace.cat.deleteWithServices").replace("{n}", String(deleteCount))
            : t("marketplace.cat.deleteSimple")
        }
        onCancel={() => setToDelete(null)}
        onConfirm={() => toDelete && void remove(toDelete)}
      />
    </>
  );
}

/* ─── Confirm ────────────────────────────────────────────────────────── */

export function ConfirmDelete({
  open,
  title,
  description,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { t } = useTranslation();
  return (
    <AlertDialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>{t("marketplace.cancel")}</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} className="bg-destructive text-white hover:bg-destructive/90">
            {t("marketplace.delete")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
