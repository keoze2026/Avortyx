"use client";

/**
 * KYC page — real verification flow bound to /api/kyc/*.
 *
 * Flow:
 *   1. On mount, GET /api/kyc/ to see if a submission already exists.
 *   2. If status is `submitted`, render the "under review" state.
 *   3. If status is `approved`, render the approved confirmation.
 *   4. If status is `rejected` (or no submission), render the form so the
 *      user can submit (or resubmit) their KYC.
 *
 * Documents (gov ID for individuals, business registration for companies)
 * are uploaded first via POST /api/kyc/documents/upload — the returned URL
 * is then carried in the submission body. No mocks, no simulated flows.
 */

import * as React from "react";
import {
  Building2,
  CheckCircle2,
  Clock,
  Loader2,
  ScanFace,
  Upload,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  kycService,
  type KycDocumentType,
  type KycSubmission,
} from "@/lib/api/services/kyc.service";
import { useOnboardingStore } from "@/lib/store/onboarding-store";
import { cn } from "@/lib/utils";
import { formatLocalDateTime } from "@/lib/format";
import { useTranslation } from "@/hooks/use-translation";
import { countryLabel } from "@/components/numbers/country-label";
import { tFor } from "@/lib/i18n";
import { useLocaleStore } from "@/lib/store/locale-store";

type KycMode = "individual" | "company";

interface UploadedDoc {
  fileName: string;
  url: string;
}

