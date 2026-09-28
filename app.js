const STORE_CONFIG = {
  sellerName: "",
  sellerId: "",
  legalAddress: "",
  email: "",
  phone: "",
  representative: "",
  shipping: "",
};

const products = [
  {
    id: "M3D-OWL-01",
    name: "Búho Vector",
    image: "assets/buho-vector.png",
    material: "PLA",
    finish: "Mate",
    scale: "A definir",
    license: "Concepto original",
    category: "pla",
    description: "Figura geométrica de líneas limpias, pensada para escritorio o biblioteca.",
  },
  {
    id: "M3D-GRD-01",
    name: "Guardián Umbral",
    image: "assets/guardian-umbral.png",
    material: "Resina",
    finish: "Grafito",
    scale: "A definir",
    license: "Concepto original",
    category: "resina",
    description: "Pieza de exhibición con armadura abstracta y detalles de alto contraste.",
  },
  {
    id: "M3D-FOX-01",
    name: "Zorro Prisma",
    image: "assets/zorro-prisma.png",
    material: "PLA",
    finish: "Bicolor",
    scale: "A definir",
    license: "Concepto original",
    category: "pla",
    description: "Silueta low-poly original con facetas marcadas y acabado cálido.",
  },
];

const qs = (selector, parent = document) => parent.querySelector(selector);
const qsa = (selector, parent = document) => [...parent.querySelectorAll(selector)];
let quote = JSON.parse(localStorage.getItem("meq3d-quote") || "[]");

function saveQuote() {
  localStorage.setItem("meq3d-quote", JSON.stringify(quote));
  renderQuote();
}

function renderProducts(filter = "all") {
  const grid = qs("[data-product-grid]");
  const visible = products.filter((product) => filter === "all" || product.category === filter);
  grid.innerHTML = visible.map((product) => `
    <article class="product-card">
      <div class="product-image">
        <img src="${product.image}" alt="Vista conceptual de ${product.name}" loading="lazy" />
        <span class="concept-badge">IMAGEN CONCEPTUAL</span>
      </div>
      <div class="product-body">
        <div class="product-code"><span>${product.id}</span><span>${product.license}</span></div>
        <h3>${product.name}</h3>
        <p>${product.description}</p>
        <div class="product-meta">
          <div><small>MATERIAL</small><strong>${product.material}</strong></div>
          <div><small>ACABADO</small><strong>${product.finish}</strong></div>
          <div><small>PRECIO</small><strong>Cotizar</strong></div>
        </div>
        <div class="product-actions">
          <button type="button" data-view-product="${product.id}">Ver ficha</button>
          <button class="add-button" type="button" data-add-product="${product.id}">Cotizar +</button>
        </div>
      </div>
    </article>
  `).join("");
}

function addProduct(id) {
  const product = products.find((item) => item.id === id);
  if (!product || quote.some((item) => item.id === id)) return;
  quote.push({ id: product.id, name: product.name, detail: `${product.material} · ${product.finish}`, image: product.image });
  saveQuote();
  openQuote();
}

function renderQuote() {
  const items = qs("[data-quote-items]");
  const empty = qs("[data-quote-empty]");
  qsa("[data-quote-count]").forEach((node) => { node.textContent = quote.length; });
  items.innerHTML = quote.map((item) => `
    <div class="drawer-item">
      ${item.image ? `<img src="${item.image}" alt="" />` : `<span aria-hidden="true">◇</span>`}
      <div><strong>${item.name}</strong><small>${item.detail}</small></div>
      <button type="button" data-remove-item="${item.id}" aria-label="Quitar ${item.name}">×</button>
    </div>
  `).join("");
  empty.hidden = quote.length > 0;
  items.hidden = quote.length === 0;
}

function openQuote() {
  qs("[data-quote-drawer]").classList.add("open");
  qs("[data-quote-drawer]").setAttribute("aria-hidden", "false");
  qs("[data-drawer-backdrop]").classList.add("open");
  document.body.style.overflow = "hidden";
}

function closeQuote() {
  qs("[data-quote-drawer]").classList.remove("open");
  qs("[data-quote-drawer]").setAttribute("aria-hidden", "true");
  qs("[data-drawer-backdrop]").classList.remove("open");
  document.body.style.overflow = "";
}

