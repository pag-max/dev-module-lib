// RecordBook · 渲染进程逻辑（schema 驱动，复用 ui-kit 交互约定）
// 手势铁律：双击=编辑、拖动=排序、右键=菜单、点击链接=打开。AI 不得改。

const STORE_KEY = 'rb-records-v1';
const STATUS_BADGE = { '进行中': 'badge-accent', '待办': 'badge-warning', '已完成': 'badge-success' };

let records = [];
let filter = 'all';
let search = '';
let editingId = null;        // null = 新增
let pendingLinks = [];       // 编辑弹窗里的链接草稿

// ---------- 持久化（Electron 优先，否则 localStorage 降级） ----------
function persist() {
  if (window.rb && window.rb.save) {
    window.rb.save(records).catch(e => console.warn('save failed', e));
  } else {
    localStorage.setItem(STORE_KEY, JSON.stringify(records));
  }
}
async function loadData() {
  if (window.rb && window.rb.load) {
    const d = await window.rb.load();
    if (d) return d;
  }
  const s = localStorage.getItem(STORE_KEY);
  return s ? JSON.parse(s) : seed();
}
function seed() {
  return [
    { id: id(), name: '高等数学 复习', cat: '备考', status: '进行中', note: '第3章 定积分', date: today(),
      links: [{ label: '网盘资料', url: 'https://example.com/gaoshu' }] },
    { id: id(), name: '日语 N2', cat: '学习', status: '已完成', note: '词汇表完成', date: today(),
      links: [{ label: '本地笔记', url: 'D:\\Documents\\日语笔记' }] },
    { id: id(), name: '健身计划', cat: '生活', status: '待办', note: '每周三练', date: today(), links: [] }
  ];
}
const id = () => 'r' + Math.random().toString(36).slice(2, 9);
const today = () => new Date().toISOString().slice(0, 10);

// ---------- 渲染 ----------
const listEl = document.getElementById('recList');
function visible() {
  return records.filter(r => {
    if (filter !== 'all' && r.status !== filter) return false;
    if (search && !(r.name + r.note + r.cat).toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });
}
function render() {
  const rows = visible();
  listEl.innerHTML = '';
  if (!rows.length) {
    listEl.innerHTML = '<div class="empty">📭 没有匹配的记录。<br>点「＋ 新增」开始，或从侧栏导入 JSON。</div>';
  }
  rows.forEach(r => listEl.appendChild(card(r)));
  bindDnd();
  const sel = records.filter(r => r._sel).length;
  document.getElementById('bulkBar').style.display = sel ? 'flex' : 'none';
  document.getElementById('bulkCount').textContent = '已选 ' + sel + ' 项';
  document.getElementById('countTip').textContent = `共 ${records.length} 条，显示 ${rows.length} 条`;
}
function card(r) {
  const el = document.createElement('div');
  el.className = 'rec-card';
  el.dataset.id = r.id;
  el.setAttribute('draggable', 'true');
  const linksHtml = (r.links || []).map((l, i) =>
    `<span class="link-chip ${/^https?:\/\//i.test(l.url) ? 'url' : 'local'}" data-link="${i}">${l.label || l.url} <span class="x" data-x="${i}">✕</span></span>`
  ).join('');
  el.innerHTML = `
    <input type="checkbox" class="ck-box" ${r._sel ? 'checked' : ''} data-sel>
    <div class="drag" title="拖动排序">⋮⋮</div>
    <div class="body">
      <div class="row1">
        <span class="name">${esc(r.name)}</span>
        <span class="badge ${STATUS_BADGE[r.status] || ''}">${r.status}</span>
        <span class="muted small">${esc(r.cat)}</span>
        <span class="muted small">· ${r.date}</span>
      </div>
      ${r.note ? `<div class="muted small" style="margin-top:3px">${esc(r.note)}</div>` : ''}
      ${linksHtml ? `<div class="links">${linksHtml}</div>` : ''}
    </div>
    <div class="ops"><button class="btn btn-sm" data-edit>编辑</button></div>`;
  return el;
}
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));

// ---------- 拖拽排序（拖动 = 拖动） ----------
function bindDnd() {
  let dragEl = null;
  listEl.querySelectorAll('.rec-card').forEach(c => {
    c.ondragstart = () => { dragEl = c; c.classList.add('dragging'); };
    c.ondragend = () => { c.classList.remove('dragging'); dragEl = null; commitOrder(); };
    c.ondragover = e => {
      e.preventDefault();
      if (dragEl && dragEl !== c) {
        const rect = c.getBoundingClientRect();
        const after = (e.clientY - rect.top) > rect.height / 2;
        listEl.insertBefore(dragEl, after ? c.nextSibling : c);
      }
    };
  });
}
function commitOrder() {
  // 仅在「全部 + 无搜索」时重排，避免过滤态下打乱隐藏项顺序
  if (filter !== 'all' || search) { render(); return; }
  const order = [...listEl.querySelectorAll('.rec-card')].map(c => c.dataset.id);
  records.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
  persist();
}

