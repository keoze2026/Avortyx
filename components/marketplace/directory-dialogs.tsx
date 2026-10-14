"use client";

/**
 * Staff-only dialogs for the Marketplace → Services directory:
 *   ServiceFormDialog   add / edit one partner website
 *   CategoriesDialog    add, rename, reorder and delete categories
 *   ConfirmDelete       shared "are you sure" prompt
 */

import { useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2, Plus, Save, Trash2, X } from "lucide-react";
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
import { friendlyErrorMessage } from "@/lib/api/errors";
import {
  marketplaceDirectoryService,
  type MarketplaceService,
  type ServiceCategory,
} from "@/lib/api/services/marketplace-directory.service";

const LOGO_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
const LOGO_MAX_BYTES = 1024 * 1024; // 1 MB

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
  const editing = !!service;
  const [categoryId, setCategoryId] = useState("");
  const [name, setName] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [description, setDescription] = useState("");
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
      toast.error("Logo must be PNG, JPG, WEBP or SVG.");
      return;
    }
    if (file.size > LOGO_MAX_BYTES) {
      toast.error("Logo must be 1 MB or smaller.");
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
    if (!categoryId) return toast.error("Pick a category.");
    if (!name.trim()) return toast.error("Enter the service name.");
    if (!isValidUrl(url)) return toast.error("Enter a full website link starting with https://");

    setSaving(true);
    try {
      await marketplaceDirectoryService.saveService(service?.id, {
        categoryId,
        name: name.trim(),
        websiteUrl: url,
        description: description.trim(),
        sortOrder: Number(sortOrder) || 0,
        isActive,
        logoFile,
        removeLogo: removeLogo && !logoFile,
      });
      toast.success(editing ? "Service updated" : "Service added");
      onSaved();
      onOpenChange(false);
    } catch (e) {
      toast.error(friendlyErrorMessage(e, "Couldn't save the service"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit service" : "Add service"}</DialogTitle>
          <DialogDescription>
            Listed in Marketplace → Services for every user.
          </DialogDescription>
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
                  {logoPreview ? "Change logo" : "Upload logo"}
                </Button>
                {logoPreview && (
                  <Button type="button" size="sm" variant="ghost" onClick={clearLogo}>
                    <X className="h-3.5 w-3.5" />
                    Remove
                  </Button>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">PNG, JPG, WEBP or SVG, up to 1 MB.</p>
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
              <Label>Category</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger>
                  <SelectValue placeholder="Pick a category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="svc-name">Name</Label>
              <Input
                id="svc-name"
                value={name}
                maxLength={120}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Adsterra"
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="svc-url">Website link</Label>
            <Input
              id="svc-url"
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
              placeholder="https://example.com"
              inputMode="url"
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="svc-desc">Description</Label>
            <Textarea
              id="svc-desc"
              value={description}
              maxLength={1000}
              rows={4}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What this service offers our users."
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="svc-order">Position</Label>
              <Input
                id="svc-order"
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">Lower numbers show first.</p>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
              <div>
                <p className="text-sm font-medium">Visible to users</p>
                <p className="text-[11px] text-muted-foreground">Off hides it from users.</p>
              </div>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={saving}>
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {editing ? "Save changes" : "Add service"}
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
  const [rows, setRows] = useState<Row[]>([]);
  const [newName, setNewName] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<ServiceCategory | null>(null);

  useEffect(() => {
    if (open) {
      setRows(categories.map((c) => ({ id: c.id, name: c.name, sortOrder: String(c.sortOrder) })));
      setNewName("");
    }
  }, [open, categories]);

  async function save(row: Row) {
    if (!row.name.trim()) return toast.error("Category name can't be empty.");
    setBusyId(row.id);
    try {
      await marketplaceDirectoryService.saveCategory({
        id: row.id,
        name: row.name.trim(),
        sortOrder: Number(row.sortOrder) || 0,
      });
      toast.success("Category saved");
      onChanged();
    } catch (e) {
      toast.error(friendlyErrorMessage(e, "Couldn't save the category"));
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
      toast.success("Category added");
      setNewName("");
      onChanged();
    } catch (e) {
      toast.error(friendlyErrorMessage(e, "Couldn't add the category"));
    } finally {
      setBusyId(null);
    }
  }

  async function remove(cat: ServiceCategory) {
    setBusyId(cat.id);
    try {
      await marketplaceDirectoryService.deleteCategory(cat.id);
      toast.success("Category deleted");
      onChanged();
    } catch (e) {
      toast.error(friendlyErrorMessage(e, "Couldn't delete the category"));
    } finally {
      setBusyId(null);
      setToDelete(null);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Categories</DialogTitle>
            <DialogDescription>
              Sections on the Services tab, e.g. Ad Networks or Hosting &amp; Proxies.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-2">
            {rows.length === 0 && (
              <p className="py-2 text-sm text-muted-foreground">No categories yet. Add the first one below.</p>
            )}
            {rows.map((row, i) => {
              const original = categories.find((c) => c.id === row.id);
              const dirty =
                !!original &&
                (original.name !== row.name || String(original.sortOrder) !== row.sortOrder);
              return (
                <div key={row.id} className="grid grid-cols-[1fr_4.5rem_auto_auto] items-center gap-2">
                  <Input
                    value={row.name}
                    maxLength={80}
                    onChange={(e) =>
                      setRows((r) => r.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))
                    }
                  />
                  <Input
                    type="number"
                    aria-label="Position"
                    value={row.sortOrder}
                    onChange={(e) =>
                      setRows((r) => r.map((x, j) => (j === i ? { ...x, sortOrder: e.target.value } : x)))
                    }
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Save category"
                    disabled={!dirty || busyId === row.id}
                    onClick={() => void save(row)}
                  >
                    {busyId === row.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Delete category"
                    disabled={busyId === row.id}
                    onClick={() => original && setToDelete(original)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              );
            })}
          </div>

          <div className="flex gap-2 border-t pt-4">
            <Input
              value={newName}
              maxLength={80}
              placeholder="New category name"
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void add()}
            />
            <Button onClick={() => void add()} disabled={!newName.trim() || busyId === "new"}>
              {busyId === "new" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              Add
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDelete
        open={!!toDelete}
        title={`Delete "${toDelete?.name ?? ""}"?`}
        description={
          toDelete && countFor(toDelete.id) > 0
            ? `This also deletes its ${countFor(toDelete.id)} service(s). This can't be undone.`
            : "This can't be undone."
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
  return (
    <AlertDialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-destructive text-white hover:bg-destructive/90"
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
