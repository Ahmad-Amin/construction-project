// Remembers whether the person folded the desktop sidebar away. A cookie, not local storage,
// so the server can draw the right width on the very first paint.
export const SIDEBAR_COOKIE = "sidebar";

// Same idea for the payment schedule card on the Payments page: "hidden" when the person folded it.
export const SCHEDULE_COOKIE = "payment-schedule";
