// CONSTANTS & STATE
const GRID_SIZE = 32;
const CELL_SIZE = 10;
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 2;
const ZOOM_STEP = 0.5;

const canvas = document.getElementById('pixelCanvas');
const ctx = canvas.getContext('2d');

let frames = [];
let currentFrameIndex = 0;
let currentColor = '#FF0000';
let isDrawing = false;
let isErasing = false;
let brushSize = 1;
let animationInterval = null;
let animationSpeed = 150;
let onionSkinEnabled = false;
let zoomLevel = 1;
let undoStack = [];   // stores snapshots of current frame before each stroke

// FRAME HELPERS
function createEmptyFrame() {
  return Array(GRID_SIZE).fill(null).map(() =>
    Array(GRID_SIZE).fill('#FFFFFF')
  );
}

function deepCopyFrame(frame) {
  return frame.map(row => [...row]);
}

function updateCanvasScale() {
  const size = GRID_SIZE * CELL_SIZE * zoomLevel;
  canvas.style.width = `${size}px`;
  canvas.style.height = `${size}px`;
  const zoomValue = document.getElementById('zoomValue');
  if (zoomValue) zoomValue.textContent = `${zoomLevel * 100}%`;
}

// INIT
frames.push(createEmptyFrame());
currentFrameIndex = 0;
drawCanvas();
updateFrameThumbnails();
updateCanvasScale();

// DRAW CANVAS
function drawCanvas() {
  const frame = frames[currentFrameIndex];

  // Draw current frame FIRST
  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      ctx.fillStyle = frame[row][col];
      ctx.fillRect(col * CELL_SIZE, row * CELL_SIZE, CELL_SIZE, CELL_SIZE);
      ctx.strokeStyle = '#cccccc33';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(col * CELL_SIZE, row * CELL_SIZE, CELL_SIZE, CELL_SIZE);
    }
  }

  // Draw ghost of previous frame ON TOP — only colored cells, skip white
  if (onionSkinEnabled && currentFrameIndex > 0) {
    const prevFrame = frames[currentFrameIndex - 1];
    ctx.globalAlpha = 0.35;
    for (let row = 0; row < GRID_SIZE; row++) {
      for (let col = 0; col < GRID_SIZE; col++) {
        if (prevFrame[row][col] !== '#FFFFFF') {
          ctx.fillStyle = prevFrame[row][col];
          ctx.fillRect(col * CELL_SIZE, row * CELL_SIZE, CELL_SIZE, CELL_SIZE);
        }
      }
    }
    ctx.globalAlpha = 1.0;
  }
}

// MOUSE DRAWING
function getCellFromMouse(e) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const mouseX = (e.clientX - rect.left) * scaleX;
  const mouseY = (e.clientY - rect.top) * scaleY;
  const col = Math.floor(mouseX / CELL_SIZE);
  const row = Math.floor(mouseY / CELL_SIZE);
  if (row >= 0 && row < GRID_SIZE && col >= 0 && col < GRID_SIZE) {
    return { row, col };
  }
  return null;
}

function setPixel(row, col) {
  const color = isErasing ? '#FFFFFF' : currentColor;
  for (let dr = 0; dr < brushSize; dr++) {
    for (let dc = 0; dc < brushSize; dc++) {
      const r = row + dr;
      const c = col + dc;
      if (r < GRID_SIZE && c < GRID_SIZE) {
        frames[currentFrameIndex][r][c] = color;
      }
    }
  }
  drawCanvas();
  updateFrameThumbnails();
}

canvas.addEventListener('mousedown', (e) => {
  isDrawing = true;
  // Save undo snapshot before stroke begins
  undoStack.push(deepCopyFrame(frames[currentFrameIndex]));
  if (undoStack.length > 30) undoStack.shift(); // limit history
  const cell = getCellFromMouse(e);
  if (cell) setPixel(cell.row, cell.col);
});

canvas.addEventListener('mousemove', (e) => {
  if (!isDrawing) return;
  const cell = getCellFromMouse(e);
  if (cell) setPixel(cell.row, cell.col);
});

canvas.addEventListener('mouseup', () => isDrawing = false);
canvas.addEventListener('mouseleave', () => isDrawing = false);

// TOUCH DRAWING
canvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  isDrawing = true;
  undoStack.push(deepCopyFrame(frames[currentFrameIndex]));
  if (undoStack.length > 30) undoStack.shift();
  const cell = getCellFromTouch(e);
  if (cell) setPixel(cell.row, cell.col);
}, { passive: false });

