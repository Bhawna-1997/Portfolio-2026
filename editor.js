/* ============================================================
   CASE STUDY EDITOR — DEV ONLY
   Feature-flagged. Remove this file + editor.css before going live.

   To ENABLE:  open browser console → localStorage.setItem('bn_editor','true'); location.reload()
   Or append ?editor to any case study URL.
   To DISABLE: localStorage.removeItem('bn_editor'); location.reload()
   ============================================================ */

(function () {
  'use strict';

  const EDITOR_ACTIVE =
    localStorage.getItem('bn_editor') === 'true' ||
    new URLSearchParams(location.search).has('editor');

  const STORAGE_KEY = 'bn_content_' + location.pathname;

  /* ── File handle (File System Access API) ── */
  let fileHandle = null;

  /* ─── Selectors for text elements we can edit ─── */
  const TEXT_SEL = [
    '.pz-hero__title', '.pz-hero__meta',
    '.pz-h2', '.pz-eyebrow', '.pz-step-title', '.pz-backstory-label',
    '.pz-body', '.pz-list',
    '.pz-metric__num', '.pz-metric__label',
    '.pz-pullbar__text', '.pz-principle__quote', '.pz-principle__pre',
    '.pz-approach__title', '.pz-approach__copy', '.pz-approach__pro',
    '.pz-approach__but', '.pz-approach__verdict',
    '.pz-flow-label', '.pz-atv__copy', '.pz-atv__headline-text',
    '.pz-atv__headline', '.pz-tile__name', '.pz-tile__balance',
    '.case-hero__title', '.case-section__content', '.case-section__label',
    '.case-image__caption', '.case-next__title',
  ].join(',');

  /* ─── Assign stable data-eid to every editable element ─── */
  function assignEids() {
    const all = [TEXT_SEL, '.pz-ph', 'img[src]'].join(',');
    document.querySelectorAll(all).forEach((el, i) => {
      if (!el.dataset.eid) el.dataset.eid = 'e' + i;
    });
  }

  /* ─── Persist & restore ─── */
  function saveContent() {
    const data = {};
    document.querySelectorAll('[data-eid]').forEach(el => {
      if (el.tagName === 'IMG') {
        data[el.dataset.eid] = { type: 'img', src: el.src, alt: el.alt };
      } else {
        const entry = { type: 'html', html: el.innerHTML };
        if (el.dataset.hasMedia) entry.hasMedia = el.dataset.hasMedia;
        const style = el.getAttribute('style');
        if (style) entry.style = style;
        data[el.dataset.eid] = entry;
      }
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return data;
  }

  function restoreContent() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    let data;
    try { data = JSON.parse(raw); } catch (e) { return; }
    document.querySelectorAll('[data-eid]').forEach(el => {
      const entry = data[el.dataset.eid];
      if (!entry) return;
      if (entry.type === 'img') {
        if (entry.src) { el.src = entry.src; el.alt = entry.alt || ''; }
      } else {
        el.innerHTML = entry.html;
        if (entry.hasMedia) el.dataset.hasMedia = entry.hasMedia;
        if (entry.style) el.setAttribute('style', entry.style);
      }
    });
  }

  /* ────────────────────────────────────────────
     EDITOR UI (only when feature flag is on)
  ──────────────────────────────────────────── */

  function initEditor() {
    document.body.classList.add('editor-mode');
    buildDock();
    buildElToolbar();
    buildFormatBar();
    setupTextEditing();
    setupPlaceholderClicks();
    setupInsertButtons();
    setupSpacingControls();
    setupGrouping();
    setupDragging();
    listenForSelection();
  }

  /* ── Floating dock ── */
  function buildDock() {
    const dock = document.createElement('div');
    dock.id = 'bn-editor-dock';
    dock.innerHTML = `
      <span class="bn-ed-badge">✏ Editor</span>
      <button class="bn-ed-btn bn-ed-save">Save</button>
      <div class="bn-ed-add" style="position:relative">
        <button class="bn-ed-btn bn-ed-add-trigger">＋ Add Block</button>
        <div class="bn-ed-add-menu" hidden>
          <button data-block="text">Paragraph</button>
          <button data-block="heading">Heading</button>
          <button data-block="image">Image / GIF</button>
          <button data-block="image-full">Full-width Image</button>
          <button data-block="video">Video</button>
          <button data-block="two-col">Two-column</button>
        </div>
      </div>
      <button class="bn-ed-btn bn-ed-select">◻ Select</button>
      <button class="bn-ed-btn bn-ed-reset">Reset page</button>
    `;
    document.body.appendChild(dock);

    dock.querySelector('.bn-ed-save').addEventListener('click', async () => {
      saveContent();
      await syncToFile();
    });

    dock.querySelector('.bn-ed-reset').addEventListener('click', () => {
      if (confirm('Reset all edits on this page? This cannot be undone.')) {
        localStorage.removeItem(STORAGE_KEY);
        location.reload();
      }
    });

    const addTrigger = dock.querySelector('.bn-ed-add-trigger');
    const addMenu   = dock.querySelector('.bn-ed-add-menu');
    addTrigger.addEventListener('click', (e) => {
      e.stopPropagation();
      addMenu.hidden = !addMenu.hidden;
    });
    addMenu.querySelectorAll('button[data-block]').forEach(btn => {
      btn.addEventListener('click', () => {
        addMenu.hidden = true;
        insertBlock(btn.dataset.block, null);
      });
    });
    document.addEventListener('click', (e) => {
      addMenu.hidden = true;
      /* Hide element toolbar if click was outside any editable element and toolbar itself */
      const onEditable = e.target.closest('[data-eid]');
      const onToolbar  = elToolbar && elToolbar.contains(e.target);
      const onDock     = e.target.closest('#bn-editor-dock');
      if (!onEditable && !onToolbar && !onDock) hideElToolbar();
    });
  }

  function flash(msg, color) {
    const f = document.createElement('div');
    f.className = 'bn-ed-flash';
    if (color) f.style.background = color;
    f.textContent = msg;
    document.body.appendChild(f);
    setTimeout(() => f.remove(), 2100);
  }

  /* ── Floating element toolbar (delete + change media) ── */
  let elToolbar    = null;
  let toolbarTarget = null;

  function buildElToolbar() {
    elToolbar = document.createElement('div');
    elToolbar.id = 'bn-el-toolbar';
    elToolbar.hidden = true;
    elToolbar.innerHTML = `
      <button class="bn-elt-btn bn-elt-media" title="Add or change media">↑ Media</button>
      <button class="bn-elt-btn bn-elt-delete" title="Delete this element">🗑 Delete</button>
    `;
    document.body.appendChild(elToolbar);

    elToolbar.querySelector('.bn-elt-media').addEventListener('click', (e) => {
      e.stopPropagation();
      if (toolbarTarget) openModal(toolbarTarget);
    });

    elToolbar.querySelector('.bn-elt-delete').addEventListener('click', (e) => {
      e.stopPropagation();
      if (!toolbarTarget) return;
      const label = toolbarTarget.textContent?.trim().slice(0, 40) || 'this element';
      if (confirm(`Delete "${label}"?`)) {
        toolbarTarget.remove();
        hideElToolbar();
      }
    });
  }

  function showElToolbar(target, isMedia) {
    if (!elToolbar) return;
    toolbarTarget = target;
    elToolbar.querySelector('.bn-elt-media').hidden = !isMedia;

    /* Position: fixed, above the top-right corner of the element */
    const rect = target.getBoundingClientRect();
    const top  = Math.max(8, rect.top - 44);
    const right = window.innerWidth - rect.right;
    elToolbar.style.top   = top + 'px';
    elToolbar.style.right = right + 'px';
    elToolbar.hidden = false;
  }

  function hideElToolbar() {
    if (elToolbar) elToolbar.hidden = true;
    toolbarTarget = null;
  }

  /* ── Text editing (contenteditable) ── */
  let activeEl = null;

  function setupTextEditing() {
    document.querySelectorAll(TEXT_SEL).forEach(wireText);
  }

  function wireText(el) {
    if (el.classList.contains('pz-ph')) return;
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      activate(el);
    });
  }

  function activate(el) {
    if (activeEl === el) return;
    if (activeEl) deactivate(activeEl);
    activeEl = el;
    el.contentEditable = 'true';
    el.classList.add('bn-ed-editing');
    el.focus();
    showElToolbar(el, false);
    const away = (e) => {
      const onToolbar   = elToolbar  && elToolbar.contains(e.target);
      const onFormatBar = formatBar  && formatBar.contains(e.target);
      const onDock      = e.target.closest('#bn-editor-dock');
      if (!el.contains(e.target) && !onToolbar && !onFormatBar && !onDock) {
        deactivate(el);
        document.removeEventListener('mousedown', away);
      }
    };
    setTimeout(() => document.addEventListener('mousedown', away), 0);
  }

  function deactivate(el) {
    el.contentEditable = 'false';
    el.classList.remove('bn-ed-editing');
    if (activeEl === el) { activeEl = null; hideElToolbar(); }
  }

  /* ── Placeholder / media ── */
  let modal    = null;
  let modalTarget = null;

  function setupPlaceholderClicks() {
    document.querySelectorAll('.pz-ph, img[data-eid]').forEach(wirePlaceholder);
  }

  function wirePlaceholder(el) {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      /* If this placeholder already has media, show toolbar (change/delete).
         If it's empty, open media modal directly — primary action is to fill it. */
      if (el.dataset.hasMedia || el.tagName === 'IMG') {
        showElToolbar(el, true);
      } else {
        showElToolbar(el, true);
        openModal(el);
      }
    });
  }

  function openModal(target) {
    modalTarget = target;
    if (!modal) buildModal();
    modal.classList.add('open');
    modal.querySelector('.bn-modal-url').focus();
  }

  function buildModal() {
    modal = document.createElement('div');
    modal.id = 'bn-media-modal';
    modal.innerHTML = `
      <div class="bn-modal-box">
        <h3>Add Media</h3>
        <div class="bn-modal-tabs">
          <label><input type="radio" name="bn-mtype" value="image" checked> Image / GIF</label>
          <label><input type="radio" name="bn-mtype" value="video"> Video</label>
        </div>
        <div class="bn-modal-url-row">
          <input class="bn-modal-url" type="url" placeholder="Paste URL…" />
          <span class="bn-modal-or">or</span>
          <label class="bn-modal-upload-btn">
            Upload file
            <input class="bn-modal-file" type="file" accept="image/*,video/*" hidden />
          </label>
        </div>
        <div class="bn-modal-preview"></div>
        <div class="bn-modal-caption-row">
          <input class="bn-modal-caption" type="text" placeholder="Caption (optional)" />
        </div>
        <div class="bn-modal-actions">
          <button class="bn-ed-btn bn-modal-cancel">Cancel</button>
          <button class="bn-ed-btn bn-modal-insert">Insert</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    const urlInput  = modal.querySelector('.bn-modal-url');
    const fileInput = modal.querySelector('.bn-modal-file');
    const preview   = modal.querySelector('.bn-modal-preview');

    urlInput.addEventListener('input', () => renderPreview(urlInput.value));

    fileInput.addEventListener('change', () => {
      const file = fileInput.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        urlInput.value = e.target.result;
        renderPreview(e.target.result);
      };
      reader.readAsDataURL(file);
    });

    function renderPreview(src) {
      if (!src) { preview.innerHTML = ''; return; }
      const type = modal.querySelector('input[name="bn-mtype"]:checked').value;
      preview.innerHTML = type === 'image'
        ? `<img src="${src}" style="max-width:100%;max-height:180px;object-fit:contain;border-radius:8px;" />`
        : `<video src="${src}" style="max-width:100%;max-height:180px;border-radius:8px;" controls></video>`;
    }

    modal.querySelector('.bn-modal-cancel').addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

    modal.querySelector('.bn-modal-insert').addEventListener('click', () => {
      const src     = urlInput.value.trim();
      const caption = modal.querySelector('.bn-modal-caption').value.trim();
      const type    = modal.querySelector('input[name="bn-mtype"]:checked').value;
      if (!src) { flash('Add a URL or upload a file first.', '#f87171'); return; }
      applyMedia(modalTarget, src, type, caption);
      closeModal();
      urlInput.value = '';
      preview.innerHTML = '';
      modal.querySelector('.bn-modal-caption').value = '';
    });
  }

  function closeModal() {
    if (modal) modal.classList.remove('open');
  }

  function applyMedia(target, src, type, caption) {
    if (target.tagName === 'IMG') {
      target.src = src;
      if (caption) target.alt = caption;
    } else {
      target.dataset.hasMedia = type;
      if (type === 'image') {
        target.innerHTML = `<img src="${src}" alt="${caption || ''}" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;display:block;" />`;
      } else {
        target.innerHTML = `<video src="${src}" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;display:block;" autoplay muted loop playsinline></video>`;
      }
      if (caption) {
        const exists = target.nextElementSibling?.classList.contains('case-image__caption');
        if (!exists) {
          const cap = document.createElement('p');
          cap.className = 'case-image__caption';
          cap.dataset.eid = 'cap_' + target.dataset.eid;
          cap.textContent = caption;
          cap.addEventListener('click', (e) => { e.stopPropagation(); activate(cap); });
          target.insertAdjacentElement('afterend', cap);
        }
      }
    }
  }

  /* ── Insert block buttons (appear between sections) ── */
  let insertMenu = null;
  let insertAnchor = null;

  function setupInsertButtons() {
    const containers = [
      '.pz-panel > .pz-wrap',
      '.pz-panel > section',
      '.case-body > .case-section',
      '.case-body > .case-image',
    ].join(',');

    document.querySelectorAll(containers).forEach(section => {
      const btn = document.createElement('button');
      btn.className = 'bn-ed-insert-btn';
      btn.textContent = '＋';
      btn.title = 'Insert block after this section';
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        showInsertMenu(e, section);
      });
      section.insertAdjacentElement('afterend', btn);
    });
  }

  function showInsertMenu(e, anchor) {
    insertAnchor = anchor;
    if (!insertMenu) {
      insertMenu = document.createElement('div');
      insertMenu.className = 'bn-ed-insert-menu';
      insertMenu.hidden = true;
      insertMenu.innerHTML = `
        <button data-block="text">Paragraph</button>
        <button data-block="heading">Heading</button>
        <button data-block="image">Image / GIF</button>
        <button data-block="image-full">Full-width Image</button>
        <button data-block="video">Video</button>
        <button data-block="two-col">Two-column</button>
      `;
      document.body.appendChild(insertMenu);
      insertMenu.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', () => {
          insertMenu.hidden = true;
          insertBlock(btn.dataset.block, insertAnchor);
        });
      });
    }

    const rect = e.target.getBoundingClientRect();
    insertMenu.style.top  = (rect.bottom + window.scrollY + 6) + 'px';
    insertMenu.style.left = (rect.left + window.scrollX) + 'px';
    insertMenu.hidden = false;

    const close = () => { insertMenu.hidden = true; };
    setTimeout(() => document.addEventListener('click', close, { once: true }), 0);
  }

  function insertBlock(type, anchor) {
    const panel = document.querySelector('.pz-panel') || document.querySelector('.case-body') || document.querySelector('main');

    const wrapper = document.createElement('div');
    wrapper.className = 'pz-wrap pz-section bn-ed-new-block';

    let innerMarkup = '';
    switch (type) {
      case 'text':
        innerMarkup = `<div class="pz-body"><p>Click to edit this text block.</p></div>`;
        break;
      case 'heading':
        innerMarkup = `
          <p class="pz-eyebrow">Eyebrow label</p>
          <h2 class="pz-h2" style="margin-bottom:20px;">Section heading</h2>
          <div class="pz-body"><p>Supporting text goes here.</p></div>`;
        break;
      case 'image':
        innerMarkup = `
          <div class="pz-ph" style="aspect-ratio:16/9;border-radius:20px;"></div>
          <p class="case-image__caption" style="margin-top:12px;padding:0">Caption</p>`;
        break;
      case 'image-full':
        wrapper.className = 'pz-wrap bn-ed-new-block';
        innerMarkup = `<div class="pz-ph" style="aspect-ratio:21/9;border-radius:24px;"></div>`;
        break;
      case 'video':
        innerMarkup = `<div class="pz-ph" style="aspect-ratio:16/9;border-radius:20px;"></div>`;
        break;
      case 'two-col':
        innerMarkup = `
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:clamp(32px,5vw,72px);align-items:start;">
            <div class="pz-ph" style="aspect-ratio:4/3;border-radius:16px;"></div>
            <div class="pz-body"><p>Click to edit this text block.</p></div>
          </div>`;
        break;
    }
    wrapper.innerHTML = innerMarkup;

    /* Delete button */
    const delBtn = document.createElement('button');
    delBtn.className = 'bn-ed-delete';
    delBtn.innerHTML = '✕';
    delBtn.title = 'Remove this block';
    delBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (confirm('Remove this block?')) wrapper.remove();
    });
    wrapper.insertBefore(delBtn, wrapper.firstChild);

    if (anchor) {
      anchor.insertAdjacentElement('afterend', wrapper);
    } else if (panel) {
      panel.appendChild(wrapper);
    }

    /* Wire new elements */
    assignEids();
    wrapper.querySelectorAll('.pz-ph').forEach(wirePlaceholder);
    wrapper.querySelectorAll(TEXT_SEL).forEach(wireText);
  }

  /* ── Section grouping ──────────────────────────────────────────────────
     Lets users select multiple blocks and group them into a named section.
     Sub-blocks inside a group get tight spacing; the group is the drag unit.
  ─────────────────────────────────────────────────────────────────────── */

  let selectMode = false;
  const selected = new Set();
  let groupFloating = null;

  function setupGrouping() {
    const selectBtn = document.querySelector('.bn-ed-select');
    selectBtn.addEventListener('click', () => {
      selectMode = !selectMode;
      selectBtn.classList.toggle('bn-ed-select--on', selectMode);
      selectBtn.textContent = selectMode ? '✕ Cancel' : '◻ Select';
      document.body.classList.toggle('editor-select-mode', selectMode);
      if (!selectMode) clearSelection();
    });

    buildGroupFloating();
    wireSelectableBlocks();
  }

  function wireSelectableBlocks() {
    document.querySelectorAll(DRAG_SEL).forEach(el => {
      if (el.dataset.selectWired) return;
      el.dataset.selectWired = '1';
      el.addEventListener('click', (e) => {
        if (!selectMode) return;
        e.stopPropagation();
        toggleSelect(el);
      });
    });
  }

  function toggleSelect(el) {
    if (selected.has(el)) {
      selected.delete(el);
      el.classList.remove('bn-selected');
    } else {
      selected.add(el);
      el.classList.add('bn-selected');
    }
    updateGroupFloating();
  }

  function clearSelection() {
    selected.forEach(el => el.classList.remove('bn-selected'));
    selected.clear();
    updateGroupFloating();
  }

  function buildGroupFloating() {
    groupFloating = document.createElement('div');
    groupFloating.id = 'bn-group-floating';
    groupFloating.hidden = true;
    groupFloating.innerHTML = `
      <span class="bn-gf-count"></span>
      <button class="bn-gf-btn bn-gf-group">⊞ Group into section</button>
      <button class="bn-gf-btn bn-gf-cancel">Cancel</button>
    `;
    document.body.appendChild(groupFloating);

    groupFloating.querySelector('.bn-gf-group').addEventListener('click', () => {
      groupSelected();
    });
    groupFloating.querySelector('.bn-gf-cancel').addEventListener('click', () => {
      clearSelection();
    });
  }

  function updateGroupFloating() {
    if (!groupFloating) return;
    groupFloating.hidden = selected.size < 2;
    if (!groupFloating.hidden) {
      groupFloating.querySelector('.bn-gf-count').textContent = `${selected.size} blocks selected`;
    }
  }

  function groupSelected() {
    /* Sort selected blocks in DOM order */
    const allBlocks = [...document.querySelectorAll(DRAG_SEL)];
    const sorted = allBlocks.filter(b => selected.has(b));
    if (sorted.length < 2) return;

    /* Build the group wrapper */
    const group = document.createElement('div');
    group.className = 'pz-group';

    group.innerHTML = `
      <div class="pz-group__bar">
        <div class="pz-group__dot"></div>
        <span class="pz-group__label" contenteditable="true" spellcheck="false">Section name</span>
        <button class="pz-group__ungroup" title="Ungroup">Ungroup</button>
      </div>
      <div class="pz-group__body"></div>
    `;

    const body = group.querySelector('.pz-group__body');

    /* Insert group before the first selected block */
    sorted[0].before(group);

    /* Move blocks in and apply tight default spacing */
    sorted.forEach(s => {
      /* Remove orphaned spacing / insert controls that sat after the block */
      const n = s.nextElementSibling;
      if (n?.classList.contains('bn-spacing-ctrl') || n?.classList.contains('bn-ed-insert-btn')) n.remove();
      const tgt = spacingTarget(s);
      tgt.style.paddingBottom = '16px';
      tgt.style.paddingTop    = '16px';
      body.appendChild(s);
    });

    /* Ungroup handler */
    group.querySelector('.pz-group__ungroup').addEventListener('click', () => ungroup(group));

    /* Wire spacing controls inside group */
    rebuildGroupSpacing(group);

    /* Exit select mode and clean up */
    clearSelection();
    document.querySelector('.bn-ed-select').click();

    /* Rebuild outer spacing so the group is included */
    rebuildSpacingControls();
    wireSelectableBlocks();
  }

  function rebuildGroupSpacing(group) {
    group.querySelectorAll('.bn-spacing-ctrl').forEach(n => n.remove());
    const blocks = [...group.querySelector('.pz-group__body').children].filter(c => c.matches && c.matches(DRAG_SEL));
    blocks.forEach((b, i) => {
      const next = blocks[i + 1];
      if (next) injectSpacingCtrl(b, next, true); /* tight = true */
    });
  }

  function ungroup(group) {
    const body = group.querySelector('.pz-group__body');
    const blocks = [...body.children];
    /* Restore default padding on sub-sections */
    blocks.forEach(b => {
      const tgt = spacingTarget(b);
      tgt.style.removeProperty('padding-bottom');
      tgt.style.removeProperty('padding-top');
      group.before(b);
    });
    group.remove();
    rebuildSpacingControls();
  }

  /* ── File sync (File System Access API → writes changes to disk) ── */

  async function syncToFile() {
    const saveBtn = document.querySelector('.bn-ed-save');

    /* Fallback: download the file if the API isn't available (Firefox) */
    if (!('showOpenFilePicker' in window)) {
      downloadHtml(serializeHtml());
      return;
    }

    try {
      /* First save: let the user pick which HTML file to write to */
      if (!fileHandle) {
        [fileHandle] = await window.showOpenFilePicker({
          types: [{ description: 'HTML file', accept: { 'text/html': ['.html'] } }],
          multiple: false,
        });
      }

      /* Re-request write permission (required after every page reload) */
      const perm = await fileHandle.requestPermission({ mode: 'readwrite' });
      if (perm !== 'granted') {
        flash('File permission denied — try again', '#f87171');
        fileHandle = null;
        return;
      }

      const writable = await fileHandle.createWritable();
      await writable.write(serializeHtml());
      await writable.close();

      flash('Saved to file ✓');
      if (saveBtn) saveBtn.dataset.linked = 'true';
      updateSaveLabel();

    } catch (e) {
      /* User cancelled the file picker — silent fail (localStorage already saved) */
      if (e.name === 'AbortError') {
        flash('Saved to localStorage only', '#888');
        return;
      }
      flash('Could not write file — check console', '#f87171');
      console.error('[editor] file sync error:', e);
    }
  }

  function updateSaveLabel() {
    const btn = document.querySelector('.bn-ed-save');
    if (!btn) return;
    btn.textContent = fileHandle ? 'Save  ✓ linked' : 'Save';
  }

  /* Builds a clean copy of the current DOM, strips all editor artefacts */
  function serializeHtml() {
    /* Deactivate any open text editor so the browser doesn't bake
       contenteditable artefacts (stray <br>, <div>) into the output */
    if (activeEl) deactivate(activeEl);

    const clone = document.documentElement.cloneNode(true);

    /* ── Remove editor UI nodes ── */
    [
      '#bn-editor-dock', '#bn-el-toolbar', '#bn-format-bar',
      '#bn-media-modal', '#bn-group-floating', '.bn-ed-insert-btn', '.bn-ed-insert-menu',
      '.bn-ed-delete', '.bn-ed-flash', '.bn-drag-handle', '#bn-drop-indicator',
      '.bn-spacing-ctrl', '.pz-group__bar',
    ].forEach(sel => clone.querySelectorAll(sel).forEach(n => n.remove()));

    /* ── Strip editor-only attributes and classes ── */
    clone.querySelectorAll('[data-eid],[contenteditable],[data-select-wired],[data-drag-wired],.bn-ed-editing,.bn-ed-new-block,.bn-dragging,.bn-selected').forEach(el => {
      el.removeAttribute('data-eid');
      el.removeAttribute('contenteditable');
      el.removeAttribute('data-has-media');
      el.removeAttribute('data-flip');
      el.removeAttribute('draggable');
      el.removeAttribute('data-select-wired');
      el.removeAttribute('data-drag-wired');
      el.classList.remove('bn-ed-editing', 'bn-ed-new-block', 'bn-dragging', 'bn-selected');
      if (el.getAttribute('class') === '') el.removeAttribute('class');
    });

    clone.querySelector('body')?.classList.remove('editor-mode', 'editor-select-mode');

    /* Flatten groups: unwrap .pz-group → keep blocks, discard container */
    clone.querySelectorAll('.pz-group').forEach(group => {
      const body = group.querySelector('.pz-group__body');
      if (body) [...body.children].forEach(child => group.before(child));
      group.remove();
    });

    /* ── Strip GSAP runtime inline styles ──────────────────────────────
       GSAP sets opacity/transform/will-change as inline styles during
       animations. Baking those into the HTML causes visual jumps and
       broken starting states on reload. Only remove these specific
       properties — preserve user-set styles (font-size, aspect-ratio…). */
    clone.querySelectorAll('[style]').forEach(el => {
      el.style.removeProperty('opacity');
      el.style.removeProperty('transform');
      el.style.removeProperty('-webkit-transform');
      el.style.removeProperty('will-change');
      el.style.removeProperty('transform-origin');
      el.style.removeProperty('perspective');
      if (!el.getAttribute('style').trim()) el.removeAttribute('style');
    });

    /* ── Undo splitIntoLines ────────────────────────────────────────────
       The inline GSAP script wraps every text line in
       <span style="display:block">. Serialising after this runs nests
       those spans deeper on every save/reload cycle. Unwrap them back
       to plain innerHTML so the script can re-run cleanly. */
    clone.querySelectorAll('h1,h2,h3,h4,p,li').forEach(el => {
      const kids = [...el.children];
      const allLineSpans = kids.length > 0 && kids.every(
        k => k.tagName === 'SPAN' && k.style.display === 'block'
      );
      if (allLineSpans) {
        /* Re-join inner HTML of each span — preserves any bold/italic
           the user applied inside the line */
        el.innerHTML = kids.map(k => k.innerHTML.trim()).join(' ');
      }
    });

    return '<!DOCTYPE html>\n' + clone.outerHTML;
  }

  /* Fallback: trigger a browser download of the serialized HTML */
  function downloadHtml(html) {
    const name = location.pathname.split('/').pop() || 'case-study.html';
    const url  = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
    Object.assign(document.createElement('a'), { href: url, download: name }).click();
    URL.revokeObjectURL(url);
    flash('Downloaded as ' + name);
  }

  /* ── Drag to reorder sections ── */
  const DRAG_SEL = '.pz-panel > .pz-wrap, .pz-panel > section, .case-body > .case-section, .case-body > .case-image';

  let dragEl       = null;
  let fromHandle   = false;
  let dropTarget   = null;
  let dropPos      = null; /* 'before' | 'after' */
  let dropIndicator = null;

  function getDropIndicator() {
    if (!dropIndicator) {
      dropIndicator = document.createElement('div');
      dropIndicator.id = 'bn-drop-indicator';
      dropIndicator.hidden = true;
      document.body.appendChild(dropIndicator);
    }
    return dropIndicator;
  }

  function setupDragging() {
    wireDraggableSections();

    /* Re-run whenever the user inserts a new block */
    const panel = document.querySelector('.pz-panel') || document.querySelector('.case-body');
    if (!panel) return;

    panel.addEventListener('dragover', onDragOver);
    panel.addEventListener('dragleave', (e) => {
      if (!panel.contains(e.relatedTarget)) getDropIndicator().hidden = true;
    });
    panel.addEventListener('drop', onDrop);
  }

  function wireDraggableSections() {
    document.querySelectorAll(DRAG_SEL).forEach(section => {
      if (section.dataset.dragWired) return;
      section.dataset.dragWired = '1';

      /* Drag handle */
      const handle = document.createElement('div');
      handle.className = 'bn-drag-handle';
      handle.title = 'Drag to reorder';
      handle.innerHTML = `<svg width="10" height="16" viewBox="0 0 10 16" fill="none">
        <circle cx="2" cy="2"  r="1.5" fill="currentColor"/>
        <circle cx="8" cy="2"  r="1.5" fill="currentColor"/>
        <circle cx="2" cy="8"  r="1.5" fill="currentColor"/>
        <circle cx="8" cy="8"  r="1.5" fill="currentColor"/>
        <circle cx="2" cy="14" r="1.5" fill="currentColor"/>
        <circle cx="8" cy="14" r="1.5" fill="currentColor"/>
      </svg>`;
      section.appendChild(handle);

      /* Only allow drag when pointer went down on the handle */
      handle.addEventListener('mousedown', () => { fromHandle = true; });
      document.addEventListener('mouseup', () => { fromHandle = false; }, { capture: true });

      section.setAttribute('draggable', 'false');

      handle.addEventListener('mousedown', () => {
        section.setAttribute('draggable', 'true');
      });

      section.addEventListener('dragstart', (e) => {
        if (!fromHandle) { e.preventDefault(); section.draggable = false; return; }
        dragEl = section;

        /* Minimal drag ghost instead of a full DOM screenshot */
        const ghost = document.createElement('div');
        ghost.className = 'bn-drag-ghost';
        ghost.textContent = 'Moving section';
        document.body.appendChild(ghost);
        e.dataTransfer.setDragImage(ghost, 0, -8);
        e.dataTransfer.effectAllowed = 'move';
        setTimeout(() => {
          ghost.remove();
          section.classList.add('bn-dragging');
        }, 0);
      });

      section.addEventListener('dragend', () => {
        section.setAttribute('draggable', 'false');
        section.classList.remove('bn-dragging');
        getDropIndicator().hidden = true;
        dragEl = null; dropTarget = null; dropPos = null;
      });
    });
  }

  function onDragOver(e) {
    if (!dragEl) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    const sections = [...document.querySelectorAll(DRAG_SEL)].filter(s => s !== dragEl);
    let nearest = null, nearestPos = null;

    for (const s of sections) {
      const r = s.getBoundingClientRect();
      if (e.clientY >= r.top && e.clientY <= r.bottom) {
        nearest   = s;
        nearestPos = e.clientY < r.top + r.height / 2 ? 'before' : 'after';
        break;
      }
    }

    if (!nearest) return;
    dropTarget = nearest; dropPos = nearestPos;

    const r  = nearest.getBoundingClientRect();
    const di = getDropIndicator();
    di.hidden = false;
    di.style.top   = ((nearestPos === 'before' ? r.top : r.bottom) + window.scrollY - 2) + 'px';
    di.style.left  = r.left + 'px';
    di.style.width = r.width + 'px';
  }

  function onDrop(e) {
    e.preventDefault();
    if (!dragEl || !dropTarget) return;
    if (dropPos === 'before') dropTarget.before(dragEl);
    else                      dropTarget.after(dragEl);
    getDropIndicator().hidden = true;
    dragEl.classList.remove('bn-dragging');
    dragEl = null; dropTarget = null; dropPos = null;
    /* Rebuild spacing controls so pairs are correct after reorder */
    rebuildSpacingControls();
  }

  /* ── Section spacing controls ──────────────────────────────────────────
     Injected between each pair of sections. Controls padding-bottom of
     the upper section + padding-top of the lower section so the user
     gets a single "gap" value to adjust.
  ─────────────────────────────────────────────────────────────────────── */

  const SPACING_PRESETS = [
    { label: 'None',    px: 0   },
    { label: 'XS',      px: 16  },
    { label: 'S',       px: 32  },
    { label: 'M',       px: 64  },
    { label: 'L',       px: 88  },
    { label: 'XL',      px: 120 },
  ];

  function setupSpacingControls() {
    const sections = [...document.querySelectorAll(DRAG_SEL)];
    sections.forEach((section, i) => {
      const next = sections[i + 1];
      if (!next) return;
      injectSpacingCtrl(section, next);
    });
  }

  function rebuildSpacingControls() {
    document.querySelectorAll('.bn-spacing-ctrl').forEach(n => n.remove());
    setupSpacingControls();
  }

  /* .pz-wrap has no vertical padding — the 88px lives on the inner
     .pz-section child. Walk down to find the real spacing element. */
  function spacingTarget(section) {
    const inner = section.querySelector(':scope > .pz-section, :scope > .pz-section--sm');
    return inner || section;
  }

  const SPACING_PRESETS_TIGHT = [
    { label: 'None', px: 0  },
    { label: 'XS',   px: 8  },
    { label: 'S',    px: 16 },
    { label: 'M',    px: 24 },
    { label: 'L',    px: 32 },
    { label: 'XL',   px: 48 },
  ];

  function injectSpacingCtrl(above, below, tight = false) {
    const aboveEl  = spacingTarget(above);
    const belowEl  = spacingTarget(below);
    const above_pb = parseFloat(getComputedStyle(aboveEl).paddingBottom);
    const below_pt = parseFloat(getComputedStyle(belowEl).paddingTop);
    const total    = Math.round(above_pb + below_pt);

    const ctrl = document.createElement('div');
    ctrl.className = 'bn-spacing-ctrl';

    const presets = tight ? SPACING_PRESETS_TIGHT : SPACING_PRESETS;
    const presetBtns = presets.map(p =>
      `<button class="bn-sp-preset${Math.round(p.px * 2) === total ? ' active' : ''}" data-px="${p.px}">${p.label}<span>${p.px * 2}px</span></button>`
    ).join('');

    ctrl.innerHTML = `
      <button class="bn-sp-trigger">↕ ${total}px</button>
      <div class="bn-sp-menu" hidden>${presetBtns}</div>
    `;

    const trigger = ctrl.querySelector('.bn-sp-trigger');
    const menu    = ctrl.querySelector('.bn-sp-menu');

    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      /* Reposition menu above trigger if close to viewport bottom */
      const r = trigger.getBoundingClientRect();
      menu.style.bottom = window.innerHeight - r.top < 160 ? (trigger.offsetHeight + 6) + 'px' : 'auto';
      menu.style.top    = window.innerHeight - r.top < 160 ? 'auto' : (trigger.offsetHeight + 6) + 'px';
      menu.hidden = !menu.hidden;
    });

    menu.querySelectorAll('.bn-sp-preset').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const half = parseInt(btn.dataset.px);
        aboveEl.style.paddingBottom = half + 'px';
        belowEl.style.paddingTop    = half + 'px';
        trigger.textContent = `↕ ${half * 2}px`;
        menu.querySelectorAll('.bn-sp-preset').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        menu.hidden = true;
      });
    });

    document.addEventListener('click', () => { menu.hidden = true; });

    /* Insert right after the upper section (before any insert-btn that follows it) */
    above.insertAdjacentElement('afterend', ctrl);
  }

  /* ── Format bar (floating, appears on text selection) ── */
  let formatBar = null;

  function buildFormatBar() {
    formatBar = document.createElement('div');
    formatBar.id = 'bn-format-bar';
    formatBar.hidden = true;
    formatBar.innerHTML = `
      <button class="bn-fmt-btn" data-cmd="bold"          title="Bold (Ctrl+B)"><b>B</b></button>
      <button class="bn-fmt-btn" data-cmd="italic"        title="Italic (Ctrl+I)"><i>I</i></button>
      <button class="bn-fmt-btn" data-cmd="underline"     title="Underline (Ctrl+U)"><u>U</u></button>
      <button class="bn-fmt-btn" data-cmd="strikeThrough" title="Strikethrough"><s>S</s></button>
      <div class="bn-fmt-sep"></div>
      <button class="bn-fmt-btn bn-fmt-sz-dec" title="Decrease font size">A−</button>
      <input  class="bn-fmt-sz" type="number" min="8" max="120" value="16" title="Font size (px)" />
      <span   class="bn-fmt-sz-label">px</span>
      <button class="bn-fmt-btn bn-fmt-sz-inc" title="Increase font size">A+</button>
      <div class="bn-fmt-sep"></div>
      <button class="bn-fmt-btn bn-fmt-clear" data-cmd="removeFormat" title="Clear all formatting">✕ Clear</button>
    `;
    document.body.appendChild(formatBar);

    /* Prevent mousedown from stealing selection */
    formatBar.addEventListener('mousedown', (e) => e.preventDefault());

    /* execCommand buttons */
    formatBar.querySelectorAll('[data-cmd]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.execCommand(btn.dataset.cmd);
        syncFormatState();
      });
    });

    /* Font size controls */
    const szInput = formatBar.querySelector('.bn-fmt-sz');

    formatBar.querySelector('.bn-fmt-sz-dec').addEventListener('click', () => {
      const v = Math.max(8, (parseInt(szInput.value) || 16) - 2);
      szInput.value = v;
      applyFontSize(v);
    });

    formatBar.querySelector('.bn-fmt-sz-inc').addEventListener('click', () => {
      const v = Math.min(120, (parseInt(szInput.value) || 16) + 2);
      szInput.value = v;
      applyFontSize(v);
    });

    szInput.addEventListener('mousedown', (e) => e.stopPropagation());
    szInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); applyFontSize(parseInt(szInput.value)); }
    });
    szInput.addEventListener('change', () => applyFontSize(parseInt(szInput.value)));
  }

  function positionFormatBar(sel) {
    const range = sel.getRangeAt(0);
    const rect  = range.getBoundingClientRect();
    if (!rect.width && !rect.height) return;

    formatBar.hidden = false;

    requestAnimationFrame(() => {
      const bw = formatBar.offsetWidth;
      const bh = formatBar.offsetHeight;

      let left = rect.left + rect.width / 2 - bw / 2;
      left = Math.max(8, Math.min(left, window.innerWidth - bw - 8));

      let top = rect.top - bh - 10;
      /* Flip below selection if not enough room above */
      formatBar.dataset.flip = top < 8 ? 'below' : 'above';
      if (top < 8) top = rect.bottom + 10;

      formatBar.style.left = left + 'px';
      formatBar.style.top  = top  + 'px';
    });

    /* Sync font size input to the anchor element's computed size */
    const anchor = sel.anchorNode;
    const el = anchor?.nodeType === Node.TEXT_NODE ? anchor.parentElement : anchor;
    if (el) {
      const sz = parseFloat(getComputedStyle(el).fontSize);
      if (sz) formatBar.querySelector('.bn-fmt-sz').value = Math.round(sz);
    }

    syncFormatState();
  }

  function hideFormatBar() {
    if (formatBar) formatBar.hidden = true;
  }

  function syncFormatState() {
    if (!formatBar) return;
    formatBar.querySelectorAll('[data-cmd]').forEach(btn => {
      if (btn.dataset.cmd === 'removeFormat') return;
      try { btn.classList.toggle('bn-fmt-active', document.queryCommandState(btn.dataset.cmd)); }
      catch (_) {}
    });
  }

  function applyFontSize(px) {
    if (!px || isNaN(px)) return;
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount || sel.isCollapsed) return;
    const range = sel.getRangeAt(0);
    const span  = document.createElement('span');
    span.style.fontSize = px + 'px';
    try {
      range.surroundContents(span);
    } catch (_) {
      /* Selection spans multiple elements — extract and re-wrap */
      span.appendChild(range.extractContents());
      range.insertNode(span);
    }
    /* Restore selection to the new span */
    sel.removeAllRanges();
    const r = document.createRange();
    r.selectNodeContents(span);
    sel.addRange(r);
  }

  function listenForSelection() {
    document.addEventListener('selectionchange', () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.toString().trim()) {
        hideFormatBar();
        return;
      }
      /* Only show when inside an active contenteditable */
      let node = sel.anchorNode;
      let el   = node?.nodeType === Node.TEXT_NODE ? node.parentElement : node;
      while (el && el !== document.body) {
        if (el.contentEditable === 'true') { positionFormatBar(sel); return; }
        el = el.parentElement;
      }
      hideFormatBar();
    });
  }

  /* ─── Boot ─── */
  /* The page injects this script only when ?edit is present, and a dynamically
     inserted script can land after DOMContentLoaded has already fired — in which
     case the listener would never run. Check readyState and boot either way. */
  function boot() {
    assignEids();
    restoreContent();
    if (EDITOR_ACTIVE) initEditor();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

}());
