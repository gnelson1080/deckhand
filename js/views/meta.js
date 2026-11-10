export function render(root, param) {
  root.innerHTML = `<h1 class="page-title">meta</h1><p class="page-lede">Coming together. ${param ?? ''}</p>`;
}
