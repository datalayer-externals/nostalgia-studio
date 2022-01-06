import { mount } from 'enzyme';
import React from 'react';

import { embedHeaderHeight } from '../../../../media-ui/embeds';
import { IframelyResizeMessageListener } from '../IframelyResizeMessageListener';

describe('IframelyResizeMessageListener', () => {
  const getIframeElement = (windowId: number) => {
    const iframe = document.createElement('iframe');
    Object.defineProperty(iframe, 'contentWindow', {
      value: { fakeWindow: windowId } as any,
      writable: true,
    });
    return iframe;
  };

  const setup = () => {
    const onHeightUpdate = jest.fn<void, [number]>();
    const iframeRef: React.RefObject<HTMLIFrameElement> = {
      current: getIframeElement(1),
    };
    const component = mount(
      <IframelyResizeMessageListener
        embedIframeRef={iframeRef}
        onHeightUpdate={onHeightUpdate}
      >
        <div id='child'>child</div>
      </IframelyResizeMessageListener>,
    );

    const iframeEl = iframeRef.current;
    if (!iframeEl) {
      expect(iframeEl).toBeDefined();
      expect(iframeEl).not.toBe(null);
      throw new Error('error');
    }

    const getValidMessageEvent = () => {
      const firstValidMessage = {
        method: 'resize',
        height: 416,
        context:
          'https://cdn.iframe.ly/api/iframe?url=https%3A%2F%2Ftwitter.com%2FIndigenousX%2Fstatus%2F1302075712157802497&key=3d793773d462cf635d033ccf2a1fd58e&app=1',
        url: 'https://twitter.com/IndigenousX/status/1302075712157802497',
      };

      return new MessageEvent('message', {
        data: JSON.stringify(firstValidMessage),
        origin: 'https://cdn.iframe.ly',
        source: iframeEl.contentWindow,
      });
    };

    return {
      component,
      onHeightUpdate,
      iframeEl,
      getValidMessageEvent,
    };
  };

  it('should render children', () => {
    const { component } = setup();
    expect(component.find('div#child')).toHaveLength(1);
  });

  it('should call onHeightUpdate when iframe sends message with new size', () => {
    const { onHeightUpdate, iframeEl } = setup();

    expect.assertions(4);

    const sendMessage = (
      data: object,
      origin = 'https://cdn.iframe.ly',
      source = iframeEl.contentWindow,
    ) => {
      const messageEvent = new MessageEvent('message', {
        data: JSON.stringify(data),
        origin,
        source,
      });

      window.dispatchEvent(messageEvent);
    };

    const firstValidMessage = {
      method: 'resize',
      height: 416,
      context:
        'https://cdn.iframe.ly/api/iframe?url=https%3A%2F%2Ftwitter.com%2FIndigenousX%2Fstatus%2F1302075712157802497&key=3d793773d462cf635d033ccf2a1fd58e&app=1',
      url: 'https://twitter.com/IndigenousX/status/1302075712157802497',
    };

    const secondValidMessage = {
      method: 'resize',
      height: 913,
      context:
        'https://cdn.iframe.ly/api/iframe?url=https%3A%2F%2Ftwitter.com%2FIndigenousX%2Fstatus%2F1302075712157802497&key=3d793773d462cf635d033ccf2a1fd58e&app=1',
      url: 'https://twitter.com/IndigenousX/status/1302075712157802497',
    };

    const thirdInvalidMessage = {
      method: 'some-other-method',
      height: 913,
      context:
        'https://cdn.iframe.ly/api/iframe?url=https%3A%2F%2Ftwitter.com%2FIndigenousX%2Fstatus%2F1302075712157802497&key=3d793773d462cf635d033ccf2a1fd58e&app=1',
      url: 'https://twitter.com/IndigenousX/status/1302075712157802497',
    };

    const forthInvalidMessage = {
      method: 'resize',
      // No height
      context:
        'https://cdn.iframe.ly/api/iframe?url=https%3A%2F%2Ftwitter.com%2FIndigenousX%2Fstatus%2F1302075712157802497&key=3d793773d462cf635d033ccf2a1fd58e&app=1',
      url: 'https://twitter.com/IndigenousX/status/1302075712157802497',
    };

    const fifthMessage = {
      method: 'resize',
      height: 1021,
      context:
        'https://cdn.iframe.ly/api/iframe?url=https%3A%2F%2Ftwitter.com%2FIndigenousX%2Fstatus%2F1302075712157802497&key=3d793773d462cf635d033ccf2a1fd58e&app=1',
      url: 'https://twitter.com/IndigenousX/status/1302075712157802497',
    };

    const sixthMessage = {
      method: 'resize',
      height: 1045,
      context:
        'https://cdn.iframe.ly/api/iframe?url=https%3A%2F%2Ftwitter.com%2FIndigenousX%2Fstatus%2F1302075712157802497&key=3d793773d462cf635d033ccf2a1fd58e&app=1',
      url: 'https://twitter.com/IndigenousX/status/1302075712157802497',
    };

    const seventhInvalidMessage = {
      method: 'resize',
      height: '1045',
      context:
        'https://cdn.iframe.ly/api/iframe?url=https%3A%2F%2Ftwitter.com%2FIndigenousX%2Fstatus%2F1302075712157802497&key=3d793773d462cf635d033ccf2a1fd58e&app=1',
      url: 'https://twitter.com/IndigenousX/status/1302075712157802497',
    };

    sendMessage(firstValidMessage, 'https://cdn.iframe.ly');
    sendMessage(firstValidMessage, 'http://cdn.iframe.ly');
    sendMessage(firstValidMessage, 'https://iframely.staging.atl-paas.net');
    sendMessage(firstValidMessage, 'https://iframely.prod.atl-paas.net');
    sendMessage(secondValidMessage);
    sendMessage(thirdInvalidMessage);
    sendMessage(forthInvalidMessage);
    sendMessage(fifthMessage, 'http://www.hacker-site.com');
    sendMessage(fifthMessage, window.origin);
    const differentWindow = getIframeElement(2).contentWindow;
    sendMessage(sixthMessage, undefined, differentWindow);
    sendMessage(seventhInvalidMessage);

    // Should handle non-string object.
    const messageEvent = new MessageEvent('message', {
      data: sixthMessage,
      origin,
      source: iframeEl.contentWindow,
    });
    window.dispatchEvent(messageEvent);

    expect(onHeightUpdate).toHaveBeenCalledTimes(6);
    expect(onHeightUpdate).toHaveBeenCalledWith(416 + embedHeaderHeight);
    expect(onHeightUpdate).toHaveBeenCalledWith(913 + embedHeaderHeight);
    expect(onHeightUpdate).toHaveBeenCalledWith(1021 + embedHeaderHeight);
  });

  it('should not call onHeightUpdate when iframe sends message with new size after component has been unmounted', () => {
    const { onHeightUpdate, getValidMessageEvent, component } = setup();

    component.unmount();

    window.dispatchEvent(getValidMessageEvent());
    expect(onHeightUpdate).not.toHaveBeenCalled();
  });
});