function openProduct(id) {
  const product = products.find((item) => item.id === id);
  if (!product) return;
  qs("[data-product-dialog-content]").innerHTML = `
    <div class="dialog-product">
      <img src="${product.image}" alt="Vista conceptual de ${product.name}" />
      <div class="dialog-product-copy">
        <p class="mono-label">${product.id} / VISTA CONCEPTUAL</p>
        <h2>${product.name}</h2>
        <p>${product.description}</p>
        <dl>
          <div><dt>MATERIAL</dt><dd>${product.material}</dd></div>
          <div><dt>ACABADO</dt><dd>${product.finish}</dd></div>
          <div><dt>ESCALA</dt><dd>${product.scale}</dd></div>
          <div><dt>LICENCIA</dt><dd>${product.license}</dd></div>
          <div><dt>PRECIO</dt><dd>Debe cotizarse</dd></div>
        </dl>
        <p class="legal-warning">Esta imagen no acredita la existencia de un modelo 3D imprimible. La ficha debe reemplazarse con evidencia real antes de vender.</p>
        <button class="button button-primary" type="button" data-dialog-add="${product.id}">Agregar a cotización</button>
      </div>
    </div>`;
  qs("[data-product-dialog]").showModal();
}

function sellerConfigured() {
  return ["sellerName", "sellerId", "legalAddress", "email", "phone"].every((key) => STORE_CONFIG[key].trim());
}

function renderSeller() {
  const status = qs("[data-seller-status]");
  if (!sellerConfigured()) return;
  status.innerHTML = `<strong>${STORE_CONFIG.sellerName}</strong><br>${STORE_CONFIG.sellerId}<br>${STORE_CONFIG.email} · ${STORE_CONFIG.phone}`;
}

document.addEventListener("click", (event) => {
  const filter = event.target.closest("[data-filter]");
  if (filter) {
    qsa("[data-filter]").forEach((button) => button.classList.toggle("active", button === filter));
    renderProducts(filter.dataset.filter);
  }
  const add = event.target.closest("[data-add-product]");
  if (add) addProduct(add.dataset.addProduct);
  const view = event.target.closest("[data-view-product]");
  if (view) openProduct(view.dataset.viewProduct);
  const dialogAdd = event.target.closest("[data-dialog-add]");
  if (dialogAdd) { qs("[data-product-dialog]").close(); addProduct(dialogAdd.dataset.dialogAdd); }
  if (event.target.closest("[data-open-quote]")) openQuote();
  if (event.target.closest("[data-close-quote]") || event.target.matches("[data-drawer-backdrop]")) closeQuote();
  const remove = event.target.closest("[data-remove-item]");
  if (remove) { quote = quote.filter((item) => item.id !== remove.dataset.removeItem); saveQuote(); }
  if (event.target.closest("[data-clear-quote]")) { quote = []; saveQuote(); }
  if (event.target.closest("[data-close-dialog]")) qs("[data-product-dialog]").close();
  if (event.target.closest("[data-open-legal]")) qs("[data-legal-dialog]").showModal();
  if (event.target.closest("[data-close-legal]")) qs("[data-legal-dialog]").close();
  if (event.target.closest("[data-open-seller]")) qs("[data-seller-dialog]").showModal();
  if (event.target.closest("[data-close-seller]")) qs("[data-seller-dialog]").close();
  const toggle = event.target.closest(".menu-toggle");
  if (toggle) {
    const open = toggle.getAttribute("aria-expanded") === "true";
    toggle.setAttribute("aria-expanded", String(!open));
    qs(".main-nav").classList.toggle("open", !open);
  }
  if (event.target.closest(".main-nav a")) { qs(".main-nav").classList.remove("open"); qs(".menu-toggle").setAttribute("aria-expanded", "false"); }
});

qs("[data-custom-form]").addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const item = {
    id: `CUSTOM-${Date.now()}`,
    name: data.get("project"),
    detail: `${data.get("size")} · ${data.get("details")}`,
    image: "",
  };
  quote.push(item);
  saveQuote();
  event.currentTarget.reset();
  qs("[data-form-note]").textContent = "Solicitud agregada. Revisa el resumen de cotización.";
  openQuote();
});

qs("[data-copy-quote]").addEventListener("click", async () => {
  const status = qs("[data-copy-status]");
  if (!quote.length) { status.textContent = "Agrega al menos una pieza."; return; }
  const summary = ["SOLICITUD DE COTIZACIÓN · MEQ3D", "", ...quote.map((item, index) => `${index + 1}. ${item.name}\n   ${item.detail}`), "", "Datos de contacto del cliente:", "Nombre:", "Correo/teléfono:"].join("\n");
  try { await navigator.clipboard.writeText(summary); status.textContent = "Resumen copiado al portapapeles."; }
  catch { status.textContent = "No fue posible copiar. Selecciona el resumen manualmente."; }
});

window.addEventListener("scroll", () => qs("[data-header]").classList.toggle("scrolled", scrollY > 20), { passive: true });
qsa("dialog").forEach((dialog) => dialog.addEventListener("click", (event) => {
  const rect = dialog.getBoundingClientRect();
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
}));

qs("[data-year]").textContent = new Date().getFullYear();
renderProducts();
renderQuote();
renderSeller();
