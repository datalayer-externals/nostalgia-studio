import { type ActorId } from './common';

export type CommentId = string;

export type Comment = {
  id: CommentId;
  /** Author of the comment. */
  actor: ActorId;
  /** Content. */
  /**
   * TODO: Should eventually be an Array<FormatSpan>
   */
  content: string;
};