export default function KycPage() {
  const { t } = useTranslation();
  const refreshOnboarding = useOnboardingStore((s) => s.refresh);

  const [loading, setLoading] = React.useState(true);
  const [submission, setSubmission] = React.useState<KycSubmission | null>(null);
  const [mode, setMode] = React.useState<KycMode>("individual");

  // Individual fields
  const [fullLegalName, setFullLegalName] = React.useState("");
  const [dateOfBirth, setDateOfBirth] = React.useState("");
  const [governmentId, setGovernmentId] = React.useState<UploadedDoc | null>(null);

  // Company fields
  const [companyLegalName, setCompanyLegalName] = React.useState("");
  const [businessRegistrationNumber, setBusinessRegistrationNumber] = React.useState("");
  const [taxId, setTaxId] = React.useState("");
  const [directorName, setDirectorName] = React.useState("");
  const [businessRegistrationDoc, setBusinessRegistrationDoc] =
    React.useState<UploadedDoc | null>(null);

  // Shared fields
  const [country, setCountry] = React.useState("");
  const [address, setAddress] = React.useState("");
  const [phoneNumber, setPhoneNumber] = React.useState("");

  const [submitting, setSubmitting] = React.useState(false);

  const loadSubmission = React.useCallback(async () => {
    setLoading(true);
    try {
      const current = await kycService.get();
      const locale = useLocaleStore.getState().locale;
      setSubmission(current);
      if (current) {
        setMode(current.kycType);
        setCountry(current.country);
        setAddress(current.address);
        setPhoneNumber(current.phoneNumber);
        setFullLegalName(current.fullLegalName ?? "");
        setDateOfBirth(current.dateOfBirth ?? "");
        setCompanyLegalName(current.companyLegalName ?? "");
        setBusinessRegistrationNumber(current.businessRegistrationNumber ?? "");
        setTaxId(current.taxId ?? "");
        setDirectorName(current.directorName ?? "");
        if (current.governmentIdUrl) {
          setGovernmentId({ fileName: tFor(locale, "x2.kyc.previouslyUploaded"), url: current.governmentIdUrl });
        }
        if (current.businessRegistrationDocUrl) {
          setBusinessRegistrationDoc({
            fileName: tFor(locale, "x2.kyc.previouslyUploaded"),
            url: current.businessRegistrationDocUrl,
          });
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : tFor(useLocaleStore.getState().locale, "x2.kyc.loadFailed");
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadSubmission();
  }, [loadSubmission]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    if (mode === "individual") {
      if (!fullLegalName.trim() || !dateOfBirth || !country.trim() || !address.trim() || !phoneNumber.trim()) {
        toast.error(t("x2.kyc.fillEveryField"));
        return;
      }
      if (!governmentId) {
        toast.error(t("x2.kyc.uploadGovIdRequired"));
        return;
      }
    } else {
      if (
        !companyLegalName.trim() ||
        !businessRegistrationNumber.trim() ||
        !taxId.trim() ||
        !directorName.trim() ||
        !country.trim() ||
        !address.trim() ||
        !phoneNumber.trim()
      ) {
        toast.error(t("x2.kyc.fillEveryField"));
        return;
      }
      if (!businessRegistrationDoc) {
        toast.error(t("x2.kyc.uploadBizRegRequired"));
        return;
      }
    }

    setSubmitting(true);
    try {
      const fresh =
        mode === "individual"
          ? await kycService.submitIndividual({
              fullLegalName: fullLegalName.trim(),
              dateOfBirth,
              country: country.trim(),
              address: address.trim(),
              phoneNumber: phoneNumber.trim(),
              governmentIdUrl: governmentId!.url,
            })
          : await kycService.submitCompany({
              companyLegalName: companyLegalName.trim(),
              businessRegistrationNumber: businessRegistrationNumber.trim(),
              taxId: taxId.trim(),
              country: country.trim(),
              address: address.trim(),
              phoneNumber: phoneNumber.trim(),
              directorName: directorName.trim(),
              businessRegistrationDocUrl: businessRegistrationDoc!.url,
            });
      setSubmission(fresh);
      toast.success(t("x2.kyc.submissionReceived"));
      // The onboarding gate keys on KYC status; refresh so the gate
      // re-evaluates once the backend approves the submission.
      void refreshOnboarding();
    } catch (e) {
      const msg = e instanceof Error ? e.message : t("x2.kyc.submissionFailed");
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <>
        <PageHeader title={t("x2.kyc.title")} description={t("x2.kyc.subtitle")} />
        <Card>
          <CardContent className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t("x2.kyc.loadingStatus")}
          </CardContent>
        </Card>
      </>
    );
  }

  // ── Terminal states (submitted / approved) ─────────────────────────
  if (submission?.status === "submitted") {
    return (
      <>
        <PageHeader title={t("x2.kyc.title")} description={t("x2.kyc.subtitle")} />
        <StatusCard
          icon={Clock}
          tone="warning"
          title={t("x2.kyc.underReviewTitle")}
          description={t("x2.kyc.underReviewDesc")}
          submittedAt={submission.submittedAt}
        />
      </>
    );
  }

  if (submission?.status === "approved") {
    return (
      <>
        <PageHeader title={t("x2.kyc.title")} description={t("x2.kyc.verifiedSubtitle")} />
        <StatusCard
          icon={CheckCircle2}
          tone="success"
          title={t("x2.kyc.verifiedTitle")}
          description={t("x2.kyc.approvedDesc")}
          reviewedAt={submission.reviewedAt}
        />
      </>
    );
  }

  // ── Form (no submission, draft, rejected, or expired) ──────────────
  return (
    <>
      <PageHeader
        title={t("x2.kyc.title")}
        description={t("x2.kyc.formSubtitle")}
      />

      {submission?.status === "rejected" && submission.rejectionReason && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="flex items-start gap-3 p-4">
            <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
            <div>
              <h3 className="text-sm font-semibold text-destructive">{t("x2.kyc.previousRejected")}</h3>
              <p className="mt-1 text-xs text-muted-foreground">{submission.rejectionReason}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t("x2.kyc.correctAndResubmit")}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <form onSubmit={onSubmit} className="space-y-6">
        {/* Mode picker — individual vs company */}
        <Card>
          <CardContent className="p-4">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              {t("x2.kyc.submissionType")}
            </Label>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <ModeCard
                selected={mode === "individual"}
                onClick={() => setMode("individual")}
                icon={ScanFace}
                title={t("x2.kyc.individual")}
                description={t("x2.kyc.individualDesc")}
              />
              <ModeCard
                selected={mode === "company"}
                onClick={() => setMode("company")}
                icon={Building2}
                title={t("x2.kyc.company")}
                description={t("x2.kyc.companyDesc")}
              />
            </div>
          </CardContent>
        </Card>

        {/* Type-specific fields */}
        <Card>
          <CardContent className="space-y-4 p-4">
            <h3 className="text-sm font-semibold">
              {mode === "individual" ? t("x2.kyc.personalDetails") : t("x2.kyc.companyDetails")}
            </h3>

            {mode === "individual" ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field
                  id="full-legal-name"
                  label={t("x2.kyc.fullLegalName")}
                  value={fullLegalName}
                  onChange={setFullLegalName}
                  required
                />
                <Field
                  id="date-of-birth"
                  label={t("x2.kyc.dateOfBirth")}
                  type="date"
                  value={dateOfBirth}
                  onChange={setDateOfBirth}
                  required
                />
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field
                  id="company-legal-name"
                  label={t("x2.kyc.legalCompanyName")}
                  value={companyLegalName}
                  onChange={setCompanyLegalName}
                  required
                />
                <Field
                  id="director-name"
                  label={t("x2.kyc.director")}
                  value={directorName}
                  onChange={setDirectorName}
                  required
                />
                <Field
                  id="business-registration-number"
                  label={t("x2.kyc.businessRegNumber")}
                  value={businessRegistrationNumber}
                  onChange={setBusinessRegistrationNumber}
                  required
                />
                <Field
                  id="tax-id"
                  label={t("x2.kyc.taxId")}
                  value={taxId}
                  onChange={setTaxId}
                  required
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Address + contact */}
        <Card>
          <CardContent className="space-y-4 p-4">
            <h3 className="text-sm font-semibold">{t("x2.kyc.addressContact")}</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field
                id="country"
                label={t("trafficUI.common.country")}
                value={country}
                onChange={setCountry}
                placeholder={countryLabel("United States")}
                required
              />
              <Field
                id="phone"
                label={t("authUI.signup.labelPhone")}
                type="tel"
                value={phoneNumber}
                onChange={setPhoneNumber}
                placeholder="+1 555 123 4567"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="address">{t("x2.kyc.address")}</Label>
              <Textarea
                id="address"
                rows={2}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder={t("x2.kyc.addressPlaceholder")}
                required
              />
            </div>
          </CardContent>
        </Card>

        {/* Document upload */}
        <Card>
          <CardContent className="space-y-3 p-4">
            <h3 className="text-sm font-semibold">
              {mode === "individual" ? t("x2.kyc.govId") : t("x2.kyc.bizRegCert")}
            </h3>
            <p className="text-xs text-muted-foreground">
              {mode === "individual"
                ? t("x2.kyc.govIdHint")
                : t("x2.kyc.bizRegHint")}
            </p>

            <DocumentUploader
              accept="image/*,application/pdf"
              documentType={mode === "individual" ? "government_id" : "business_registration"}
              uploaded={mode === "individual" ? governmentId : businessRegistrationDoc}
              onUploaded={(doc) =>
                mode === "individual" ? setGovernmentId(doc) : setBusinessRegistrationDoc(doc)
              }
              onClear={() =>
                mode === "individual" ? setGovernmentId(null) : setBusinessRegistrationDoc(null)
              }
            />
          </CardContent>
        </Card>

        <div className="flex items-center justify-end gap-3">
          <Button type="submit" size="lg" disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("x2.kyc.submitting")}
              </>
            ) : submission?.status === "rejected" ? (
              t("x2.kyc.resubmit")
            ) : (
              t("x2.kyc.submit")
            )}
          </Button>
        </div>
      </form>
    </>
  );
}