canvas.addEventListener('touchmove', (e) => {
  e.preventDefault();
  if (!isDrawing) return;
  const cell = getCellFromTouch(e);
  if (cell) setPixel(cell.row, cell.col);
}, { passive: false });

canvas.addEventListener('touchend', () => isDrawing = false);

function getCellFromTouch(e) {
  const touch = e.touches[0];
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const touchX = (touch.clientX - rect.left) * scaleX;
  const touchY = (touch.clientY - rect.top) * scaleY;
  const col = Math.floor(touchX / CELL_SIZE);
  const row = Math.floor(touchY / CELL_SIZE);
  if (row >= 0 && row < GRID_SIZE && col >= 0 && col < GRID_SIZE) {
    return { row, col };
  }
  return null;
}

// FRAME THUMBNAILS
function updateFrameThumbnails() {
  const container = document.getElementById('frameList');
  container.innerHTML = '';

  frames.forEach((frame, idx) => {
    const thumbCanvas = document.createElement('canvas');
    thumbCanvas.width = 32;
    thumbCanvas.height = 32;
    const tCtx = thumbCanvas.getContext('2d');

    for (let row = 0; row < GRID_SIZE; row++) {
      for (let col = 0; col < GRID_SIZE; col++) {
        tCtx.fillStyle = frame[row][col];
        tCtx.fillRect(col, row, 1, 1);
      }
    }

    if (idx === currentFrameIndex) {
      thumbCanvas.classList.add('selected');
    }

    const label = document.createElement('div');
    label.style.cssText = 'font-size:11px; text-align:center; color:#aaa;';
    label.textContent = `Frame ${idx + 1}`;

    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'display:flex; flex-direction:column; align-items:center; gap:2px;';
    wrapper.appendChild(thumbCanvas);
    wrapper.appendChild(label);

    wrapper.addEventListener('click', () => {
      currentFrameIndex = idx;
      drawCanvas();
      updateFrameThumbnails();
    });

    container.appendChild(wrapper);
  });
}

// FRAME CONTROLS
document.getElementById('addFrameBtn').addEventListener('click', () => {
  frames.push(createEmptyFrame());
  currentFrameIndex = frames.length - 1;
  undoStack = [];
  updateFrameThumbnails();
  drawCanvas();
});

document.getElementById('duplicateFrameBtn').addEventListener('click', () => {
  const copy = deepCopyFrame(frames[currentFrameIndex]);
  frames.splice(currentFrameIndex + 1, 0, copy);
  currentFrameIndex++;
  undoStack = [];
  updateFrameThumbnails();
  drawCanvas();
});

document.getElementById('deleteFrameBtn').addEventListener('click', () => {
  if (frames.length === 1) return alert('Need at least 1 frame.');
  frames.splice(currentFrameIndex, 1);
  if (currentFrameIndex >= frames.length) currentFrameIndex = frames.length - 1;
  undoStack = [];
  updateFrameThumbnails();
  drawCanvas();
});

document.getElementById('clearBtn').addEventListener('click', () => {
  undoStack.push(deepCopyFrame(frames[currentFrameIndex]));
  frames[currentFrameIndex] = createEmptyFrame();
  drawCanvas();
  updateFrameThumbnails();
});

// TOOLBAR EVENTS
document.getElementById('colorPicker').addEventListener('input', (e) => {
  currentColor = e.target.value;
  isErasing = false;
  document.getElementById('eraserBtn').classList.remove('active');
});

document.getElementById('brushSize').addEventListener('change', (e) => {
  brushSize = parseInt(e.target.value);
});

document.getElementById('eraserBtn').addEventListener('click', () => {
  isErasing = !isErasing;
  document.getElementById('eraserBtn').classList.toggle('active', isErasing);
});

document.getElementById('undoBtn').addEventListener('click', () => {
  if (undoStack.length === 0) return;
  frames[currentFrameIndex] = undoStack.pop();
  drawCanvas();
  updateFrameThumbnails();
});

// ANIMATION
document.getElementById('playBtn').addEventListener('click', () => {
  if (frames.length < 2) return alert('Add at least 2 frames to animate.');
  if (animationInterval) clearInterval(animationInterval);
  animationInterval = setInterval(() => {
    currentFrameIndex = (currentFrameIndex + 1) % frames.length;
    drawCanvas();
    updateFrameThumbnails();
  }, animationSpeed);
});

document.getElementById('pauseBtn').addEventListener('click', () => {
  clearInterval(animationInterval);
  animationInterval = null;
});

