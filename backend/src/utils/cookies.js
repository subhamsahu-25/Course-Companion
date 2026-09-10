// utils/cookies.js — one place for auth-cookie flags.
//
// Local dev (frontend + backend on localhost) works with SameSite=Lax.
// Production (frontend on Vercel, backend on Render = cross-site) REQUIRES
// SameSite=None; Secure, otherwise browsers silently drop the cookie on
// fetch() and every logged-in call 401s. Browsers also reject
// SameSite=None without Secure, so the two must flip together:
//
//   local:  COOKIE_SAMESITE=lax (or unset),  COOKIE_SECURE=false (or unset)
//   prod:   COOKIE_SAMESITE=none,             COOKIE_SECURE=true
const cookieOptions = () => {
   const sameSite = (process.env.COOKIE_SAMESITE || "lax").toLowerCase();
   const secure =
      process.env.COOKIE_SECURE !== undefined
         ? process.env.COOKIE_SECURE === "true"
         : process.env.NODE_ENV === "production";

   // Fail loud on the invalid combo instead of shipping a cookie browsers
   // will reject (None without Secure) and debugging phantom 401s later.
   if (sameSite === "none" && !secure) {
      throw new Error(
         'Invalid cookie config: COOKIE_SAMESITE=none requires COOKIE_SECURE=true'
      );
   }

   return { httpOnly: true, secure, sameSite };
};

export { cookieOptions };
