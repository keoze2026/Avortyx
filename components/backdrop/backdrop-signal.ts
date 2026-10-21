// Page -> scene signals, as a window event so the two sides stay independent.
// focus/blur: a field's focus; submit/result: sign-in; tick: BTC price (unused); call: circuit pulse
// (nothing sends "call" in the app yet: the prototype's call counts were invented).

export type BackdropSignal =
  | { kind: "focus" }
  | { kind: "blur" }
  | { kind: "submit" }
  | { kind: "result"; ok: boolean }
  | { kind: "tick"; up: boolean }
  | { kind: "call" };

export const BACKDROP_EVENT = "avortyx:backdrop";

export function signalBackdrop(signal: BackdropSignal) {
  window.dispatchEvent(new CustomEvent<BackdropSignal>(BACKDROP_EVENT, { detail: signal }));
}
