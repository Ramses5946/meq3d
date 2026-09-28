import * as THREE from "https://esm.sh/three@0.186.1";
import { STLLoader } from "https://esm.sh/three@0.186.1/examples/jsm/loaders/STLLoader.js?deps=three@0.186.1";

class MeqModelViewer extends HTMLElement {
  static get observedAttributes() { return ["src"]; }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.dragging = false;
    this.previous = { x: 0, y: 0 };
    this.velocity = { x: 0, y: 0 };
    this.zoom = 3.4;
  }

  connectedCallback() {
    this.shadowRoot.innerHTML = `
      <style>
        :host { position: relative; display: block; width: 100%; min-height: 300px; contain: layout paint; overflow: hidden; }
        canvas { position: absolute; inset: 0; display: block; width: 100%; height: 100%; cursor: grab; touch-action: none; }
        canvas:active { cursor: grabbing; }
        .status { position: absolute; inset: 0; display: grid; place-items: center; color: #b3a69c; font: 11px "IBM Plex Mono", monospace; pointer-events: none; }
        .hint { position: absolute; left: 12px; bottom: 10px; color: #74665c; font: 8px "IBM Plex Mono", monospace; pointer-events: none; }
        button { position: absolute; z-index: 2; top: 12px; right: 12px; border: 1px solid #ff843057; border-radius: 4px; background: rgba(9,8,7,.78); color: #f5eee8; padding: 7px 10px; font: 9px "IBM Plex Mono", monospace; cursor: pointer; }
        button:hover { border-color: #ff7a1a; color: #ff7a1a; }
      </style>
      <div class="status">Selecciona un STL para previsualizar</div>
      <div class="hint">3D · STL</div>
      <button type="button" hidden aria-label="Guardar captura PNG">CAPTURA</button>`;

    this.status = this.shadowRoot.querySelector(".status");
    this.captureButton = this.shadowRoot.querySelector("button");
    this.captureButton.hidden = !this.hasAttribute("screenshot");
    this.captureButton.addEventListener("click", () => this.capture());
    this.setupScene();
    this.bindControls();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this);
    this.renderer.setAnimationLoop(() => this.renderFrame());
    if (this.getAttribute("src")) this.loadModel();
  }

  disconnectedCallback() {
    this.resizeObserver?.disconnect();
    this.renderer?.setAnimationLoop(null);
    this.geometry?.dispose();
    this.material?.dispose();
    this.renderer?.dispose();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (name === "src" && oldValue !== newValue && this.renderer) this.loadModel();
  }

  setupScene() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.01, 100);
    this.camera.position.set(0, 0.15, this.zoom);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.shadowMap.enabled = true;
    this.shadowRoot.prepend(this.renderer.domElement);

    this.scene.add(new THREE.HemisphereLight(0xffe2c4, 0x090807, 1.25));
    const key = new THREE.DirectionalLight(0xfff0dd, 4.2);
    key.position.set(3, 4, 5);
    key.castShadow = true;
    this.scene.add(key);
    const fill = new THREE.DirectionalLight(0xff7a1a, 2.2);
    fill.position.set(-4, 1, 3);
    this.scene.add(fill);
    const rim = new THREE.DirectionalLight(0x6bd9f4, 2.6);
    rim.position.set(1, 3, -4);
    this.scene.add(rim);

    this.pivot = new THREE.Group();
    this.pivot.rotation.set(-0.35, 0.45, 0);
    this.scene.add(this.pivot);
    const grid = new THREE.GridHelper(5, 12, 0xff7a1a, 0x4b2a18);
    grid.position.y = -1.15;
    grid.material.transparent = true;
    grid.material.opacity = 0.22;
    this.scene.add(grid);
    this.resize();
  }

  bindControls() {
    const canvas = this.renderer.domElement;
    canvas.addEventListener("pointerdown", (event) => {
      this.dragging = true;
      this.previous = { x: event.clientX, y: event.clientY };
      canvas.setPointerCapture(event.pointerId);
    });
    canvas.addEventListener("pointermove", (event) => {
      if (!this.dragging) return;
      const dx = event.clientX - this.previous.x;
      const dy = event.clientY - this.previous.y;
      this.previous = { x: event.clientX, y: event.clientY };
      this.pivot.rotation.y += dx * 0.008;
      this.pivot.rotation.x = THREE.MathUtils.clamp(this.pivot.rotation.x + dy * 0.008, -Math.PI / 2, Math.PI / 2);
      this.velocity = { x: dx * 0.008, y: dy * 0.008 };
    });
    canvas.addEventListener("pointerup", () => { this.dragging = false; });
    canvas.addEventListener("pointercancel", () => { this.dragging = false; });
    canvas.addEventListener("wheel", (event) => {
      event.preventDefault();
      this.zoom = THREE.MathUtils.clamp(this.zoom + event.deltaY * 0.003, 1.6, 7);
      this.camera.position.z = this.zoom;
    }, { passive: false });
  }

  resize() {
    if (!this.renderer) return;
    const width = Math.max(this.clientWidth, 1);
    const height = Math.max(this.clientHeight, 1);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  loadModel() {
    const src = this.getAttribute("src");
    if (!src) return;
    this.status.hidden = false;
    this.status.textContent = "Cargando modelo 3D…";
    new STLLoader().load(src, (geometry) => {
      this.geometry?.dispose();
      this.material?.dispose();
      if (this.mesh) this.pivot.remove(this.mesh);
      geometry.computeVertexNormals();
      geometry.computeBoundingBox();
      const size = geometry.boundingBox.getSize(new THREE.Vector3());
      const center = geometry.boundingBox.getCenter(new THREE.Vector3());
      geometry.translate(-center.x, -center.y, -center.z);
      const scale = 1.55 / Math.max(size.x, size.y, size.z, 0.001);
      this.material = new THREE.MeshStandardMaterial({ color: 0xbeb6ae, metalness: 0.48, roughness: 0.42 });
      this.geometry = geometry;
      this.mesh = new THREE.Mesh(geometry, this.material);
      this.mesh.scale.setScalar(scale);
      this.mesh.castShadow = true;
      this.mesh.receiveShadow = true;
      this.pivot.add(this.mesh);
      this.status.hidden = true;
      this.dispatchEvent(new CustomEvent("model-loaded", { bubbles: true }));
    }, (event) => {
      if (event.total) this.status.textContent = `${Math.round(event.loaded / event.total * 100)} %`;
    }, () => {
      this.status.hidden = false;
      this.status.textContent = "No fue posible visualizar este STL.";
      this.dispatchEvent(new CustomEvent("model-error", { bubbles: true }));
    });
  }

  renderFrame() {
    if (this.mesh && this.hasAttribute("auto-rotate") && !this.dragging) this.pivot.rotation.y += 0.0035;
    if (!this.dragging) {
      this.pivot.rotation.y += this.velocity.x;
      this.pivot.rotation.x = THREE.MathUtils.clamp(this.pivot.rotation.x + this.velocity.y, -Math.PI / 2, Math.PI / 2);
      this.velocity.x *= 0.92;
      this.velocity.y *= 0.92;
    }
    this.renderer.render(this.scene, this.camera);
  }

  capture() {
    this.renderer.render(this.scene, this.camera);
    const link = document.createElement("a");
    link.download = "meq3d-modelo.png";
    link.href = this.renderer.domElement.toDataURL("image/png");
    link.click();
  }
}

customElements.define("meq-model-viewer", MeqModelViewer);
