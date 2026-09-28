const adminForm = document.querySelector("[data-admin-form]");
const adminStatus = document.querySelector("[data-admin-status]");
const adminSubmit = document.querySelector("[data-admin-submit]");
const adminProducts = document.querySelector("[data-admin-products]");
const localHostnames = new Set(["127.0.0.1", "localhost"]);
const adminModelInput = adminForm.querySelector('input[name="model"]');
const adminModelPreview = document.querySelector("[data-admin-model-preview]");
let adminPreviewUrl = "";

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  })[character]);
}

function fileAsDataUrl(file, fallbackType = "") {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result);
      resolve(fallbackType && !file.type ? result.replace(/^data:;/, `data:${fallbackType};`) : result);
    };
    reader.onerror = () => reject(new Error(`No fue posible leer ${file.name}.`));
    reader.readAsDataURL(file);
  });
}

async function loadProducts() {
  try {
    const response = await fetch("/api/catalog", { cache: "no-store" });
    const data = await response.json();
    const products = Array.isArray(data.products) ? data.products : [];
    adminProducts.innerHTML = products.length ? products.map((product) => `
      <article class="admin-product">
        <img src="${escapeHtml(product.image)}" alt="" />
        <div><strong>${escapeHtml(product.name)}</strong><small>${escapeHtml(product.id)} · ${escapeHtml(product.material)} · ${product.hasModel ? "STL guardado" : "sin STL interno"}</small></div>
      </article>`).join("") : "<p>Aún no hay productos personalizados.</p>";
  } catch {
    adminProducts.innerHTML = "<p>No fue posible cargar el catálogo.</p>";
  }
}

if (!localHostnames.has(location.hostname)) {
  adminForm.querySelectorAll("input, select, textarea, button").forEach((element) => { element.disabled = true; });
  adminStatus.dataset.state = "error";
  adminStatus.textContent = "Abre este panel desde la URL local indicada arriba.";
}

adminModelInput.addEventListener("change", () => {
  const file = adminModelInput.files[0];
  if (adminPreviewUrl) URL.revokeObjectURL(adminPreviewUrl);
  adminPreviewUrl = file ? URL.createObjectURL(file) : "";
  adminModelPreview.hidden = !file;
  if (file) adminModelPreview.querySelector("meq-model-viewer").setAttribute("src", adminPreviewUrl);
});

adminForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(adminForm);
  const image = data.get("image");
  const model = data.get("model");

  if (!(image instanceof File) || !image.size || image.size > 5 * 1024 * 1024) {
    adminStatus.dataset.state = "error";
    adminStatus.textContent = "Selecciona una imagen JPG, PNG o WebP de hasta 5 MB.";
    return;
  }
  if (model instanceof File && model.size > 25 * 1024 * 1024) {
    adminStatus.dataset.state = "error";
    adminStatus.textContent = "El STL opcional supera 25 MB.";
    return;
  }

  adminSubmit.disabled = true;
  adminSubmit.textContent = "Guardando…";
  adminStatus.dataset.state = "";
  adminStatus.textContent = "Procesando archivos…";

  try {
    const payload = {
      id: data.get("id"), name: data.get("name"), description: data.get("description"),
      material: data.get("material"), finish: data.get("finish"), scale: data.get("scale"),
      price: data.get("price"), license: data.get("license"), category: data.get("category"),
      image: await fileAsDataUrl(image),
      model: model instanceof File && model.size ? await fileAsDataUrl(model, "model/stl") : "",
    };
    const response = await fetch("/api/admin/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "No fue posible guardar el producto.");
    adminForm.reset();
    if (adminPreviewUrl) URL.revokeObjectURL(adminPreviewUrl);
    adminPreviewUrl = "";
    adminModelPreview.hidden = true;
    adminStatus.dataset.state = "success";
    adminStatus.textContent = `${result.product.name} ya aparece en el catálogo público.`;
    await loadProducts();
  } catch (error) {
    adminStatus.dataset.state = "error";
    adminStatus.textContent = error.message || "No fue posible guardar el producto.";
  } finally {
    adminSubmit.disabled = false;
    adminSubmit.textContent = "Agregar al catálogo";
  }
});

loadProducts();
