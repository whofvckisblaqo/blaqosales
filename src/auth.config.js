// Edge-safe config (no database or bcrypt imports here).
// Used by the proxy for route protection; auth.js adds the providers.
export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 30 },
  providers: [],
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const loggedIn = !!auth?.user;
      const onLogin = nextUrl.pathname.startsWith("/login");
      // First-time setup page. It locks itself as soon as an account exists.
      if (nextUrl.pathname.startsWith("/setup") || nextUrl.pathname.startsWith("/api/setup")) return true;

      if (onLogin) {
        if (loggedIn) return Response.redirect(new URL("/dashboard", nextUrl));
        return true;
      }
      return loggedIn;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.businessName = user.businessName;
        // "Remember me" off = session ends after 12 hours instead of 30 days.
        token.expiresAt = user.remember ? null : Date.now() + 12 * 60 * 60 * 1000;
      }
      if (token.expiresAt && Date.now() > token.expiresAt) return null;
      return token;
    },
    async session({ session, token }) {
      if (token?.id) {
        session.user.id = token.id;
        session.user.businessName = token.businessName;
      }
      return session;
    },
  },
};
