/**
 * @description basic demo
 * @author wangfupeng
 */

import React, { Component } from 'react';
import {
  type IDomEditor,
  type IEditorConfig,
  type SlateDescendant,
} from '@wangeditor/editor';
import '@wangeditor/editor/dist/css/style.css';
import { Editor, Toolbar } from '../../src/index';

interface IState {
  editor: IDomEditor | null;
  curContent: SlateDescendant[];
}

class Basic extends Component {
  state: IState = {
    editor: null,
    curContent: [],
  };

  constructor(props) {
    super(props);
  }

  // ----------------------- 修改配置，使用 API -----------------------
  toggleReadOnly() {
    const { editor } = this.state;
    if (editor == null) return;

    if (editor.getConfig().readOnly) {
      editor.enable();
    } else {
      editor.disable();
    }
  }
  printHtml() {
    const { editor } = this.state;
    if (editor == null) return;
    console.log(editor.getHtml());
  }

  render() {
    // ----------------------- editor config -----------------------
    const editorConfig: Partial<IEditorConfig> = {};
    editorConfig.placeholder = '请输入内容...';
    editorConfig.onCreated = (editor: IDomEditor) => {
      this.setState({ editor });
    };
    editorConfig.onChange = (editor: IDomEditor) => {
      this.setState({ curContent: editor.children });
    };
    editorConfig.MENU_CONF = {};
    editorConfig.MENU_CONF['uploadImage'] = {
      server: 'http://106.12.198.214:3000/api/upload-img', // 上传图片地址
      fieldName: 'react-hooks-demo-fileName',
    };
    // 继续补充其他配置~

    // ----------------------- editor content -----------------------
    const defaultContent = [
      { type: 'paragraph', children: [{ text: 'class 组件 - 基本使用' }] },
      { type: 'paragraph', children: [{ text: '' }] },
    ];

    // const defaultHtml = '<p>hello&nbsp;<strong>world</strong>&nbsp;3</p><p><br></p>'

    // ----------------------- toolbar config -----------------------
    const toolbarConfig = {
      // 可配置 toolbarKeys: [...]
    };

    return (
      <React.Fragment>
        <div>
          Basic usage in class component &nbsp;
          <button onClick={this.toggleReadOnly.bind(this)}>
            切换 readOnly
          </button>
          &nbsp;
          <button onClick={this.printHtml.bind(this)}>打印 html</button>
        </div>

        {/* data-testid 用于单元测试 */}
        <div
          data-testid='editor-container'
          style={{ border: '1px solid #ccc', marginTop: '10px' }}
        >
          {/* 渲染 toolbar */}
          <Toolbar
            editor={this.state.editor}
            defaultConfig={toolbarConfig}
            style={{ borderBottom: '1px solid #ccc' }}
          />

          {/* 渲染 editor */}
          <Editor
            defaultConfig={editorConfig}
            defaultContent={defaultContent}
            // defaultHtml={defaultHtml}
            mode='default'
            style={{ height: '500px' }}
          />
        </div>

        <div style={{ border: '1px solid #ccc', marginTop: '20px' }}>
          <textarea
            readOnly
            style={{ width: '100%', height: '300px' }}
            value={JSON.stringify(this.state.curContent, null, 4)}
          ></textarea>
        </div>
      </React.Fragment>
    );
  }

  componentWillUnmount() {
    // ----------------------- 销毁 editor -----------------------
    const { editor } = this.state;
    if (editor == null) return;
    editor.destroy();
    this.setState({ editor: null });
  }
}

export default Basic;
