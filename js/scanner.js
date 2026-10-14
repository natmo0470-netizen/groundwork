/* Groundwork — barcode scanner.
   Uses the browser's built-in BarcodeDetector where it exists (Chrome on Android, Safari 17+ on some
   devices). Elsewhere it loads the open-source ZXing reader from a CDN the first time it's needed.
   Camera access needs a secure page (https, or a file opened on this computer). */
const Scanner = (() => {
  const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e'];
  const ZXING_URL = 'https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js';
  let stream = null, timer = 0, zxReader = null, stopped = true;

  function hasNative() { return 'BarcodeDetector' in window; }
  function loadZxing() {
    if (window.ZXing) return Promise.resolve(window.ZXing);
    return new Promise((ok, fail) => {
      const s = document.createElement('script');
      s.src = ZXING_URL; s.async = true;
      s.onload = () => window.ZXing ? ok(window.ZXing) : fail(new Error('ZXing missing'));
      s.onerror = () => fail(new Error('Could not load the barcode reader'));
      document.head.appendChild(s);
    });
  }
  async function nativeDetector() {
    let formats = FORMATS;
    try { const sup = await BarcodeDetector.getSupportedFormats(); formats = FORMATS.filter(f => sup.includes(f)); } catch (e) { /* use defaults */ }
    return new BarcodeDetector({ formats: formats.length ? formats : FORMATS });
  }

  async function start(video, onCode) {
    stop();
    stopped = false;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('no-camera');
    if (hasNative()) {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      video.srcObject = stream; video.setAttribute('playsinline', ''); await video.play();
      const det = await nativeDetector();
      const loop = async () => {
        if (stopped) return;
        try { const r = await det.detect(video); if (r && r.length) { onCode(r[0].rawValue); return; } } catch (e) { /* frame not ready */ }
        timer = setTimeout(loop, 220);
      };
      loop();
      return 'native';
    }
    const ZX = await loadZxing();
    if (stopped) return 'cancelled';
    zxReader = new ZX.BrowserMultiFormatReader();
    await zxReader.decodeFromConstraints({ video: { facingMode: { ideal: 'environment' } } }, video, (result) => {
      if (result && !stopped) onCode(result.getText());
    });
    return 'zxing';
  }
  function stop() {
    stopped = true;
    clearTimeout(timer);
    if (zxReader) { try { zxReader.reset(); } catch (e) { /* ignore */ } zxReader = null; }
    if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
  }
  async function fromImage(file) {
    const url = URL.createObjectURL(file);
    try {
      if (hasNative()) {
        const img = await createImageBitmap(file);
        const r = await (await nativeDetector()).detect(img);
        if (r && r.length) return r[0].rawValue;
      }
      const ZX = await loadZxing();
      const res = await new ZX.BrowserMultiFormatReader().decodeFromImageUrl(url);
      return res.getText();
    } finally { URL.revokeObjectURL(url); }
  }
  function valid(code) { return /^\d{8}$|^\d{12,14}$/.test(String(code).replace(/\D/g, '')); }
  return { start, stop, fromImage, valid, hasNative };
})();
