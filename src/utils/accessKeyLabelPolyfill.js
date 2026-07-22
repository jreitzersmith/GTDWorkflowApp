/**
 * Vendored from https://github.com/tillsanders/access-key-label-polyfill (MIT)
 * Polyfills HTMLElement.prototype.accessKeyLabel for browsers that don't support it
 * (primarily Chrome/Edge). Runs once on import; exits immediately if native support
 * is detected or if running outside a browser context.
 */

function determineAccessKeyLabel(ua) {
  // macOS
  if (/macintosh/i.test(ua)) {
    return '⌃⌥';
  }
  // Internet Explorer / Edge legacy
  if (/msie|trident/i.test(ua) || /\sedg/i.test(ua)) {
    return 'Alt + ';
  }
  // Windows Chrome / other
  if (/windows/i.test(ua)) {
    if (/chrome/i.test(ua)) {
      return 'Alt + ';
    }
  }
  // iOS / iPadOS
  if (/(ipod|iphone|ipad)/i.test(ua)) {
    return '⌃⌥';
  }
  // Fallback (Android Chrome doesn't support accessKey reliably)
  return undefined;
}

(function installAccessKeyLabelPolyfill() {
  if (typeof window === 'undefined') return;

  // Exit if the browser already implements accessKeyLabel natively
  if (Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'accessKeyLabel')) return;

  const modifiers = determineAccessKeyLabel(window.navigator.userAgent);

  Object.defineProperty(HTMLElement.prototype, 'accessKeyLabel', {
    get() {
      if (!this.accessKey || !modifiers) return undefined;
      return modifiers + this.accessKey;
    },
    enumerable: true,
    configurable: true,
  });
})();