/* ────────────────────────────────────────────────────────────────── */

function ModeCard({
  selected,
  onClick,
  icon: Icon,
  title,
  description,
}: {
  selected: boolean;
  onClick: () => void;
  icon: typeof ScanFace;
  title: string;
  description: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-start gap-3 rounded-xl border p-3 text-left transition-colors",
        selected
          ? "border-accent/60 bg-accent/10 ring-1 ring-accent/40"
          : "border-border bg-secondary/30 hover:border-border/80",
      )}
    >
      <span
        className={cn(
          "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
          selected ? "bg-accent/15 text-accent" : "bg-background text-muted-foreground",
        )}
      >
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <div className="text-sm font-semibold">{title}</div>
        <div className="mt-0.5 text-[11px] text-muted-foreground">{description}</div>
      </div>
    </button>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  type = "text",
  required,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (next: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
      />
    </div>
  );
}

function DocumentUploader({
  accept,
  documentType,
  uploaded,
  onUploaded,
  onClear,
}: {
  accept: string;
  documentType: KycDocumentType;
  uploaded: UploadedDoc | null;
  onUploaded: (doc: UploadedDoc) => void;
  onClear: () => void;
}) {
  const { t } = useTranslation();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = React.useState(false);

  const handleFile = async (file: File) => {
    setUploading(true);
    try {
      const { url } = await kycService.uploadDocument(file, documentType);
      onUploaded({ fileName: file.name, url });
      toast.success(t("x2.kyc.fileUploaded").replace("{name}", file.name));
    } catch (e) {
      const msg = e instanceof Error ? e.message : t("x2.kyc.uploadFailed");
      toast.error(msg);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  if (uploaded) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-secondary/20 p-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-accent/10 text-accent">
            <CheckCircle2 className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{uploaded.fileName}</div>
            <a
              href={uploaded.url}
              target="_blank"
              rel="noreferrer"
              className="truncate text-[11px] text-accent hover:underline"
            >
              {t("x2.kyc.viewUploaded")}
            </a>
          </div>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={onClear}>
          {t("settings.profileSection.replace")}
        </Button>
      </div>
    );
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-secondary/10 p-8 text-center transition-colors hover:border-accent/50 hover:bg-accent/5 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {uploading ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            <span className="text-xs text-muted-foreground">{t("x2.kyc.uploading")}</span>
          </>
        ) : (
          <>
            <Upload className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm font-medium">{t("x2.kyc.clickToUpload")}</span>
            <span className="text-[11px] text-muted-foreground">{t("x2.kyc.fileTypes")}</span>
          </>
        )}
      </button>
    </>
  );
}

