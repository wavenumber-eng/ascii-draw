/**
 * ThreeJSViewport - 3D viewport using Three.js
 *
 * Implements: VIEW-1 to VIEW-32, VIEW-3D-*
 *
 * This viewport renders the ASCII diagram in 3D space, allowing for:
 * - Camera tilt (drafting table effect)
 * - Isometric view
 * - Orbit controls for viewing from any angle
 * - Same coordinate transform interface as Canvas2D
 *
 * Requires: Three.js (loaded from CDN or bundled)
 */
var AsciiEditor = AsciiEditor || {};
AsciiEditor.viewport = AsciiEditor.viewport || {};

AsciiEditor.viewport.ThreeJSViewport = class ThreeJSViewport extends AsciiEditor.viewport.IViewport {

  constructor(options = {}) {
    super();

    // Cell dimensions
    this.cellWidth = options.cellWidth || 10;
    this.cellHeight = options.cellHeight || 20;

    // Grid configuration
    this.gridCols = options.cols || 120;
    this.gridRows = options.rows || 60;
    this.gridVisible = true;

    // Three.js objects
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;

    // Content rendering
    this.contentPlane = null;
    this.contentTexture = null;
    this.contentCanvas = null;
    this.contentCtx = null;

    // Grid rendering
    this.gridHelper = null;

    // Pluggable renderers (unused in 3D - we render directly)
    this.renderBackend = null;
    this.overlayRenderer = null;

    // Camera state
    this.tiltAngle = 90; // degrees - look straight down initially
    this.isIsometricMode = false;
    this.cameraDistance = 1500;

    // Render state
    this.renderPending = false;
    this.renderCallback = null;
    this.container = null;

    // Navigation state
    this.panX = 0;
    this.panY = 0;
    this.zoomLevel = 1.0;
    this.minZoom = 0.25;
    this.maxZoom = 4.0;
  }

  // ============================================================
  // Lifecycle
  // ============================================================

  attach(container) {
    if (typeof THREE === 'undefined') {
      console.error('Three.js not loaded. Add <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>');
      return;
    }

    this.container = container;

    // Create scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a1a1a);

    // Calculate world dimensions
    const worldWidth = this.gridCols * this.cellWidth;
    const worldHeight = this.gridRows * this.cellHeight;

    // Create camera
    const aspect = container.clientWidth / container.clientHeight;
    this.camera = new THREE.PerspectiveCamera(45, aspect, 1, 10000);
    // Camera will be positioned after controls are set up

    // Create renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(this.renderer.domElement);

    // Create off-screen canvas for text rendering
    this.contentCanvas = document.createElement('canvas');
    this.contentCanvas.width = worldWidth * 2; // Higher resolution
    this.contentCanvas.height = worldHeight * 2;
    this.contentCtx = this.contentCanvas.getContext('2d');

    // Create texture from canvas
    this.contentTexture = new THREE.CanvasTexture(this.contentCanvas);
    this.contentTexture.minFilter = THREE.LinearFilter;
    this.contentTexture.magFilter = THREE.LinearFilter;

    // Create content plane
    const planeGeometry = new THREE.PlaneGeometry(worldWidth, worldHeight);
    const planeMaterial = new THREE.MeshBasicMaterial({
      map: this.contentTexture,
      side: THREE.DoubleSide
    });
    this.contentPlane = new THREE.Mesh(planeGeometry, planeMaterial);
    this.contentPlane.position.set(worldWidth / 2, -worldHeight / 2, 0);
    this.scene.add(this.contentPlane);

    // Create 3D grid lines (disabled - grid is drawn to texture instead)
    // this._createGrid();

    // Add map controls for 2D-like navigation
    if (typeof THREE.MapControls !== 'undefined') {
      this.controls = new THREE.MapControls(this.camera, this.renderer.domElement);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.1;
      this.controls.screenSpacePanning = true;
      this.controls.panSpeed = 0.9;
      this.controls.zoomSpeed = 1.2;
      this.controls.rotateSpeed = 0.5;
      this.controls.target.set(worldWidth / 2, -worldHeight / 2, 0);

      // Limit tilt to ±30° from straight-on view
      const tiltLimit = Math.PI / 6; // 30 degrees
      this.controls.minPolarAngle = Math.PI / 2 - tiltLimit;
      this.controls.maxPolarAngle = Math.PI / 2 + tiltLimit;
      this.controls.minAzimuthAngle = -tiltLimit;
      this.controls.maxAzimuthAngle = tiltLimit;

      // Right-click = pan, Left = tools (handled by Editor)
      this.controls.mouseButtons = {
        LEFT: null,
        MIDDLE: THREE.MOUSE.PAN,
        RIGHT: THREE.MOUSE.PAN
      };

      // Track shift key for rotate mode
      this._shiftPressed = false;
      this._onKeyDown = (e) => {
        if (e.key === 'Shift' && !this._shiftPressed) {
          this._shiftPressed = true;
          this.controls.mouseButtons.RIGHT = THREE.MOUSE.ROTATE;
        }
      };
      this._onKeyUp = (e) => {
        if (e.key === 'Shift') {
          this._shiftPressed = false;
          this.controls.mouseButtons.RIGHT = THREE.MOUSE.PAN;
        }
      };
      this._onBlur = () => {
        this._shiftPressed = false;
        this.controls.mouseButtons.RIGHT = THREE.MOUSE.PAN;
      };
      window.addEventListener('keydown', this._onKeyDown);
      window.addEventListener('keyup', this._onKeyUp);
      window.addEventListener('blur', this._onBlur);

    } else if (typeof THREE.OrbitControls !== 'undefined') {
      // Fallback to OrbitControls
      this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.1;
      this.controls.screenSpacePanning = true;
      this.controls.target.set(worldWidth / 2, -worldHeight / 2, 0);

      this.controls.mouseButtons = {
        LEFT: null,
        MIDDLE: THREE.MOUSE.PAN,
        RIGHT: THREE.MOUSE.PAN
      };
    }

    // Position camera looking straight down at content
    this.camera.position.set(worldWidth / 2, -worldHeight / 2, this.cameraDistance);
    this.camera.lookAt(worldWidth / 2, -worldHeight / 2, 0);
    if (this.controls) {
      this.controls.update();
    }

    // Handle resize
    this._resizeHandler = () => this._onResize();
    window.addEventListener('resize', this._resizeHandler);

    // Start render loop
    this._animate();
  }

  detach() {
    if (this._resizeHandler) {
      window.removeEventListener('resize', this._resizeHandler);
    }

    // Remove keyboard listeners for shift-rotate
    if (this._onKeyDown) {
      window.removeEventListener('keydown', this._onKeyDown);
      window.removeEventListener('keyup', this._onKeyUp);
      window.removeEventListener('blur', this._onBlur);
    }

    if (this.renderer && this.renderer.domElement && this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }

    if (this.controls) {
      this.controls.dispose();
    }

    if (this.renderer) {
      this.renderer.dispose();
    }

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.container = null;
  }

  // ============================================================
  // Coordinate Transforms
  // ============================================================

  screenToCell(screenX, screenY) {
    if (!this.camera || !this.renderer) {
      return { col: 0, row: 0 };
    }

    // screenX/screenY are already canvas-relative (not client coordinates)
    const rect = this.renderer.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      (screenX / rect.width) * 2 - 1,
      -(screenY / rect.height) * 2 + 1
    );

    // Raycast to find intersection with content plane
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, this.camera);

    // Create a plane at z=0 for intersection
    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    const intersection = new THREE.Vector3();
    const result = raycaster.ray.intersectPlane(plane, intersection);

    if (result) {
      const col = Math.floor(intersection.x / this.cellWidth);
      const row = Math.floor(-intersection.y / this.cellHeight);
      return { col, row };
    }

    return { col: 0, row: 0 };
  }

  cellToScreen(col, row) {
    if (!this.camera || !this.renderer) {
      return { x: 0, y: 0 };
    }

    // Convert cell to world position
    const worldPos = new THREE.Vector3(
      col * this.cellWidth + this.cellWidth / 2,
      -(row * this.cellHeight + this.cellHeight / 2),
      0
    );

    // Project to screen
    worldPos.project(this.camera);

    const rect = this.renderer.domElement.getBoundingClientRect();
    return {
      x: (worldPos.x + 1) / 2 * rect.width,
      y: (-worldPos.y + 1) / 2 * rect.height
    };
  }

  getCellBounds(col, row) {
    const pos = this.cellToScreen(col, row);
    const nextPos = this.cellToScreen(col + 1, row + 1);
    return {
      x: pos.x,
      y: pos.y,
      width: Math.abs(nextPos.x - pos.x),
      height: Math.abs(nextPos.y - pos.y)
    };
  }

  // ============================================================
  // Cell Dimensions
  // ============================================================

  setCellDimensions(width, height) {
    this.cellWidth = width;
    this.cellHeight = height;
    this._rebuildGeometry();
  }

  getCellDimensions() {
    return {
      width: this.cellWidth,
      height: this.cellHeight
    };
  }

  // ============================================================
  // Navigation
  // ============================================================

  pan(dx, dy) {
    if (this.controls) {
      // Pan the orbit controls target
      const panSpeed = 2 / this.zoomLevel;
      this.controls.target.x -= dx * panSpeed;
      this.controls.target.y += dy * panSpeed;
      this.controls.update();
    }
  }

  zoom(factor, centerX, centerY) {
    const newZoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoomLevel * factor));
    if (newZoom !== this.zoomLevel) {
      this.zoomLevel = newZoom;
      this._updateCameraPosition();
    }
  }

  getZoom() {
    return this.zoomLevel;
  }

  resetView() {
    this.setViewPreset('top');
  }

  /**
   * Set camera to a preset view angle (keeps current distance, animates smoothly)
   * @param {string} preset - 'top', 'angle', 'iso', 'front', 'side'
   */
  setViewPreset(preset) {
    if (!this.camera || !this.controls) return;

    // Get current distance from target (preserve zoom level)
    const currentDist = this.camera.position.distanceTo(this.controls.target);
    const target = this.controls.target.clone();

    // Calculate target camera position based on preset angles
    let polar, azimuth;
    switch (preset) {
      case 'top':
        // Straight down
        polar = 0;
        azimuth = 0;
        break;
      case 'angle':
        // Tilted from bottom (drafting table)
        polar = Math.PI / 6;  // 30° tilt
        azimuth = 0;
        break;
      case 'iso':
        // Isometric-style from corner
        polar = Math.PI / 6;  // 30° tilt
        azimuth = Math.PI / 6; // 30° rotation
        break;
      case 'front':
        // More tilted from bottom
        polar = Math.PI / 4;  // 45° tilt
        azimuth = 0;
        break;
      case 'side':
        // Tilted from side
        polar = Math.PI / 6;  // 30° tilt
        azimuth = -Math.PI / 6; // -30° rotation
        break;
      default:
        return;
    }

    // Calculate new camera position (spherical to cartesian)
    // polar = angle from vertical (0 = top down, PI/2 = horizontal)
    // azimuth = angle around vertical axis
    const targetPos = new THREE.Vector3(
      target.x + currentDist * Math.sin(polar) * Math.sin(azimuth),
      target.y - currentDist * Math.sin(polar) * Math.cos(azimuth),
      target.z + currentDist * Math.cos(polar)
    );

    // Animate to new position
    this._animateCameraTo(targetPos, 300);
  }

  /**
   * Smoothly animate camera to a new position
   */
  _animateCameraTo(targetPos, duration = 300) {
    if (this._cameraAnimation) {
      cancelAnimationFrame(this._cameraAnimation);
    }

    const startPos = this.camera.position.clone();
    const startTime = performance.now();

    const animate = () => {
      const elapsed = performance.now() - startTime;
      const t = Math.min(elapsed / duration, 1);

      // Ease out cubic
      const ease = 1 - Math.pow(1 - t, 3);

      this.camera.position.lerpVectors(startPos, targetPos, ease);
      this.camera.lookAt(this.controls.target);
      this.controls.update();

      if (t < 1) {
        this._cameraAnimation = requestAnimationFrame(animate);
      } else {
        this._cameraAnimation = null;
      }
    };

    this._cameraAnimation = requestAnimationFrame(animate);
  }

  // ============================================================
  // 3D-Specific Navigation
  // ============================================================

  setTilt(angle) {
    this.tiltAngle = Math.max(0, Math.min(90, angle));
    this.isIsometricMode = false;
    this._updateCameraPosition();
  }

  getTilt() {
    return this.tiltAngle;
  }

  setIsometric(enabled) {
    this.isIsometricMode = enabled;
    if (enabled) {
      this.tiltAngle = 35.264; // arctan(1/sqrt(2)) for true isometric
    }
    this._updateCameraPosition();
  }

  isIsometric() {
    return this.isIsometricMode;
  }

  setCameraAngle(angle) {
    if (this.controls) {
      // Rotate around the target
      const radians = angle * Math.PI / 180;
      const distance = this.cameraDistance / this.zoomLevel;
      const tiltRad = this.tiltAngle * Math.PI / 180;

      this.camera.position.x = this.controls.target.x + distance * Math.sin(radians) * Math.cos(tiltRad);
      this.camera.position.y = this.controls.target.y + distance * Math.cos(radians) * Math.cos(tiltRad);
      this.camera.position.z = distance * Math.sin(tiltRad);

      this.camera.lookAt(this.controls.target);
      this.controls.update();
    }
  }

  // ============================================================
  // Rendering
  // ============================================================

  setRenderBackend(backend) {
    this.renderBackend = backend;
  }

  getRenderBackend() {
    return this.renderBackend;
  }

  setOverlayRenderer(overlay) {
    this.overlayRenderer = overlay;
  }

  getOverlayRenderer() {
    return this.overlayRenderer;
  }

  render(renderState, overlayState) {
    if (!this.contentCtx) return;

    const width = this.contentCanvas.width;
    const height = this.contentCanvas.height;
    const scaleX = width / (this.gridCols * this.cellWidth);
    const scaleY = height / (this.gridRows * this.cellHeight);

    // Clear canvas
    this.contentCtx.fillStyle = '#1a1a1a';
    this.contentCtx.fillRect(0, 0, width, height);

    // Draw grid
    if (this.gridVisible) {
      this._drawGridToCanvas(scaleX, scaleY);
    }

    // Draw objects
    if (renderState && renderState.renderList) {
      this.contentCtx.save();
      this.contentCtx.scale(scaleX, scaleY);

      renderState.renderList.forEach(obj => {
        this._drawObjectToCanvas(obj);
      });

      this.contentCtx.restore();
    }

    // Update texture
    if (this.contentTexture) {
      this.contentTexture.needsUpdate = true;
    }
  }

  requestRender() {
    if (!this.renderPending) {
      this.renderPending = true;
      requestAnimationFrame(() => {
        if (this.renderCallback) {
          this.renderCallback();
        }
        this.renderPending = false;
      });
    }
  }

  setRenderCallback(callback) {
    this.renderCallback = callback;
  }

  // ============================================================
  // Events
  // ============================================================

  getEventTarget() {
    return this.renderer ? this.renderer.domElement : null;
  }

  getContainer() {
    return this.container;
  }

  // ============================================================
  // Grid
  // ============================================================

  setGridVisible(visible) {
    this.gridVisible = visible;
    if (this.gridHelper) {
      this.gridHelper.visible = visible;
    }
  }

  isGridVisible() {
    return this.gridVisible;
  }

  setGridDimensions(cols, rows) {
    this.gridCols = cols;
    this.gridRows = rows;
    this._rebuildGeometry();
  }

  getGridDimensions() {
    return {
      cols: this.gridCols,
      rows: this.gridRows
    };
  }

  // ============================================================
  // Capabilities
  // ============================================================

  supports3D() {
    return true;
  }

  getType() {
    return 'threejs';
  }

  isFontLoaded() {
    // Assume font is loaded for 3D viewport
    return true;
  }

  // ============================================================
  // Canvas Access (for backward compatibility)
  // ============================================================

  getCanvas() {
    return this.renderer ? this.renderer.domElement : null;
  }

  getContext() {
    // Return the off-screen canvas context for tools that need it
    return this.contentCtx;
  }

  /**
   * Mark the content texture as needing update (call after drawing to contentCtx)
   */
  updateTexture() {
    if (this.contentTexture) {
      this.contentTexture.needsUpdate = true;
    }
  }

  // ============================================================
  // Private Methods
  // ============================================================

  _updateCameraPosition() {
    if (!this.camera) return;

    const worldWidth = this.gridCols * this.cellWidth;
    const worldHeight = this.gridRows * this.cellHeight;
    const distance = this.cameraDistance / this.zoomLevel;
    const tiltRad = this.tiltAngle * Math.PI / 180;

    const targetX = this.controls ? this.controls.target.x : worldWidth / 2;
    const targetY = this.controls ? this.controls.target.y : -worldHeight / 2;

    this.camera.position.set(
      targetX,
      targetY - distance * Math.cos(tiltRad),
      distance * Math.sin(tiltRad)
    );

    this.camera.lookAt(targetX, targetY, 0);

    if (this.controls) {
      this.controls.update();
    }
  }

  _createGrid() {
    if (this.gridHelper) {
      this.scene.remove(this.gridHelper);
    }

    const worldWidth = this.gridCols * this.cellWidth;
    const worldHeight = this.gridRows * this.cellHeight;

    // Create custom grid lines
    const gridGroup = new THREE.Group();

    const lineMaterial = new THREE.LineBasicMaterial({ color: 0x2a2a2a });

    // Vertical lines
    for (let c = 0; c <= this.gridCols; c++) {
      const points = [
        new THREE.Vector3(c * this.cellWidth, 0, 0.1),
        new THREE.Vector3(c * this.cellWidth, -worldHeight, 0.1)
      ];
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const line = new THREE.Line(geometry, lineMaterial);
      gridGroup.add(line);
    }

    // Horizontal lines
    for (let r = 0; r <= this.gridRows; r++) {
      const points = [
        new THREE.Vector3(0, -r * this.cellHeight, 0.1),
        new THREE.Vector3(worldWidth, -r * this.cellHeight, 0.1)
      ];
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const line = new THREE.Line(geometry, lineMaterial);
      gridGroup.add(line);
    }

    this.gridHelper = gridGroup;
    this.gridHelper.visible = this.gridVisible;
    this.scene.add(this.gridHelper);
  }

  _rebuildGeometry() {
    if (!this.scene) return;

    const worldWidth = this.gridCols * this.cellWidth;
    const worldHeight = this.gridRows * this.cellHeight;

    // Rebuild content plane
    if (this.contentPlane) {
      this.scene.remove(this.contentPlane);
      this.contentPlane.geometry.dispose();

      const planeGeometry = new THREE.PlaneGeometry(worldWidth, worldHeight);
      this.contentPlane.geometry = planeGeometry;
      this.contentPlane.position.set(worldWidth / 2, -worldHeight / 2, 0);
      this.scene.add(this.contentPlane);
    }

    // Rebuild canvas
    if (this.contentCanvas) {
      this.contentCanvas.width = worldWidth * 2;
      this.contentCanvas.height = worldHeight * 2;
    }

    // Rebuild grid
    this._createGrid();
  }

  _onResize() {
    if (!this.container || !this.camera || !this.renderer) return;

    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  _animate() {
    if (!this.renderer || !this.scene || !this.camera) return;

    requestAnimationFrame(() => this._animate());

    if (this.controls) {
      this.controls.update();
    }

    this.renderer.render(this.scene, this.camera);
  }

  _drawGridToCanvas(scaleX, scaleY) {
    const ctx = this.contentCtx;
    ctx.save();
    ctx.scale(scaleX, scaleY);

    ctx.strokeStyle = '#3a3a3a';
    ctx.lineWidth = 1;

    const worldWidth = this.gridCols * this.cellWidth;
    const worldHeight = this.gridRows * this.cellHeight;

    // Vertical lines
    for (let c = 0; c <= this.gridCols; c++) {
      ctx.beginPath();
      ctx.moveTo(c * this.cellWidth, 0);
      ctx.lineTo(c * this.cellWidth, worldHeight);
      ctx.stroke();
    }

    // Horizontal lines
    for (let r = 0; r <= this.gridRows; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * this.cellHeight);
      ctx.lineTo(worldWidth, r * this.cellHeight);
      ctx.stroke();
    }

    ctx.restore();
  }

  _drawObjectToCanvas(obj) {
    const ctx = this.contentCtx;
    ctx.fillStyle = '#cccccc';
    ctx.font = '16px BerkeleyMono, monospace';
    ctx.textBaseline = 'top';

    switch (obj.type) {
      case 'box':
      case 'symbol':
        this._drawBoxToCanvas(obj);
        break;
      case 'line':
      case 'wire':
        this._drawLineToCanvas(obj);
        break;
      case 'junction':
      case 'wire-junction':
        this._drawJunctionToCanvas(obj);
        break;
    }
  }

  _drawBoxToCanvas(obj) {
    const ctx = this.contentCtx;
    const { x, y, width, height, style, text } = obj;

    const chars = {
      single: { tl: '┌', tr: '┐', bl: '└', br: '┘', h: '─', v: '│' },
      double: { tl: '╔', tr: '╗', bl: '╚', br: '╝', h: '═', v: '║' },
      thick: { tl: '█', tr: '█', bl: '█', br: '█', h: '█', v: '█' }
    };

    const c = chars[style] || chars.single;
    const hasBorder = style && style !== 'none';

    if (hasBorder) {
      // Top
      this._drawChar(x, y, c.tl);
      for (let col = 1; col < width - 1; col++) {
        this._drawChar(x + col, y, c.h);
      }
      this._drawChar(x + width - 1, y, c.tr);

      // Sides
      for (let row = 1; row < height - 1; row++) {
        this._drawChar(x, y + row, c.v);
        this._drawChar(x + width - 1, y + row, c.v);
      }

      // Bottom
      this._drawChar(x, y + height - 1, c.bl);
      for (let col = 1; col < width - 1; col++) {
        this._drawChar(x + col, y + height - 1, c.h);
      }
      this._drawChar(x + width - 1, y + height - 1, c.br);
    }

    // Text
    if (text) {
      const lines = text.split('\n');
      const startY = y + (hasBorder ? 1 : 0) + Math.floor((height - (hasBorder ? 2 : 0) - lines.length) / 2);
      lines.forEach((line, i) => {
        const startX = x + (hasBorder ? 1 : 0) + Math.floor((width - (hasBorder ? 2 : 0) - line.length) / 2);
        for (let j = 0; j < line.length; j++) {
          this._drawChar(startX + j, startY + i, line[j]);
        }
      });
    }
  }

  _drawLineToCanvas(obj) {
    const { points, style } = obj;
    if (!points || points.length < 2) return;

    const chars = {
      single: { h: '─', v: '│' },
      double: { h: '═', v: '║' },
      thick: { h: '█', v: '█' }
    };

    const c = chars[style] || chars.single;

    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];

      if (p1.y === p2.y) {
        // Horizontal
        const startX = Math.min(p1.x, p2.x);
        const endX = Math.max(p1.x, p2.x);
        for (let x = startX; x <= endX; x++) {
          this._drawChar(x, p1.y, c.h);
        }
      } else if (p1.x === p2.x) {
        // Vertical
        const startY = Math.min(p1.y, p2.y);
        const endY = Math.max(p1.y, p2.y);
        for (let y = startY; y <= endY; y++) {
          this._drawChar(p1.x, y, c.v);
        }
      }
    }
  }

  _drawJunctionToCanvas(obj) {
    this._drawChar(obj.x, obj.y, '●');
  }

  _drawChar(col, row, char) {
    const x = col * this.cellWidth;
    const y = row * this.cellHeight + 2;
    this.contentCtx.fillText(char, x, y);
  }
};
