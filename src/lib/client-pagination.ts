interface RenderOptions {
  reset?: boolean;
}

interface PagerOptions {
  pageSize?: number;
  initialPage?: number;
}

export function createTablePager(
  root: HTMLElement,
  allRows: HTMLElement[],
  options: PagerOptions = {},
) {
  const pageSize = options.pageSize ?? 50;
  const pagination = root.querySelector<HTMLElement>('[data-pagination]');
  const pageList = root.querySelector<HTMLElement>('[data-page-list]');
  const previous = root.querySelector<HTMLButtonElement>('[data-page-action="previous"]');
  const next = root.querySelector<HTMLButtonElement>('[data-page-action="next"]');
  const range = root.querySelector<HTMLElement>('[data-page-range]');
  const resultsBar = root.querySelector<HTMLElement>('.table-results-bar');

  let currentPage = Math.max(1, options.initialPage ?? 1);
  let matchingRows = [...allRows];

  const renderPageList = (totalPages: number) => {
    if (!pageList) return;
    pageList.replaceChildren();

    const pageAnchors = new Set([1, totalPages, currentPage - 1, currentPage, currentPage + 1]);
    const anchors = [...pageAnchors]
      .filter((page) => page >= 1 && page <= totalPages)
      .sort((a, b) => a - b);
    const visible: number[] = [];
    let last = 0;

    anchors.forEach((page) => {
      if (last && page - last === 2) visible.push(last + 1);
      visible.push(page);
      last = page;
    });

    last = 0;
    visible.forEach((page) => {
      if (last && page - last > 1) {
        const ellipsis = document.createElement('span');
        ellipsis.className = 'archive-pagination__ellipsis';
        ellipsis.textContent = '…';
        ellipsis.setAttribute('aria-hidden', 'true');
        pageList.appendChild(ellipsis);
      }

      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.page = String(page);
      button.textContent = String(page);
      button.setAttribute('aria-label', `Page ${page}`);
      if (page === currentPage) button.setAttribute('aria-current', 'page');
      pageList.appendChild(button);
      last = page;
    });
  };

  const paint = (scroll = false) => {
    const totalPages = Math.max(1, Math.ceil(matchingRows.length / pageSize));
    currentPage = Math.min(currentPage, totalPages);
    const start = (currentPage - 1) * pageSize;
    const end = Math.min(start + pageSize, matchingRows.length);

    allRows.forEach((row) => { row.style.display = 'none'; });
    matchingRows.slice(start, end).forEach((row) => { row.style.display = ''; });

    if (range) {
      range.textContent = matchingRows.length
        ? `Showing ${start + 1}–${end}`
        : 'No entries to display';
    }
    if (pagination) pagination.hidden = matchingRows.length <= pageSize;
    if (previous) previous.disabled = currentPage === 1;
    if (next) next.disabled = currentPage === totalPages;
    renderPageList(totalPages);

    if (scroll) resultsBar?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  pagination?.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button');
    if (!button || button.disabled) return;

    if (button.dataset.pageAction === 'previous') currentPage--;
    else if (button.dataset.pageAction === 'next') currentPage++;
    else if (button.dataset.page) currentPage = Number(button.dataset.page);
    else return;

    paint(true);
  });

  return {
    render(rows: HTMLElement[], { reset = false }: RenderOptions = {}) {
      matchingRows = rows;
      if (reset) currentPage = 1;
      paint();
    },
  };
}
