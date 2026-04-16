import { createAuthClient } from 'better-auth/react';

export const authClient = createAuthClient();

export const { useSession, signIn, signOut } = authClient;

export type Session = NonNullable<
  ReturnType<typeof authClient.useSession>['data']
>;
export type User = Session['user'];
