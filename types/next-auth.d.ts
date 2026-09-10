/**
 * Augment Auth.js's User/JWT with the app's own session fields so callers
 * get typed `workspaceId`/`role` instead of casting. `Session.user` is typed
 * as `User`, so augmenting `User` here covers both.
 */
import type { DefaultUser } from "@auth/core/types";

declare module "@auth/core/types" {
  interface User extends DefaultUser {
    workspaceId: string;
    role: string;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    userId: string;
    workspaceId: string;
    role: string;
  }
}