document.getElementById('speedInput').addEventListener('change', (e) => {
  animationSpeed = parseInt(e.target.value);
  if (animationInterval) {
    clearInterval(animationInterval);
    animationInterval = setInterval(() => {
      currentFrameIndex = (currentFrameIndex + 1) % frames.length;
      drawCanvas();
      updateFrameThumbnails();
    }, animationSpeed);
  }
});

document.getElementById('onionToggle').addEventListener('change', (e) => {
  onionSkinEnabled = e.target.checked;
  drawCanvas();
});

document.getElementById('zoomOutBtn').addEventListener('click', () => {
  if (zoomLevel > ZOOM_MIN) {
    zoomLevel -= ZOOM_STEP;
    updateCanvasScale();
  }
});

document.getElementById('zoomInBtn').addEventListener('click', () => {
  if (zoomLevel < ZOOM_MAX) {
    zoomLevel += ZOOM_STEP;
    updateCanvasScale();
  }
});

// EXPORT GIF (no external library)
document.getElementById('exportGifBtn').addEventListener('click', () => {
  const colorSet = new Set();
  frames.forEach(frame => frame.forEach(row => row.forEach(c => colorSet.add(c))));
  const colorList = [...colorSet];

  if (colorList.length > 256) {
    alert('Too many colors (max 256 for GIF). Reduce colors and try again.');
    return;
  }

  const colorIndex = new Map();
  colorList.forEach((c, i) => colorIndex.set(c, i));

  const paletteBits = Math.max(2, Math.ceil(Math.log2(Math.max(colorList.length, 2))));
  const paletteSize = 1 << paletteBits;
  const palette = [...colorList];
  while (palette.length < paletteSize) palette.push('#000000');

  const hexToRGB = hex => [
    parseInt(hex.slice(1,3), 16),
    parseInt(hex.slice(3,5), 16),
    parseInt(hex.slice(5,7), 16)
  ];

  const out = [];
  const write = b => out.push(b & 0xFF);
  const writeShort = v => { write(v); write(v >> 8); };
  const writeStr = s => [...s].forEach(c => write(c.charCodeAt(0)));

  const W = GRID_SIZE * CELL_SIZE;
  const H = GRID_SIZE * CELL_SIZE;

  // GIF Header
  writeStr('GIF89a');
  writeShort(W); writeShort(H);
  write(0x80 | (7 << 4) | (paletteBits - 1));
  write(0); write(0);

  // Global Color Table
  palette.forEach(hex => {
    const [r,g,b] = hexToRGB(hex);
    write(r); write(g); write(b);
  });

  // Loop forever
  write(0x21); write(0xFF); write(0x0B);
  writeStr('NETSCAPE2.0');
  write(0x03); write(0x01); writeShort(0); write(0x00);

  const delayCentisec = Math.max(1, Math.round(animationSpeed / 10));
  const minCodeSize = Math.max(2, paletteBits);

  frames.forEach(frame => {
    // Graphic Control Extension
    write(0x21); write(0xF9); write(0x04);
    write(0x00);
    writeShort(delayCentisec);
    write(0x00); write(0x00);

    // Image Descriptor
    write(0x2C);
    writeShort(0); writeShort(0);
    writeShort(W); writeShort(H);
    write(0x00);

    // Pixel index stream
    const pixels = [];
    for (let row = 0; row < GRID_SIZE; row++) {
      for (let py = 0; py < CELL_SIZE; py++) {
        for (let col = 0; col < GRID_SIZE; col++) {
          const idx = colorIndex.get(frame[row][col]) ?? 0;
          for (let px = 0; px < CELL_SIZE; px++) pixels.push(idx);
        }
      }
    }

    // LZW encode + write sub-blocks
    write(minCodeSize);
    const compressed = gifLZW(pixels, minCodeSize);
    for (let i = 0; i < compressed.length; i += 255) {
      const block = compressed.slice(i, i + 255);
      write(block.length);
      block.forEach(b => write(b));
    }
    write(0x00);
  });

  write(0x3B); // GIF trailer

  const blob = new Blob([new Uint8Array(out)], { type: 'image/gif' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'animation.gif';
  a.click();
  URL.revokeObjectURL(url);
});

function gifLZW(pixels, minCodeSize) {
  const clearCode = 1 << minCodeSize;
  const eoi = clearCode + 1;
  const out = [];
  let buf = 0, bufBits = 0, codeSize = minCodeSize + 1;

  const emit = code => {
    buf |= code << bufBits;
    bufBits += codeSize;
    while (bufBits >= 8) { out.push(buf & 255); buf >>>= 8; bufBits -= 8; }
  };

  let nextCode, table;
  const reset = () => {
    table = new Map();
    for (let i = 0; i < clearCode + 2; i++) table.set(i + '', i);
    nextCode = clearCode + 2;
    codeSize = minCodeSize + 1;
  };

  reset();
  emit(clearCode);

  if (pixels.length === 0) {
    emit(eoi);
    if (bufBits) out.push(buf & 255);
    return out;
  }

  let prefix = pixels[0] + '';
  for (let i = 1; i < pixels.length; i++) {
    const key = prefix + ',' + pixels[i];
    if (table.has(key)) {
      prefix = key;
    } else {
      emit(table.get(prefix));
      if (nextCode < 4096) {
        table.set(key, nextCode++);
        if (nextCode > (1 << codeSize) && codeSize < 12) codeSize++;
      } else {
        emit(clearCode);
        reset();
      }
      prefix = pixels[i] + '';
    }
  }

  emit(table.get(prefix));
  emit(eoi);
  if (bufBits) out.push(buf & 255);
  return out;
}

// EXPORT SPRITE SHEET
document.getElementById('exportSpriteBtn').addEventListener('click', () => {
  const sheetCanvas = document.createElement('canvas');
  sheetCanvas.width = GRID_SIZE * CELL_SIZE * frames.length;
  sheetCanvas.height = GRID_SIZE * CELL_SIZE;
  const sheetCtx = sheetCanvas.getContext('2d');

  frames.forEach((frame, idx) => {
    const offsetX = idx * GRID_SIZE * CELL_SIZE;
    for (let row = 0; row < GRID_SIZE; row++) {
      for (let col = 0; col < GRID_SIZE; col++) {
        sheetCtx.fillStyle = frame[row][col];
        sheetCtx.fillRect(offsetX + col * CELL_SIZE, row * CELL_SIZE, CELL_SIZE, CELL_SIZE);
      }
    }
  });

  const link = document.createElement('a');
  link.download = 'spritesheet.png';
  link.href = sheetCanvas.toDataURL();
  link.click();
});

// SAVE / LOAD PROJECT
document.getElementById('saveProjectBtn').addEventListener('click', () => {
  const data = JSON.stringify({ frames, currentFrameIndex });
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'pixel-project.json';
  a.click();
  URL.revokeObjectURL(url);
});

document.getElementById('loadProjectBtn').addEventListener('click', () => {
  document.getElementById('loadProjectInput').click();
});

document.getElementById('loadProjectInput').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    const data = JSON.parse(ev.target.result);
    frames = data.frames;
    currentFrameIndex = data.currentFrameIndex;
    undoStack = [];
    drawCanvas();
    updateFrameThumbnails();
  };
  reader.readAsText(file);
});

