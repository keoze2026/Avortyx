import { Inter } from "next/font/google";

// Inter with its optical-size axis, for the sign-in screen only: small text gets the open, sturdy
// text letterforms and headlines the finer "Display" ones, so both stay sharp at their size. The app
// keeps its own Inter (app/layout.tsx); `.login-screen` switches to this one (globals.css).
export const loginFont = Inter({
  subsets: ["latin"],
  variable: "--font-login",
  display: "swap",
  axes: ["opsz"],
});
