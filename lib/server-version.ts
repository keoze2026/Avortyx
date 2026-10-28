/**
 * The oldest server (backend CH number) this portal needs (CH-355, Avortyx
 * Guard). The portal goes live on push; the server only after its quiet-time
 * restart. When a portal change needs new backend code, raise this to that
 * change's CH number in the same pull request: admins then see a banner until
 * the server runs it, instead of a feature that silently does nothing.
 */
export const PORTAL_NEEDS_SERVER = 355;
