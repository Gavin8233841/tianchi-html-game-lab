import { MEMORIES } from './core.js';
import { COMIC, COMIC_STORIES } from './comics.js';
import { drawComicPage } from './comic-art.js';

const sections = [
  { id: 'stickers', name: '贴纸', entries: MEMORIES, empty: '第一次开小差的回忆，会贴在这里。' },
  { id: 'comics', name: '漫画', entries: COMIC_STORIES, empty: '在桌洞读完一篇，这里就能重看。' },
];

function cardButton(entry, section, action) {
  const preview = section === 'comics'
    ? `<canvas class='album-cover' data-cover='${entry.id}' width='${COMIC.width}' height='${COMIC.height}' aria-hidden='true'></canvas>`
    : `<span class='album-sticker' aria-hidden='true'>${entry.mark}</span>`;
  return `<button class='album-card' type='button' ${action} data-entry='${entry.id}'>
    ${preview}<span>${entry.title ?? entry.name}</span>
  </button>`;
}

export function paintAlbumCovers(container) {
  for (const canvas of container.querySelectorAll('[data-cover]')) {
    const story = COMIC_STORIES.find((entry) => entry.id === canvas.dataset.cover);
    drawComicPage(canvas.getContext('2d'), story, 0);
  }
}

export function newAlbumCards(memories, comics, initialCounts) {
  const newStickers = memories.slice(initialCounts.stickers)
    .map((id) => MEMORIES.find((entry) => entry.id === id));
  const newComics = comics.slice(initialCounts.comics)
    .map((id) => COMIC_STORIES.find((entry) => entry.id === id));
  return [
    newStickers[0] && cardButton(newStickers[0], 'stickers', "data-open-album='stickers'"),
    newComics[0] && cardButton(newComics[0], 'comics', "data-open-album='comics'"),
    ...newStickers.slice(1).map((entry) => cardButton(entry, 'stickers', "data-open-album='stickers'")),
    ...newComics.slice(1).map((entry) => cardButton(entry, 'comics', "data-open-album='comics'")),
  ].filter(Boolean).slice(0, 2).join('');
}

export function createMemoryAlbum(dialog) {
  const content = dialog.querySelector('#album-content');
  let collections;
  let currentSection;
  let currentEntry = null;
  let opener;
  let page = 0;

  function showList(sectionId, returnTo) {
    currentSection = sections.find((section) => section.id === sectionId);
    currentEntry = null;
    const { name, entries, empty } = currentSection;
    const unlocked = entries.filter((entry) => collections[sectionId].includes(entry.id));
    content.innerHTML = `
      <div class='album-tabs' role='group' aria-label='收藏分类'>
        ${sections.map((section) => `<button type='button' data-album-section='${section.id}'
          aria-pressed='${section.id === sectionId}'>${section.name}</button>`).join('')}
      </div>
      <p class='album-status'>${name} ${unlocked.length}/${entries.length}</p>
      <ul class='album-grid' aria-label='已收藏的${name}'>
        ${unlocked.map((entry) => `<li>${cardButton(entry, sectionId, 'data-album-item')}</li>`).join('')}
        ${"<li class='album-slot' aria-hidden='true'></li>".repeat(entries.length - unlocked.length)}
      </ul>
      ${unlocked.length ? '' : `<p class='album-empty'>${empty}</p>`}`;
    paintAlbumCovers(content);
    dialog.scrollTop = 0;
    focusList(returnTo);
  }

  function focusList(returnTo) {
    const entryButton = [...content.querySelectorAll('[data-album-item]')].find((button) => button.dataset.entry === returnTo);
    (entryButton || content.querySelector('[aria-pressed="true"]')).focus();
  }

  function showEntry(entryId) {
    const { id, entries, name } = currentSection;
    if (!collections[id].includes(entryId)) return false;
    const entry = entries.find((item) => item.id === entryId);
    if (!entry) return false;
    currentEntry = entry;
    page = 0;
    const artwork = id === 'comics'
      ? `<canvas class='album-page' width='${COMIC.width * 2}' height='${COMIC.height * 2}' role='img'></canvas>
        <div class='album-pagination'>
          <button type='button' data-album-turn='-1'>上一页</button>
          <span class='album-page-number' aria-live='polite'></span>
          <button type='button' data-album-turn='1'>下一页</button>
        </div>`
      : `<span class='album-sticker album-sticker-detail' aria-hidden='true'>${entry.mark}</span>
        <p>${entry.description}</p>`;
    content.innerHTML = `
      <button type='button' class='album-back' data-album-back>← 返回${name}</button>
      <div class='album-detail'><h3>${entry.title ?? entry.name}</h3>${artwork}</div>`;
    if (id === 'comics') drawPage();
    dialog.scrollTop = 0;
    content.querySelector('[data-album-back]').focus();
    return true;
  }

  function drawPage() {
    const canvas = content.querySelector('.album-page');
    drawComicPage(canvas.getContext('2d'), currentEntry, page, 0, 0, 2);
    canvas.setAttribute('aria-label', `第 ${page + 1} 页，${currentEntry.pages[page].line}`);
    content.querySelector('.album-page-number').textContent = `${page + 1}/${currentEntry.pages.length}`;
    content.querySelector('[data-album-turn="-1"]').disabled = page === 0;
    content.querySelector('[data-album-turn="1"]').disabled = page === currentEntry.pages.length - 1;
  }

  function turnPage(direction) {
    const next = page + direction;
    if (next < 0 || next >= currentEntry.pages.length) return;
    page = next;
    const focused = document.activeElement;
    drawPage();
    if (focused?.matches('[data-album-turn]:disabled')) {
      content.querySelector('[data-album-turn]:enabled').focus({ preventScroll: true });
    }
  }

  dialog.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.dataset.albumSection) showList(button.dataset.albumSection);
    else if (button.hasAttribute('data-album-item')) showEntry(button.dataset.entry);
    else if (button.hasAttribute('data-album-back')) showList(currentSection.id, currentEntry.id);
    else if (button.dataset.albumTurn) turnPage(Number(button.dataset.albumTurn));
  });
  dialog.addEventListener('keydown', (event) => {
    if (!currentEntry?.pages || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    turnPage(event.key === 'ArrowLeft' ? -1 : 1);
  });
  dialog.addEventListener('close', () => opener?.focus());

  return function openAlbum(button, owned) {
    collections = owned;
    opener = button;
    const sectionId = button.dataset.openAlbum === 'comics' ? 'comics' : 'stickers';
    dialog.showModal();
    currentSection = sections.find((section) => section.id === sectionId);
    if (!button.dataset.entry || !showEntry(button.dataset.entry)) showList(sectionId);
  };
}
