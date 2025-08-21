(function () {
  // Expose a single global for initializing the widget
  const WIDGET_NS = 'IndivillageChatWidget';

  if (window[WIDGET_NS]) return; // prevent double registration

  function createStyle(css) {
    const style = document.createElement('style');
    style.type = 'text/css';
    style.appendChild(document.createTextNode(css));
    document.head.appendChild(style);
  }

  function createEl(tag, attrs, children) {
    const el = document.createElement(tag);
    if (attrs) Object.entries(attrs).forEach(([k, v]) => {
      if (k === 'style' && typeof v === 'object') {
        Object.assign(el.style, v);
      } else if (k === 'className') {
        el.className = v;
      } else {
        el.setAttribute(k, v);
      }
    });
    if (children) children.forEach(c => {
      if (typeof c === 'string') el.appendChild(document.createTextNode(c));
      else if (c) el.appendChild(c);
    });
    return el;
  }

  function isMobile() {
    return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  }

  function init(userOptions) {
    const defaults = {
      baseUrl: 'https://indivillagerag.ap-south-1.elasticbeanstalk.com',
      route: 'indivillage',
      title: 'Indivillage Chat',
      buttonColor: '#4F46E5',
      position: 'bottom-right', // bottom-right | bottom-left
      zIndex: 2147483000,
      width: 420,
      height: 640,
      borderRadius: 12,
      openByDefault: false,
      // Optional: auto login if your chat requires a login. Will only work cross-site if third-party cookies are allowed and your app sets SameSite=None; Secure on the session cookie.
      autoLogin: false,
      loginUsername: 'sparklab',
      loginPassword: 'Sparklab123'
    };

    const opts = Object.assign({}, defaults, userOptions || {});

    // Ensure only one instance
    if (document.getElementById('indivillage-chat-launcher')) return;

    const stylesheet = `
      .indivillage-chat-launcher {
        position: fixed;
        ${opts.position === 'bottom-left' ? 'left: 24px;' : 'right: 24px;'}
        bottom: 24px;
        width: 56px;
        height: 56px;
        border-radius: 999px;
        background: ${opts.buttonColor};
        color: #fff;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica Neue, Arial, "Apple Color Emoji", "Segoe UI Emoji";
        box-shadow: 0 10px 24px rgba(0,0,0,0.18), 0 6px 12px rgba(0,0,0,0.12);
        cursor: pointer;
        z-index: ${opts.zIndex};
        user-select: none;
      }
      .indivillage-chat-launcher:hover { filter: brightness(0.95); }

      .indivillage-chat-container {
        position: fixed;
        ${opts.position === 'bottom-left' ? 'left: 24px;' : 'right: 24px;'}
        bottom: 90px;
        width: ${Math.max(280, opts.width)}px;
        height: ${Math.max(320, opts.height)}px;
        max-width: 92vw;
        max-height: 85vh;
        background: #fff;
        border: 1px solid rgba(0,0,0,0.08);
        border-radius: ${opts.borderRadius}px;
        box-shadow: 0 20px 40px rgba(0,0,0,0.22), 0 10px 20px rgba(0,0,0,0.18);
        overflow: hidden;
        z-index: ${opts.zIndex};
        display: none;
      }
      .indivillage-chat-header {
        height: 44px;
        background: #fff;
        border-bottom: 1px solid rgba(0,0,0,0.08);
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 12px;
        font-size: 14px;
        font-weight: 600;
      }
      .indivillage-chat-close {
        cursor: pointer;
        font-size: 18px;
        line-height: 1;
        padding: 4px 8px;
        border-radius: 6px;
      }
      .indivillage-chat-close:hover { background: rgba(0,0,0,0.05); }

      .indivillage-chat-iframe {
        width: 100%;
        height: calc(100% - 44px);
        border: 0;
        display: block;
      }

      @media (max-width: 600px) {
        .indivillage-chat-container {
          left: 0 !important;
          right: 0 !important;
          bottom: 0 !important;
          width: 100vw !important;
          height: 100vh !important;
          max-width: 100vw !important;
          max-height: 100vh !important;
          border-radius: 0 !important;
        }
        .indivillage-chat-launcher {
          width: 52px; height: 52px;
        }
      }
    `;

    createStyle(stylesheet);

    const launcher = createEl('div', {
      id: 'indivillage-chat-launcher',
      className: 'indivillage-chat-launcher',
      title: opts.title
    }, [
      // Simple chat bubble icon (SVG)
      createEl('div', { 'aria-hidden': 'true' }, [
        '\u2709' // envelope as a simple icon fallback
      ])
    ]);

    const container = createEl('div', { id: 'indivillage-chat-container', className: 'indivillage-chat-container' });

    const header = createEl('div', { className: 'indivillage-chat-header' }, [
      createEl('div', null, [opts.title]),
      createEl('div', { className: 'indivillage-chat-close', title: 'Close' }, ['\u2715'])
    ]);

    const iframeSrc = `${opts.baseUrl.replace(/\/$/, '')}/${opts.route.replace(/^\//, '')}/chat`;
    const iframe = createEl('iframe', {
      className: 'indivillage-chat-iframe',
      src: iframeSrc,
      allow: 'clipboard-write; microphone; autoplay',
      referrerpolicy: 'no-referrer-when-downgrade',
      loading: 'lazy',
      title: opts.title
    });

    container.appendChild(header);
    container.appendChild(iframe);

    function open() {
      container.style.display = 'block';
      launcher.style.display = 'none';
    }
    function close() {
      container.style.display = 'none';
      launcher.style.display = 'flex';
    }

    launcher.addEventListener('click', async () => {
      if (opts.autoLogin) {
        try {
          await attemptLogin(opts);
        } catch (e) {
          // ignore errors; embed might still work if already logged in
        }
      }
      open();
    });
    header.querySelector('.indivillage-chat-close').addEventListener('click', close);

    document.body.appendChild(launcher);
    document.body.appendChild(container);

    if (opts.openByDefault || (isMobile() && opts.openByDefault === 'mobile')) {
      open();
    }
  }

  async function attemptLogin(opts) {
    const loginUrl = `${opts.baseUrl.replace(/\/$/, '')}/${opts.route.replace(/^\//, '')}`;
    const formData = new URLSearchParams();
    formData.set('username', opts.loginUsername || '');
    formData.set('password', opts.loginPassword || '');

    // Try standard form POST to establish session in same-origin or third-party if cookies allowed
    await fetch(loginUrl, {
      method: 'POST',
      body: formData,
      credentials: 'include',
      mode: 'cors',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
  }

  window[WIDGET_NS] = { init };
})();
