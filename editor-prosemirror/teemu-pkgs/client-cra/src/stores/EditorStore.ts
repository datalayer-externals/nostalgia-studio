import { type EditorContext } from '@example/full-v2';
import { type EditorStateJSON } from '@example/types';
import { type PMDoc } from '../types/document';

export class EditorStore {
  editorCtx?: EditorContext;
  currentEditorState?: EditorStateJSON;

  setEditorContext = (ctx: EditorContext) => {
    this.editorCtx = ctx;
  };

  getEditorState = () => {
    return this.editorCtx!.viewProvider.stateToJSON();
  };

  createEmptyDoc = (): PMDoc => {
    const json = JSON.parse(
      '{"type":"doc","content":[{"type":"paragraph","content":[]}]}',
    );
    if (!this.editorCtx) {
      throw Error(
        'Undefined editorCtx, did you forget to call setEditorContext?',
      );
    }
    const node =
      this.editorCtx.viewProvider.editorView.state.schema.nodeFromJSON(json);
    node.check();
    return node.toJSON();
  };

  setCurrentDoc = (doc?: PMDoc) => {
    const pmDoc = doc ?? this.createEmptyDoc();
    this.editorCtx?.viewProvider.replaceState(pmDoc);
  };

  reset = () => {
    this.setCurrentDoc();
  };
}
