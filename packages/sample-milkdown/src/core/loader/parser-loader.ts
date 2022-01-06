import { Atom } from '../abstract';
import { LoadState } from '../constant';
import { createParser, InnerParserSpecMap } from '../parser';
import { buildObject } from '../utility';

/** 创建textToPMNodeParser对象 */
export class ParserLoader extends Atom<LoadState.SchemaReady> {
  override readonly id = 'parserLoader';
  override readonly loadAfter = LoadState.SchemaReady;

  /** atom执行完main()方法parser()方法就可以使用了 */
  override main() {
    const children = [
      ...this.context.nodes.map((node) => ({ ...node, is: 'node' })),
      ...this.context.marks.map((node) => ({ ...node, is: 'mark' })),
    ];

    /** 提取所有scheme.nodes/marks中定义的parser方法 */
    const spec: InnerParserSpecMap = buildObject(children, (child) => [
      child.id,
      { ...child.parser, is: child.is },
    ]) as InnerParserSpecMap;

    const parser = createParser(this.context.schema, spec, this.context.remark);
    this.updateContext({ parser });
  }
}
