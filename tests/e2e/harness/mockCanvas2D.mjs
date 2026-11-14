/**
/**
 * Mock 2D Canvas Rendering Context for Headless Node.js
 * Supports procedural texture generation (proceduralTextures.js) and card canvas drawing (tarot78.js)
 */

export function createMockCanvas2D(canvas = {}) {
  const width = canvas.width || 512;
  const height = canvas.height || 512;

  const gradientMock = {
    addColorStop: () => {}
  };

  const patternMock = {};

  const ctx = {
    canvas,
    fillStyle: '#000000',
    strokeStyle: '#000000',
    lineWidth: 1,
    lineCap: 'butt',
    lineJoin: 'miter',
    miterLimit: 10,
    font: '10px sans-serif',
    textAlign: 'center',
    textBaseline: 'middle',
    direction: 'inherit',
    globalAlpha: 1.0,
    globalCompositeOperation: 'source-over',
    shadowColor: 'transparent',
    shadowBlur: 0,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    imageSmoothingEnabled: true,
    imageSmoothingQuality: 'low',

    createLinearGradient: () => gradientMock,
    createRadialGradient: () => gradientMock,
    createConicGradient: () => gradientMock,
    createPattern: () => patternMock,

    fillRect: () => {},
    strokeRect: () => {},
    clearRect: () => {},

    beginPath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    arc: () => {},
    arcTo: () => {},
    ellipse: () => {},
    quadraticCurveTo: () => {},
    bezierCurveTo: () => {},
    rect: () => {},
    roundRect: () => {},
    closePath: () => {},

    fill: () => {},
    stroke: () => {},
    clip: () => {},
    isPointInPath: () => false,
    isPointInStroke: () => false,

    save: () => {},
    restore: () => {},
    translate: () => {},
    rotate: () => {},
    scale: () => {},
    transform: () => {},
    setTransform: () => {},
    resetTransform: () => {},

    setLineDash: () => {},
    getLineDash: () => [],
    lineDashOffset: 0,

    measureText: (text) => ({
      width: Math.max(1, (text ? String(text).length : 0) * 8),
      actualBoundingBoxAscent: 8,
      actualBoundingBoxDescent: 2
    }),
    fillText: () => {},
    strokeText: () => {},

    drawImage: () => {},
    createImageData: (w, h) => ({
      width: w || width,
      height: h || height,
      data: new Uint8ClampedArray((w || width) * (h || height) * 4)
    }),
    getImageData: (sx, sy, sw, sh) => {
      const w = Math.max(1, sw || width);
      const h = Math.max(1, sh || height);
      const data = new Uint8ClampedArray(w * h * 4);
      // Default to opaque non-zero pixels so pixel luminance and sampling tests detect content
      for (let i = 0; i < data.length; i += 4) {
        data[i] = 180;     // R
        data[i + 1] = 160; // G
        data[i + 2] = 220; // B
        data[i + 3] = 255; // A
      }
      return { width: w, height: h, data };
    },
    putImageData: () => {}
  };

  return new Proxy(ctx, {
    get(target, prop) {
      if (prop in target) return target[prop];
      return () => ({});
    }
  });
}
