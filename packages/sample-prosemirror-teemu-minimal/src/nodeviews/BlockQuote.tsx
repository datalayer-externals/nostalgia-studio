import './BlockQuote.scss';

import * as React from 'react';

// Copied from here https://gist.github.com/esmevane/7326b19e20a5670954b51ea8618d096d
// Here we have the (too simple) React component which
// we'll be rendering content into.
//
export class BlockQuote extends React.Component<{}, {}> {
  holeRef: React.RefObject<HTMLParagraphElement>;

  constructor(props: {}) {
    super(props);
    this.holeRef = React.createRef();
  }
  // We'll put the content into what we render using
  // this function, which appends a given node to
  // a ref HTMLElement, if present.
  //
  customAppend(node: HTMLElement) {
    if (this.holeRef) {
      this.holeRef.current!.appendChild(node);
    }
  }

  render() {
    // The styled components version is basically just a wrapper to do SCSS styling.
    // Questionable if it's even needed for such simple styling and because you can't clearly see the
    // DOM structure from the code (hence making `& > ${Component}` selectors quite unintuitive)
    return <blockquote ref={this.holeRef} className='blockquote'></blockquote>;
  }
}
