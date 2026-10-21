"use client";

import { chipMask, insetShape, type ChipShape } from "@/components/auth/chip-shape";
import { useTranslation } from "@/hooks/use-translation";
import { useAiMode, type AiMode } from "./scene-input";

// The AI's status chip under her portrait. Decorative: the form itself announces what matters.

const TAG: ChipShape = { cut: 8, round: 7, soft: 3 };
const TAG_MASK = chipMask(TAG), TAG_FILL = chipMask(insetShape(TAG, 1));

// what the tag reads in each state (lib/i18n/extra/login.ts)
const LABEL: Record<AiMode, string> = {
  Ready: "loginScreen.ai.ready",
  Listening: "loginScreen.ai.listening",
  Verifying: "loginScreen.ai.verifying",
  Welcome: "loginScreen.ai.welcome",
  "Try again": "loginScreen.ai.tryAgain",
};

export function AiStatus({ x, y }: { x: number; y: number }) {
  const { t } = useTranslation();
  const mode = useAiMode();
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed z-0 -translate-x-1/2 animate-[scene-in_0.6s_ease-out_both] bg-white/10 p-px forced-colors:hidden"
      style={{ left: x, top: y, ...TAG_MASK }}
    >
      <div style={TAG_FILL} className="flex items-center gap-[8px] whitespace-nowrap bg-obsidian-900/85 px-[12px] py-[6px] text-[12px] leading-[16px] backdrop-blur-md">
        <span className="relative grid h-[8px] w-[8px] place-items-center">
          <span key={mode} className="absolute h-full w-full rounded-full bg-ice-300 animate-[live-pulse_1.4s_ease-out_both]" />
          <span className="relative h-[6px] w-[6px] rounded-full bg-ice-300" />
        </span>
        <span className="font-medium text-foreground/90">Avortyx AI</span>
        <span aria-hidden="true" className="h-[12px] w-px bg-white/10" />
        <span className={mode === "Ready" ? "text-muted-foreground" : "text-ice-200"}>{t(LABEL[mode])}</span>
      </div>
    </div>
  );
}
