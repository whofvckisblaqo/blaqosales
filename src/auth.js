import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import { authConfig } from "./auth.config";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        identifier: { label: "Email or username" },
        password: { label: "Password", type: "password" },
        remember: { label: "Remember me" },
      },
      async authorize(credentials) {
        const identifier = String(credentials?.identifier || "").trim().toLowerCase();
        const password = String(credentials?.password || "");
        if (!identifier || !password) return null;

        await connectDB();
        const user = await User.findOne({
          $or: [{ email: identifier }, { username: identifier }],
        });
        if (!user) return null;

        const valid = await bcrypt.compare(password, user.password);
        if (!valid) return null;

        return {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          businessName: user.businessName,
          remember: credentials.remember === "true",
        };
      },
    }),
  ],
});
