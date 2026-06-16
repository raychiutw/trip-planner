/**
 * makeUser / makeAuthData — auth fixture aligned with AuthData shape.
 */
import type { AuthData } from '../../../src/types/api';

export interface MakeUserInput {
  email?: string;
  userId?: string | null;
  isServiceToken?: boolean;
  scopes?: string[];
  clientId?: string;
}

let userCounter = 0;

export function makeUser(input: MakeUserInput = {}): { email: string; id: string; displayName: string | null } {
  userCounter += 1;
  const email = input.email ?? `user-${userCounter}@example.com`;
  const id = input.userId ?? `user-uuid-${userCounter}`;
  return { email, id, displayName: null };
}

export function makeAuthData(input: MakeUserInput = {}): AuthData {
  const user = makeUser(input);
  return {
    email: user.email,
    userId: user.id,
    isServiceToken: input.isServiceToken ?? false,
    scopes: input.scopes,
    clientId: input.clientId,
  };
}
