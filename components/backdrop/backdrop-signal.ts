// What the page tells the 3D scene (components/scene/scene-input.ts), so Avortyx AI can answer it:
//  - "focus" / "blur": a sign-in field gains or loses focus; while one has it she listens;
//  - "submit": Sign in is pressed; she comes apart and holds as a galaxy ("Verifying");
//  - "result": the sign-in's answer; she is printed back, lit up (ok: "Welcome") or jolted (not:
//    "Try again"). Without one she comes back by herself after a few seconds;
//  - "tick": the BTC price moves (up or down); the scene ignores it (it moves too often to show);
//  - "call": a call comes in; the circuit (circuit-field.tsx) runs a pulse from the AI through the
//    chip out to a buyer. Nothing sends it in the app yet: the prototype's live strip did, from
//    invented call counts (live-ticker.tsx), so it waits for real figures.
// A window event, so the two sides stay independent: nothing listens, nothing happens.

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