function StatusCard({
  icon: Icon,
  tone,
  title,
  description,
  submittedAt,
  reviewedAt,
}: {
  icon: typeof Clock;
  tone: "success" | "warning";
  title: string;
  description: string;
  submittedAt?: number;
  reviewedAt?: number;
}) {
  const { t } = useTranslation();
  const toneClasses =
    tone === "success"
      ? "border-[color:var(--success)]/40 bg-[color:var(--success)]/5 text-[color:var(--success)]"
      : "border-[color:var(--warning)]/40 bg-[color:var(--warning)]/5 text-[color:var(--warning)]";

  return (
    <Card className={cn("border", toneClasses)}>
      <CardContent className="flex items-start gap-4 p-6">
        <span className={cn("inline-flex h-12 w-12 items-center justify-center rounded-xl", toneClasses)}>
          <Icon className="h-6 w-6" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          {(submittedAt || reviewedAt) && (
            <p className="mt-3 font-mono text-[11px] text-muted-foreground">
              {submittedAt && <>{t("x2.kyc.submittedAt").replace("{date}", formatLocalDateTime(submittedAt))}</>}
              {submittedAt && reviewedAt && " · "}
              {reviewedAt && <>{t("x2.kyc.reviewedAt").replace("{date}", formatLocalDateTime(reviewedAt))}</>}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
