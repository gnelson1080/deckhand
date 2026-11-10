export function render(root, param) {
  root.innerHTML = `<h1 class="page-title">card</h1><p class="page-lede">Coming together. ${param ?? ''}</p>`;
}
