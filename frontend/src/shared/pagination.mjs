export const PAGE_SIZE = 7;

export function getPageWindow(page, totalPages, visible = 5) {
  const count = Math.max(0, totalPages);
  const length = Math.min(count, visible);
  const start = Math.max(1, Math.min(page - Math.floor(length / 2), count - length + 1));
  return Array.from({ length }, (_, index) => start + index);
}