// ---------- 链接：点击打开 / 删除 ----------
listEl.addEventListener('click', e => {
  const chip = e.target.closest('.link-chip');
  if (chip && !e.target.classList.contains('x')) {
    const r = records.find(x => x.id === chip.closest('.rec-card').dataset.id);
    const l = r.links[+chip.dataset.link];
    openLink(l.url);
    return;
  }
  const x = e.target.closest('.x');
  if (x) {
    const r = records.find(y => y.id === x.closest('.rec-card').dataset.id);
    r.links.splice(+x.dataset.x, 1); persist(); render(); return;
  }
  const ed = e.target.closest('[data-edit]');
  if (ed) { openEdit(ed.closest('.rec-card').dataset.id); return; }
  const sel = e.target.closest('[data-sel]');
  if (sel) {
    const r = records.find(y => y.id === sel.closest('.rec-card').dataset.id);
    r._sel = sel.checked; render();
  }
});
function openLink(url) {
  if (window.rb && window.rb.openLink) {
    window.rb.openLink(url).then(res => { if (res && res.error) toast('打开失败：' + res.error, 'danger'); });
  } else {
    if (/^https?:\/\//i.test(url)) window.open(url, '_blank');
    else toast('将用系统打开：' + url, 'success'); // 浏览器环境无法直开本地路径
  }
}

// ---------- 编辑弹窗（schema 驱动） ----------
const dlg = document.getElementById('editDialog');
function openEdit(rid) {
  editingId = rid || null;
  const r = rid ? records.find(x => x.id === rid) : null;
  document.getElementById('dlgTitle').textContent = rid ? '编辑记录' : '新增记录';
  document.getElementById('f-name').value = r?.name || '';
  document.getElementById('f-cat').value = r?.cat || '';
  document.getElementById('f-status').value = r?.status || '进行中';
  document.getElementById('f-note').value = r?.note || '';
  pendingLinks = r ? (r.links || []).map(l => ({ ...l })) : [];
  renderLinkEdits();
  dlg.classList.add('show');
}
function renderLinkEdits() {
  const box = document.getElementById('linkList');
  box.innerHTML = pendingLinks.map((l, i) =>
    `<div style="display:flex;gap:6px;align-items:center">
       <span class="link-chip ${/^https?:\/\//i.test(l.url) ? 'url' : 'local'}">${l.label || l.url}</span>
       <button class="btn btn-sm" data-rm="${i}">移除</button>
     </div>`).join('') || '<span class="muted small">暂无链接</span>';
  box.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => { pendingLinks.splice(+b.dataset.rm, 1); renderLinkEdits(); });
}
document.getElementById('addLinkBtn').onclick = addLinkFromInput;
document.getElementById('f-link-url').addEventListener('keydown', e => { if (e.key === 'Enter') addLinkFromInput(); });
function addLinkFromInput() {
  const url = document.getElementById('f-link-url').value.trim();
  if (!url) return;
  const label = document.getElementById('f-link-label').value.trim() || url;
  pendingLinks.push({ label, url });
  document.getElementById('f-link-url').value = '';
  document.getElementById('f-link-label').value = '';
  renderLinkEdits();
}
document.getElementById('editCancel').onclick = () => dlg.classList.remove('show');
document.getElementById('editSave').onclick = () => {
  const name = document.getElementById('f-name').value.trim();
  if (!name) { toast('名称不能为空', 'danger'); return; }
  const data = {
    name, cat: document.getElementById('f-cat').value.trim(),
    status: document.getElementById('f-status').value,
    note: document.getElementById('f-note').value.trim(),
    links: pendingLinks.slice(), date: today()
  };
  if (editingId) Object.assign(records.find(x => x.id === editingId), data);
  else records.unshift({ id: id(), _sel: false, ...data });
  persist(); dlg.classList.remove('show'); render();
  toast(editingId ? '已保存' : '已新增', 'success');
};
dlg.onclick = e => { if (e.target === dlg) dlg.classList.remove('show'); };

// ---------- 工具栏 / 侧栏 ----------
document.getElementById('addBtn').onclick = () => openEdit(null);
document.getElementById('search').oninput = e => { search = e.target.value; render(); };
document.querySelectorAll('.side-item[data-filter]').forEach(it => it.onclick = () => {
  document.querySelectorAll('.side-item').forEach(x => x.classList.remove('active'));
  it.classList.add('active'); filter = it.dataset.filter; render();
});
document.getElementById('sideExport').onclick = () => {
  const blob = new Blob([JSON.stringify(records, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = 'records.json'; a.click(); toast('已导出 records.json', 'success');
};
document.getElementById('sideImport').onclick = () => document.getElementById('fileInput').click();
document.getElementById('fileInput').onchange = e => {
  const f = e.target.files[0]; if (!f) return;
  const rd = new FileReader();
  rd.onload = () => { try { records = JSON.parse(rd.result); persist(); render(); toast('导入成功', 'success'); } catch { toast('JSON 解析失败', 'danger'); } };
  rd.readAsText(f); e.target.value = '';
};

// ---------- 批量操作 ----------
document.getElementById('bulkDone').onclick = () => {
  records.forEach(r => { if (r._sel) { r.status = '已完成'; r._sel = false; } }); persist(); render(); toast('已标记完成', 'success');
};
document.getElementById('bulkDel').onclick = () => {
  records = records.filter(r => !r._sel); persist(); render(); toast('已删除选中', 'danger');
};

// ---------- Toast ----------
function toast(msg, type) {
  const wrap = document.getElementById('toastWrap');
  const t = document.createElement('div');
  t.className = 'toast' + (type ? ' toast-' + type : '');
  t.textContent = msg; wrap.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, 2200);
}

// ---------- 启动 ----------
loadData().then(d => { records = d; render(); });
