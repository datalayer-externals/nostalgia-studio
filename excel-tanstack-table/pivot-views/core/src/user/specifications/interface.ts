import type { CompositeSpecification } from '@datalking/pivot-entity';

import type { User } from '../user.js';
import type { WithUserAvatar } from './user-avatar.specification.js';
import type { WithUserEmail } from './user-email.specification.js';
import type { WithUserId } from './user-id.specification.js';
import type { WithUsername } from './username.specification.js';

export interface IUserSpecVisitor {
  idEqual(s: WithUserId): void;
  avatarEqual(s: WithUserAvatar): void;
  emailEqual(s: WithUserEmail): void;
  usernameEqual(s: WithUsername): void;
  not(): IUserSpecVisitor;
}

export type UserSpecification = CompositeSpecification<User, IUserSpecVisitor>;
