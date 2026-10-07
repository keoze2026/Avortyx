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

type KycMode = "individual" | "company";

interface UploadedDoc {
  fileName: string;
  url: string;
}

export default function KycPage() {
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
          setGovernmentId({ fileName: "Previously uploaded", url: current.governmentIdUrl });
        }
        if (current.businessRegistrationDocUrl) {
          setBusinessRegistrationDoc({
            fileName: "Previously uploaded",
            url: current.businessRegistrationDocUrl,
          });
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Couldn't load KYC status.";
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
        toast.error("Please fill in every field.");
        return;
      }
      if (!governmentId) {
        toast.error("Upload a copy of your government-issued ID.");
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
        toast.error("Please fill in every field.");
        return;
      }
      if (!businessRegistrationDoc) {
        toast.error("Upload your business registration certificate.");
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
      toast.success("Submission received — our compliance team will review it shortly.");
      // The onboarding gate keys on KYC status; refresh so the gate
      // re-evaluates once the backend approves the submission.
      void refreshOnboarding();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Submission failed.";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <>
        <PageHeader title="Verification" description="Verify your account to unlock call routing." />
        <Card>
          <CardContent className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading verification status…
          </CardContent>
        </Card>
      </>
    );
  }

  // ── Terminal states (submitted / approved) ─────────────────────────
  if (submission?.status === "submitted") {
    return (
      <>
        <PageHeader title="Verification" description="Verify your account to unlock call routing." />
        <StatusCard
          icon={Clock}
          tone="warning"
          title="Submission under review"
          description="Our compliance team is reviewing your KYC submission. Reviews typically complete within one business day."
          submittedAt={submission.submittedAt}
        />
      </>
    );
  }

  if (submission?.status === "approved") {
    return (
      <>
        <PageHeader title="Verification" description="Your account is verified." />
        <StatusCard
          icon={CheckCircle2}
          tone="success"
          title="Verified"
          description="Your KYC submission has been approved. You now have full access to the platform."
          reviewedAt={submission.reviewedAt}
        />
      </>
    );
  }

  // ── Form (no submission, draft, rejected, or expired) ──────────────
  return (
    <>
      <PageHeader
        title="Verification"
        description="Verify your account to unlock call routing. Submissions are reviewed by our compliance team."
      />

      {submission?.status === "rejected" && submission.rejectionReason && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="flex items-start gap-3 p-4">
            <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
            <div>
              <h3 className="text-sm font-semibold text-destructive">Previous submission rejected</h3>
              <p className="mt-1 text-xs text-muted-foreground">{submission.rejectionReason}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Correct the issue below and resubmit to regain access.
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
              Submission type
            </Label>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <ModeCard
                selected={mode === "individual"}
                onClick={() => setMode("individual")}
                icon={ScanFace}
                title="Individual"
                description="Sole operator — verify with a government-issued ID."
              />
              <ModeCard
                selected={mode === "company"}
                onClick={() => setMode("company")}
                icon={Building2}
                title="Company"
                description="Registered business — verify with company registration."
              />
            </div>
          </CardContent>
        </Card>

        {/* Type-specific fields */}
        <Card>
          <CardContent className="space-y-4 p-4">
            <h3 className="text-sm font-semibold">
              {mode === "individual" ? "Personal details" : "Company details"}
            </h3>

            {mode === "individual" ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field
                  id="full-legal-name"
                  label="Full legal name"
                  value={fullLegalName}
                  onChange={setFullLegalName}
                  required
                />
                <Field
                  id="date-of-birth"
                  label="Date of birth"
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
                  label="Legal company name"
                  value={companyLegalName}
                  onChange={setCompanyLegalName}
                  required
                />
                <Field
                  id="director-name"
                  label="Director / authorized officer"
                  value={directorName}
                  onChange={setDirectorName}
                  required
                />
                <Field
                  id="business-registration-number"
                  label="Business registration number"
                  value={businessRegistrationNumber}
                  onChange={setBusinessRegistrationNumber}
                  required
                />
                <Field
                  id="tax-id"
                  label="Tax ID / EIN"
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
            <h3 className="text-sm font-semibold">Address &amp; contact</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field
                id="country"
                label="Country"
                value={country}
                onChange={setCountry}
                placeholder="United States"
                required
              />
              <Field
                id="phone"
                label="Phone number"
                type="tel"
                value={phoneNumber}
                onChange={setPhoneNumber}
                placeholder="+1 555 123 4567"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="address">Address</Label>
              <Textarea
                id="address"
                rows={2}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Street, city, state / region, postal code"
                required
              />
            </div>
          </CardContent>
        </Card>

        {/* Document upload */}
        <Card>
          <CardContent className="space-y-3 p-4">
            <h3 className="text-sm font-semibold">
              {mode === "individual" ? "Government-issued ID" : "Business registration certificate"}
            </h3>
            <p className="text-xs text-muted-foreground">
              {mode === "individual"
                ? "Upload a clear photo or scan of your passport, driver's licence, or national ID card."
                : "Upload your certificate of incorporation or equivalent registration document."}
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
                Submitting…
              </>
            ) : submission?.status === "rejected" ? (
              "Resubmit for review"
            ) : (
              "Submit for review"
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
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = React.useState(false);

  const handleFile = async (file: File) => {
    setUploading(true);
    try {
      const { url } = await kycService.uploadDocument(file, documentType);
      onUploaded({ fileName: file.name, url });
      toast.success(`${file.name} uploaded.`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Upload failed.";
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
              View uploaded file
            </a>
          </div>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={onClear}>
          Replace
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
            <span className="text-xs text-muted-foreground">Uploading…</span>
          </>
        ) : (
          <>
            <Upload className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm font-medium">Click to upload</span>
            <span className="text-[11px] text-muted-foreground">PDF, JPG, or PNG · up to 10 MB</span>
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
              {submittedAt && <>Submitted {formatLocalDateTime(submittedAt)}</>}
              {submittedAt && reviewedAt && " · "}
              {reviewedAt && <>Reviewed {formatLocalDateTime(reviewedAt)}</>}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