// IMPORT IMAGE AS FRAME
document.getElementById('importImageBtn').addEventListener('click', () => {
  document.getElementById('importImageInput').click();
});

document.getElementById('importImageInput').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (ev) => {
    const img = new Image();
    img.onload = () => {
      // Draw image onto offscreen canvas scaled to 32x32
      const offCanvas = document.createElement('canvas');
      offCanvas.width = GRID_SIZE;
      offCanvas.height = GRID_SIZE;
      const offCtx = offCanvas.getContext('2d');

      // Scale image down to grid size
      offCtx.drawImage(img, 0, 0, GRID_SIZE, GRID_SIZE);

      // Convert each pixel to hex color and build frame
      const newFrame = createEmptyFrame();
      const imageData = offCtx.getImageData(0, 0, GRID_SIZE, GRID_SIZE);
      const data = imageData.data; // [r,g,b,a, r,g,b,a, ...]

      for (let row = 0; row < GRID_SIZE; row++) {
        for (let col = 0; col < GRID_SIZE; col++) {
          const i = (row * GRID_SIZE + col) * 4;
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const a = data[i + 3];

          // If pixel is transparent treat as white
          if (a < 128) {
            newFrame[row][col] = '#FFFFFF';
          } else {
            newFrame[row][col] =
              '#' +
              r.toString(16).padStart(2, '0') +
              g.toString(16).padStart(2, '0') +
              b.toString(16).padStart(2, '0');
          }
        }
      }

      // Add as new frame
      frames.push(newFrame);
      currentFrameIndex = frames.length - 1;
      undoStack = [];
      drawCanvas();
      updateFrameThumbnails();
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);

  // Reset input so same file can be loaded again
  e.target.value = '';
});
