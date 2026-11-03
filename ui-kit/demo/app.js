// UI Kit demo · 交互演示
// 主题切换
const html = document.documentElement;
const themeBtn = document.getElementById('themeBtn');
themeBtn.onclick = () => {
  const dark = html.getAttribute('data-theme') === 'dark';
  html.setAttribute('data-theme', dark ? 'light' : 'dark');
  themeBtn.textContent = dark ? '🌓 切换深色' : '🌓 切换浅色';
};

// 侧边导航：点击滚动 + 滚动高亮
const navItems = document.querySelectorAll('.nav-item');
const sections = [...document.querySelectorAll('.section')];
navItems.forEach(it => it.onclick = () => {
  const t = document.getElementById(it.dataset.target);
  if (t) t.scrollIntoView({ behavior: 'smooth' });
});
window.onscroll = () => {
  let cur = sections[0]?.id;
  sections.forEach(s => { if (s.getBoundingClientRect().top < 140) cur = s.id; });
  navItems.forEach(n => n.classList.toggle('active', n.dataset.target === cur));
};
if (sections[0]) navItems[0].classList.add('active');

// 对话框
const mask = document.getElementById('dialogMask');
document.getElementById('openDialog').onclick = () => mask.classList.add('show');
document.getElementById('dlgCancel').onclick = () => mask.classList.remove('show');
document.getElementById('dlgOk').onclick = () => { mask.classList.remove('show'); toast('已确认操作', 'success'); };
mask.onclick = e => { if (e.target === mask) mask.classList.remove('show'); };

// Toast
const wrap = document.getElementById('toastWrap');
function toast(msg, type = '') {
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.textContent = msg;
  wrap.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 200); }, 2200);
}
document.getElementById('toastInfo').onclick = () => toast('这是一条信息提示');
document.getElementById('toastOk').onclick = () => toast('操作成功', 'success');
document.getElementById('toastErr').onclick = () => toast('操作失败', 'danger');

// Tabs
document.querySelectorAll('.tab').forEach(t => t.onclick = () => {
  document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(x => x.classList.remove('active'));
  t.classList.add('active');
  document.getElementById(t.dataset.tab).classList.add('active');
});

// 拖拽排序（拖动 = 拖动，不替换为按钮）
let dragEl = null;
function makeSortable(container, sel, onReorder) {
  if (!container) return;
  container.querySelectorAll(sel).forEach(row => {
    row.setAttribute('draggable', 'true');
    row.ondragstart = () => { dragEl = row; row.classList.add('dragging'); };
    row.ondragend = () => { row.classList.remove('dragging'); dragEl = null; if (onReorder) onReorder(); };
    row.ondragover = e => {
      e.preventDefault();
      if (dragEl && dragEl !== row) {
        const r = row.getBoundingClientRect();
        const after = (e.clientY - r.top) > r.height / 2;
        container.insertBefore(dragEl, after ? row.nextSibling : row);
      }
    };
  });
}
makeSortable(document.getElementById('dragList'), '.card-row');

// 双击编辑演示（双击 = 双击）
document.getElementById('dblCard').ondblclick = () => {
  document.getElementById('dblLog').textContent = '已双击触发（' + new Date().toLocaleTimeString() + '）';
};

// 下载队列演示（拖拽排序 + 暂停·继续 / 移除 为真按钮，不替换为其它交互）
const dlList = document.getElementById('dlList');
const DL_STATE = {
  downloading: { t: '下载中', c: 'badge-accent', icon: '⏸', speed: '下载中' },
  queued:      { t: '等待中', c: 'badge-warning', icon: '⏸', speed: '排队中' },
  paused:      { t: '已暂停', c: '', icon: '▶', speed: '已暂停' },
  done:        { t: '已完成', c: 'badge-success', icon: '↻', speed: '—' },
  error:       { t: '失败', c: 'badge-danger', icon: '↻', speed: '失败：连接超时' }
};
function updateRow(row) {
  const m = DL_STATE[row.dataset.state];
  const badge = row.querySelector('.badge');
  const toggle = row.querySelector('[data-act="toggle"]');
  const speed = row.querySelector('.dl-meta span');
  badge.textContent = m.t;
  badge.className = 'badge ' + m.c;
  if (toggle) toggle.textContent = m.icon;
  if (speed) speed.textContent = m.speed;
}
dlList.querySelectorAll('.dl-row').forEach(updateRow);
makeSortable(dlList, '.dl-row');
dlList.addEventListener('click', e => {
  const btn = e.target.closest('.icon-btn');
  if (!btn) return;
  const row = btn.closest('.dl-row');
  const act = btn.dataset.act;
  if (act === 'toggle') {
    const st = row.dataset.state;
    if (st === 'downloading' || st === 'queued') row.dataset.state = 'paused';
    else if (st === 'paused') row.dataset.state = 'downloading';
    else if (st === 'error') row.dataset.state = 'downloading';
    updateRow(row);
  } else if (act === 'remove') {
    row.remove();
  }
});

// ============ 记录本：数据 + 拖拽排序 + 链接 ============
function escapeHtml(s){ return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function todayStr(){ const d = new Date(); return (d.getMonth()+1) + '-' + d.getDate(); }

const STATUS_CLASS = { '进行中':'badge-accent', '已完成':'badge-success', '待办':'badge-warning' };
let records = [
  { id:1, title:'高等数学 复习', cat:'备考', status:'进行中', date:'10-29',
    links:[ {label:'B站课程', href:'https://www.bilibili.com', type:'web'},
            {label:'资料文件夹', path:'D:\\Documents\\备考资料', type:'file'} ] },
  { id:2, title:'日语 N2', cat:'学习', status:'已完成', date:'10-20', links:[] },
  { id:3, title:'健身计划', cat:'生活', status:'待办', date:'10-31',
    links:[ {label:'训练表', href:'https://docs.example.com/fit', type:'web'} ] }
];
const recList = document.getElementById('recList');

function linkChip(l, i) {
  if (l.type === 'web')
    return `<a class="link-chip link-web" draggable="false" data-href="${escapeHtml(l.href)}" data-li="${i}">🌐 ${escapeHtml(l.label)}<span class="x" data-rm>✕</span></a>`;
  return `<a class="link-chip link-file" draggable="false" data-path="${escapeHtml(l.path)}" data-li="${i}">📁 ${escapeHtml(l.label)}<span class="x" data-rm>✕</span></a>`;
}
function renderRecords() {
  recList.innerHTML = records.map(r => `
    <div class="rec-row" data-id="${r.id}" draggable="true">
      <span class="handle" title="拖拽排序">⋮⋮</span>
      <input type="checkbox" class="row-sel">
      <div class="rec-main">
        <div class="rec-title">${escapeHtml(r.title)}</div>
        <div class="rec-links">
          ${r.links.map(linkChip).join('')}
          <button class="link-add" data-addlink="${r.id}">＋链接</button>
        </div>
      </div>
      <span class="rec-cat">${escapeHtml(r.cat)}</span>
      <span class="rec-status"><span class="badge ${STATUS_CLASS[r.status]||''}">${escapeHtml(r.status)}</span></span>
      <span class="rec-date">${escapeHtml(r.date)}</span>
      <span class="rec-act"><button class="btn btn-sm" data-edit="${r.id}">编辑</button></span>
    </div>`).join('');
  makeSortable(recList, '.rec-row', syncRecordsOrder);
  bindRecordRows();
}
function bindRecordRows() {
  recList.querySelectorAll('.rec-row').forEach(row => {
    const id = +row.dataset.id;
    row.querySelector('.row-sel').onchange = refreshBulk;
    row.querySelector('[data-edit]').onclick = e => { e.stopPropagation(); openEdit('edit', id); };
    row.querySelector('[data-addlink]').onclick = e => { e.stopPropagation(); startInlineAdd(id, row); };
    row.querySelectorAll('.link-chip').forEach(chip => {
      chip.onclick = e => {
        e.preventDefault();
        if (e.target.hasAttribute('data-rm')) { removeLink(id, +chip.dataset.li); return; }
        openLink(chip);
      };
    });
  });
}
function syncRecordsOrder() {
  const order = [...recList.querySelectorAll('.rec-row')].map(r => +r.dataset.id);
  records.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
}
function openLink(chip) {
  if (chip.dataset.href) { const u = chip.dataset.href; window.open(u, '_blank'); toast('打开链接：' + u); }
  else {
    const p = chip.dataset.path;
    if (window.electronAPI && window.electronAPI.openPath) window.electronAPI.openPath(p);
    else toast('将在系统中打开本地路径：' + p);
  }
}
function removeLink(id, li) {
  const rec = records.find(r => r.id === id); if (!rec) return;
  rec.links.splice(li, 1); renderRecords();
}
function startInlineAdd(id, row) {
  const rec = records.find(r => r.id === id); if (!rec) return;
  const linksEl = row.querySelector('.rec-links');
  if (linksEl.querySelector('.link-input-wrap')) return;
  const wrap = document.createElement('span');
  wrap.className = 'link-input-wrap';
  wrap.innerHTML = '<input class="link-input" placeholder="网址 或 本地路径，回车添加">';
  linksEl.appendChild(wrap);
  const inp = wrap.querySelector('input'); inp.focus();
  inp.onkeydown = e => {
    if (e.key === 'Enter') { commitInlineAdd(rec, inp.value); wrap.remove(); }
    else if (e.key === 'Escape') { wrap.remove(); }
  };
  inp.onblur = () => wrap.remove();
}
function commitInlineAdd(rec, val) {
  val = (val||'').trim(); if (!val) return;
  const isWeb = /^https?:\/\//i.test(val);
  rec.links.push(isWeb ? {label:val, href:val, type:'web'} : {label:val, path:val, type:'file'});
  renderRecords();
}

// 编辑弹窗（含链接管理）
const editDialog = document.getElementById('editDialog');
let editId = null, editLinks = [];
function openEdit(mode, id) {
  editId = (mode === 'edit') ? id : null;
  const rec = (id != null) ? records.find(r => r.id === id) : null;
  editDialog.querySelector('#f-title').value = rec ? rec.title : '';
  editDialog.querySelector('#f-cat').value = rec ? rec.cat : '备考';
  editDialog.querySelector('#f-status').value = rec ? rec.status : '进行中';
  editLinks = rec ? rec.links.map(l => ({...l})) : [];
  renderEditLinks();
  editDialog.classList.add('show');
}
function renderEditLinks() {
  const box = document.getElementById('editLinks');
  box.innerHTML = editLinks.map((l,i) => `
    <div class="el-row">
      <span class="el-ico">${l.type==='web'?'🌐':'📁'}</span>
      <span class="el-text" title="${escapeHtml(l.href||l.path)}">${escapeHtml(l.label)}</span>
      <button class="el-del" data-i="${i}">✕</button>
    </div>`).join('');
  box.querySelectorAll('.el-del').forEach(b => b.onclick = () => { editLinks.splice(+b.dataset.i,1); renderEditLinks(); });
}
document.getElementById('editAddLink').onclick = () => {
  const box = document.getElementById('editLinks');
  if (box.querySelector('.el-input-wrap')) return;
  const wrap = document.createElement('div');
  wrap.className = 'el-input-wrap';
  wrap.innerHTML = '<input class="input el-input" placeholder="网址 或 本地路径，回车添加">';
  box.appendChild(wrap);
  const inp = wrap.querySelector('input'); inp.focus();
  inp.onkeydown = e => {
    if (e.key === 'Enter') {
      const v = inp.value.trim();
      if (v) { const isWeb = /^https?:\/\//i.test(v); editLinks.push(isWeb ? {label:v, href:v, type:'web'} : {label:v, path:v, type:'file'}); }
      wrap.remove(); renderEditLinks();
    } else if (e.key === 'Escape') { wrap.remove(); }
  };
  inp.onblur = () => { if (wrap.parentNode) wrap.remove(); };
};
document.getElementById('openEdit').onclick = () => openEdit('add');
editDialog.querySelector('#editCancel').onclick = () => editDialog.classList.remove('show');
editDialog.onclick = e => { if (e.target === editDialog) editDialog.classList.remove('show'); };
editDialog.querySelector('#editSave').onclick = () => {
  const title = editDialog.querySelector('#f-title').value.trim();
  if (!title) { toast('请填写名称', 'danger'); return; }
  const cat = editDialog.querySelector('#f-cat').value;
  const status = editDialog.querySelector('#f-status').value;
  if (editId == null) {
    const newId = records.length ? Math.max(...records.map(r=>r.id)) + 1 : 1;
    records.push({ id:newId, title, cat, status, date: todayStr(), links: editLinks });
  } else {
    const rec = records.find(r => r.id === editId);
    Object.assign(rec, { title, cat, status, links: editLinks });
  }
  editDialog.classList.remove('show');
  renderRecords();
  toast('已保存记录', 'success');
};

// ============ 记录本多选 / 批量操作 ============
const selAll = document.getElementById('selAll');
const rowSels = () => [...recList.querySelectorAll('.row-sel')];
const bulkBar = document.getElementById('bulkBar');
function refreshBulk() {
  const n = rowSels().filter(c => c.checked).length;
  bulkBar.classList.toggle('show', n > 0);
  document.getElementById('bulkCount').textContent = '已选 ' + n + ' 项';
}
selAll.onchange = () => { rowSels().forEach(c => c.checked = selAll.checked); refreshBulk(); };
document.getElementById('bulkDone').onclick = () => toast('已标记完成', 'success');
document.getElementById('bulkDel').onclick = () => toast('已删除选中', 'danger');

renderRecords();

// ============ 设置页分组切换 ============
const setNav = document.getElementById('setNav');
setNav.querySelectorAll('.snav').forEach(n => n.onclick = () => {
  setNav.querySelectorAll('.snav').forEach(x => x.classList.remove('active'));
  n.classList.add('active');
  document.querySelectorAll('[data-setgroup]').forEach(g => g.style.display = (g.dataset.setgroup === n.dataset.set) ? '' : 'none');
});

// ============ 下载详情抽屉 ============
const drawerMask = document.getElementById('drawerMask');
document.getElementById('openDrawer').onclick = () => drawerMask.classList.add('show');
document.getElementById('closeDrawer').onclick = () => drawerMask.classList.remove('show');
drawerMask.onclick = e => { if (e.target === drawerMask) drawerMask.classList.remove('show'); };
document.querySelectorAll('[data-log]').forEach(b => b.onclick = () => {
  const lv = b.dataset.log;
  document.querySelectorAll('#logView .log-line').forEach(l => {
    l.style.display = (lv === 'all' || l.classList.contains('log-' + lv)) ? '' : 'none';
  });
});

// ============ 命令面板 Cmd+K ============
const cmdkMask = document.getElementById('cmdkMask');
const cmdkInput = document.getElementById('cmdkInput');
const cmdkItems = () => [...document.querySelectorAll('#cmdkList .cmdk-item')];
function openCmdk() { cmdkMask.classList.add('show'); cmdkInput.value = ''; cmdkInput.focus(); filterCmdk(); }
function closeCmdk() { cmdkMask.classList.remove('show'); }
document.getElementById('openCmdk').onclick = openCmdk;
cmdkMask.onclick = e => { if (e.target === cmdkMask) closeCmdk(); };
cmdkInput.oninput = filterCmdk;
function filterCmdk() {
  const q = cmdkInput.value.trim().toLowerCase();
  let any = false;
  cmdkItems().forEach(it => {
    const hit = it.querySelector('.ci-label').textContent.toLowerCase().includes(q);
    it.style.display = hit ? '' : 'none';
    if (hit) any = true;
  });
  let empty = document.getElementById('cmdkEmpty');
  if (!any && !empty) {
    empty = document.createElement('div');
    empty.id = 'cmdkEmpty'; empty.className = 'cmdk-empty'; empty.textContent = '无匹配结果';
    document.getElementById('cmdkList').appendChild(empty);
  } else if (any && empty) empty.remove();
}
cmdkItems().forEach(it => it.onclick = () => { closeCmdk(); toast('执行：' + it.querySelector('.ci-label').textContent); });

// ============ 右键上下文菜单 ============
const ctxMenu = document.getElementById('ctxMenu');
document.addEventListener('contextmenu', e => {
  if (e.target.closest('.table-wrap, .card-row, .dl-row, .rec-row')) {
    e.preventDefault();
    ctxMenu.style.left = e.clientX + 'px';
    ctxMenu.style.top = e.clientY + 'px';
    ctxMenu.classList.add('show');
  }
});
ctxMenu.querySelectorAll('.ctx-item').forEach(i => i.onclick = () => { ctxMenu.classList.remove('show'); toast('操作：' + i.textContent); });
document.addEventListener('click', () => ctxMenu.classList.remove('show'));

// ============ 全局快捷键 ============
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openCmdk(); }
  if (e.key === 'Escape') { closeCmdk(); drawerMask.classList.remove('show'); editDialog.classList.remove('show'); ctxMenu.classList.remove('show'); }
  if (cmdkMask.classList.contains('show')) {
    const vis = cmdkItems().filter(i => i.style.display !== 'none');
    let idx = vis.findIndex(i => i.classList.contains('active'));
    if (e.key === 'ArrowDown') { e.preventDefault(); if (idx >= 0) vis[idx].classList.remove('active'); const n = vis[(idx + 1) % vis.length]; if (n) n.classList.add('active'); }
    if (e.key === 'ArrowUp') { e.preventDefault(); if (idx >= 0) vis[idx].classList.remove('active'); const n = vis[(idx - 1 + vis.length) % vis.length]; if (n) n.classList.add('active'); }
    if (e.key === 'Enter') { const a = vis.find(i => i.classList.contains('active')) || vis[0]; if (a) { closeCmdk(); toast('执行：' + a.querySelector('.ci-label').textContent); } }
  }
});

// ============ 配色方案（分类数据 2/3/4 元） ============
function hexToRgb(h) { h = h.replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
function rel(c) { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
function lum(rgb) { return 0.2126 * rel(rgb[0]) + 0.7152 * rel(rgb[1]) + 0.0722 * rel(rgb[2]); }
function contrast(a, b) { const la = lum(a), lb = lum(b), hi = Math.max(la, lb), lo = Math.min(la, lb); return (hi + 0.05) / (lo + 0.05); }
const _WHITE = [255, 255, 255], _DARK = [43, 43, 43], _BLACKT = [31, 31, 31];
function bestText(rgb) { const cw = contrast(rgb, _WHITE), cb = contrast(rgb, _BLACKT); return cw >= cb ? { color: '#ffffff', cr: cw } : { color: '#1f1f1f', cr: cb }; }

const PALETTES = [
  { id: 'A', name: 'A · 政务高对比', tag: '蓝+橙 王牌组合 · 政府分析功能/苏格兰政府 · 色盲校验通过',
    note: '蓝+橙是该谱系对比最强的一对。紫在深底<3:1，深底 UI 用紫深变体 #B07CC6。切换主题整组替换。',
    colors: [{ n: '蓝', h: '#0072B2' }, { n: '青绿', h: '#2B9C93' }, { n: '紫', h: '#6A2063' }, { n: '橙', h: '#E5682A' }],
    light: { 2: ['#0072B2', '#E5682A'], 3: ['#0072B2', '#2B9C93', '#E5682A'], 4: ['#0072B2', '#2B9C93', '#6A2063', '#E5682A'] },
    dark: { 2: ['#2B9C93', '#E5682A'], 3: ['#2B9C93', '#E5682A', '#56B4E9'], 4: ['#2B9C93', '#E5682A', '#56B4E9', '#B07CC6'] } },
  { id: 'B', name: 'B · Okabe-Ito 色盲安全', tag: '学界/出版金标准 · 三种色盲下两两可辨',
    note: '色盲安全金标准。浅底与深底最优子集完全不同（典型反例）：浅底用蓝+朱红系，深底用橙+天蓝+黄系。切换主题整组替换。',
    colors: [{ n: '橙', h: '#E69F00' }, { n: '天蓝', h: '#56B4E9' }, { n: '蓝绿', h: '#009E73' }, { n: '黄', h: '#F0E442' }, { n: '蓝', h: '#0072B2' }, { n: '朱红', h: '#D55E00' }, { n: '紫红', h: '#CC79A7' }],
    light: { 2: ['#0072B2', '#D55E00'], 3: ['#0072B2', '#009E73', '#D55E00'], 4: ['#0072B2', '#009E73', '#D55E00', '#CC79A7'] },
    dark: { 2: ['#E69F00', '#56B4E9'], 3: ['#E69F00', '#56B4E9', '#F0E442'], 4: ['#E69F00', '#56B4E9', '#F0E442', '#CC79A7'] } },
  { id: 'C', name: 'C · 现代明快', tag: 'Indigo/Emerald/Amber/Rose · 鲜艳现代感',
    note: '鲜艳现代，但浅底/深底必须用不同明度变体（色块上已标注 浅/深 变体 HEX）。',
    colors: [{ n: '靛蓝·浅', h: '#4F46E5' }, { n: '翠绿·浅', h: '#059669' }, { n: '琥珀·浅', h: '#B45309' }, { n: '玫红·浅', h: '#E11D48' }, { n: '靛蓝·深', h: '#818CF8' }, { n: '翠绿·深', h: '#34D399' }, { n: '琥珀·深', h: '#FBBF24' }, { n: '玫红·深', h: '#FB7185' }],
    light: { 2: ['#4F46E5', '#E11D48'], 3: ['#4F46E5', '#059669', '#E11D48'], 4: ['#4F46E5', '#059669', '#B45309', '#E11D48'] },
    dark: { 2: ['#818CF8', '#FB7185'], 3: ['#818CF8', '#34D399', '#FB7185'], 4: ['#818CF8', '#34D399', '#FBBF24', '#FB7185'] } },
  { id: 'D', name: 'D · 柔和商务', tag: '低饱和 · 专业 · 适合大色块/图表（勿做小圆点）',
    note: '整体对比偏低；沙金 #C2A35A 在浅底<3:1，仅深底可用。',
    colors: [{ n: '灰蓝', h: '#5B7DB1' }, { n: '苔绿', h: '#6F9E7E' }, { n: '沙金', h: '#C2A35A' }, { n: '藕荷', h: '#9B7BA8' }],
    light: { 2: ['#5B7DB1', '#9B7BA8'], 3: ['#5B7DB1', '#6F9E7E', '#9B7BA8'], 4: ['#5B7DB1', '#6F9E7E', '#9B7BA8'] },
    dark: { 2: ['#C2A35A', '#6F9E7E'], 3: ['#C2A35A', '#6F9E7E', '#9B7BA8'], 4: ['#C2A35A', '#6F9E7E', '#9B7BA8', '#5B7DB1'] } },
  { id: 'E', name: 'E · 语义状态色', tag: 'Success/Warning/Error/Info · 状态徽标专用（非分类）',
    note: '专用于状态徽标，必配图标+文字；深底用柔色底+彩色字（UI Kit 内置 --*-soft）。下方深底框会标红——提示深底别用实色块。',
    colors: [{ n: '成功', h: '#0E700E' }, { n: '警告', h: '#BC4B09' }, { n: '错误', h: '#C42B1C' }, { n: '信息', h: '#0F6CBD' }],
    light: { 2: ['#0E700E', '#BC4B09'], 3: ['#0E700E', '#BC4B09', '#0F6CBD'], 4: ['#0E700E', '#BC4B09', '#C42B1C', '#0F6CBD'] },
    dark: { 2: ['#0E700E', '#BC4B09'], 3: ['#0E700E', '#BC4B09', '#0F6CBD'], 4: ['#0E700E', '#BC4B09', '#C42B1C', '#0F6CBD'] } }
];

function catDiv(h, i) { const bt = bestText(hexToRgb(h)); return `<div class="cat" style="background:${h};color:${bt.color}">${i + 1}</div>`; }

function renderPalette() {
  const root = document.getElementById('paletteRoot');
  let html = '';
  PALETTES.forEach(s => {
    html += `<div class="scheme-card"><div class="scheme-head"><h3>${s.name}</h3><span class="scheme-tag">${s.tag}</span></div>`;
    html += `<div class="scheme-note">${s.note}</div>`;
    html += '<div class="swatch-grid">';
    s.colors.forEach(c => {
      const rgb = hexToRgb(c.h), bt = bestText(rgb);
      const cw = contrast(rgb, _WHITE), cd = contrast(rgb, _DARK);
      const cwBad = cw < 3 ? 'bad' : '', cdBad = cd < 3 ? 'bad' : '';
      html += `<div class="swatch"><div class="fill" style="background:${c.h};color:${bt.color}">${c.n}</div>` +
        `<div class="meta"><div class="hex">${c.h}</div>` +
        `<div class="cr"><span class="${cwBad}">浅 ${cw.toFixed(2)}</span><span class="${cdBad}">深 ${cd.toFixed(2)}</span></div></div></div>`;
    });
    html += '</div><div class="pick-block">';
    [2, 3, 4].forEach(k => {
      const label = k === 2 ? '二元' : k === 3 ? '三元' : '四元';
      const lk = s.light[k] || [], dk = s.dark[k] || [];
      html += `<div class="pick-row"><div class="pl">${label}</div>` +
        `<div style="flex:1"><div class="surface-cap">浅底 (#fff)</div><div class="surface-box light">${lk.map(catDiv).join('')}</div></div>` +
        `<div style="flex:1"><div class="surface-cap">深底 (#2b2b2b)</div><div class="surface-box dark">${dk.map(catDiv).join('')}</div></div></div>`;
    });
    html += '</div>';
    const sl = s.light[4] || [], sd = s.dark[4] || [];
    const sBars = arr => arr.map((h, i) => { const bt = bestText(hexToRgb(h)); const ht = [42, 64, 82, 100][i] || 60; return `<div class="col"><div class="bar" style="height:${ht}%;background:${h}"></div><div class="cl">${i + 1}</div></div>`; }).join('');
    html += `<div class="surface-cap">示例图表（4 类柱状，浅/深底）</div><div class="sample-bar light">${sBars(sl)}</div>` +
      `<div class="sample-bar dark" style="margin-top:8px">${sBars(sd)}</div></div>`;
  });
  root.innerHTML = html;
}
renderPalette();

// ============ 日历 / 日期选择器 ============
(function () {
  const grid = document.getElementById('calGrid');
  const title = document.getElementById('calTitle');
  const selEl = document.getElementById('calSel');
  const today = new Date(); today.setHours(0, 0, 0, 0);
  let view = new Date(today.getFullYear(), today.getMonth(), 1);
  let selected = null;
  const fmt = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  function render() {
    title.textContent = `${view.getFullYear()}年${view.getMonth() + 1}月`;
    const first = new Date(view.getFullYear(), view.getMonth(), 1);
    const start = new Date(first); start.setDate(1 - first.getDay());
    const cells = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(start); d.setDate(start.getDate() + i);
      const cls = ['cal-cell'];
      if (d.getMonth() !== view.getMonth()) cls.push('other');
      if (d.getTime() === today.getTime()) cls.push('today');
      if (fmt(d) === selected) cls.push('selected');
      cells.push(`<div class="${cls.join(' ')}" data-key="${fmt(d)}">${d.getDate()}</div>`);
    }
    grid.innerHTML = cells.join('');
    grid.querySelectorAll('.cal-cell').forEach(c => c.onclick = () => { selected = c.dataset.key; selEl.textContent = selected; render(); });
  }
  document.getElementById('calPrev').onclick = () => { view.setMonth(view.getMonth() - 1); render(); };
  document.getElementById('calNext').onclick = () => { view.setMonth(view.getMonth() + 1); render(); };
  document.getElementById('calToday').onclick = () => { view = new Date(today.getFullYear(), today.getMonth(), 1); selected = fmt(today); selEl.textContent = selected; render(); };
  render();
})();

// ============ 图片查看器 / 画廊 ============
(function () {
  const pairs = [['#4F46E5', '#0ea5e9', '山'], ['#059669', '#84cc16', '海'], ['#B45309', '#f59e0b', '林'], ['#E11D48', '#f472b6', '花'], ['#0f6cbd', '#22d3ee', '城']];
  function svgImg(a, b, label) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="640" height="360" fill="url(#g)"/><text x="50%" y="55%" font-size="120" fill="rgba(255,255,255,.85)" text-anchor="middle" font-family="sans-serif" font-weight="700">${label}</text></svg>`;
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }
  const imgs = pairs.map(p => svgImg(p[0], p[1], p[2]));
  const mainImg = document.getElementById('gmImg');
  const thumbsEl = document.getElementById('gmThumbs');
  const idxEl = document.getElementById('gmIndex');
  const zoomEl = document.getElementById('gmZoom');
  let idx = 0, zoom = 1;
  thumbsEl.innerHTML = imgs.map((s, i) => `<div class="gm-thumb${i === 0 ? ' active' : ''}" data-i="${i}"><img src="${s}" alt=""></div>`).join('');
  function show() {
    mainImg.innerHTML = `<img src="${imgs[idx]}" style="transform:scale(${zoom})">`;
    idxEl.textContent = `${idx + 1} / ${imgs.length}`;
    zoomEl.textContent = Math.round(zoom * 100) + '%';
    thumbsEl.querySelectorAll('.gm-thumb').forEach(t => t.classList.toggle('active', +t.dataset.i === idx));
  }
  thumbsEl.querySelectorAll('.gm-thumb').forEach(t => t.onclick = () => { idx = +t.dataset.i; zoom = 1; show(); });
  document.getElementById('gmPrev').onclick = () => { idx = (idx - 1 + imgs.length) % imgs.length; zoom = 1; show(); };
  document.getElementById('gmNext').onclick = () => { idx = (idx + 1) % imgs.length; zoom = 1; show(); };
  document.getElementById('gmZoomIn').onclick = () => { zoom = Math.min(3, zoom + 0.25); show(); };
  document.getElementById('gmZoomOut').onclick = () => { zoom = Math.max(0.25, zoom - 0.25); show(); };
  document.getElementById('gmFit').onclick = () => { zoom = 1; show(); };
  show();
})();

// ============ Markdown 编辑器 ============
(function () {
  const input = document.getElementById('mdInput');
  const preview = document.getElementById('mdPreview');
  function esc(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function inline(s) {
    return s
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  }
  function md(src) {
    const lines = esc(src).split('\n');
    let html = '', i = 0;
    const isBlock = l => /^(#{1,3}\s|>\s?|```|\s*[-*]\s|\s*\d+\.\s|---+$)/.test(l);
    while (i < lines.length) {
      let line = lines[i];
      if (/^```/.test(line)) { let code = []; i++; while (i < lines.length && !/^```/.test(lines[i])) { code.push(lines[i]); i++; } i++; html += `<pre><code>${code.join('\n')}</code></pre>`; continue; }
      let m = line.match(/^(#{1,3})\s+(.*)$/);
      if (m) { const n = m[1].length; html += `<h${n}>${inline(m[2])}</h${n}>`; i++; continue; }
      if (/^>\s?/.test(line)) { let q = []; while (i < lines.length && /^>\s?/.test(lines[i])) { q.push(lines[i].replace(/^>\s?/, '')); i++; } html += `<blockquote>${q.map(inline).join('<br>')}</blockquote>`; continue; }
      if (/^---+$/.test(line)) { html += '<hr>'; i++; continue; }
      if (/^\s*[-*]\s+/.test(line)) { let items = []; while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*[-*]\s+/, '')); i++; } html += `<ul>${items.map(it => `<li>${inline(it)}</li>`).join('')}</ul>`; continue; }
      if (/^\s*\d+\.\s+/.test(line)) { let items = []; while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*\d+\.\s+/, '')); i++; } html += `<ol>${items.map(it => `<li>${inline(it)}</li>`).join('')}</ol>`; continue; }
      if (line.trim() === '') { i++; continue; }
      let para = []; while (i < lines.length && lines[i].trim() !== '' && !isBlock(lines[i])) { para.push(lines[i]); i++; }
      html += `<p>${para.map(inline).join('<br>')}</p>`;
    }
    return html;
  }
  function render() { preview.innerHTML = md(input.value); }
  input.addEventListener('input', render);
  document.querySelectorAll('[data-md]').forEach(b => b.onclick = () => {
    const type = b.dataset.md, s = input.selectionStart, e = input.selectionEnd, v = input.value, sel = v.slice(s, e) || '文本';
    let ins = '';
    if (type === 'bold') ins = '**' + sel + '**';
    else if (type === 'italic') ins = '*' + sel + '*';
    else if (type === 'h') ins = '## ' + sel;
    else if (type === 'list') ins = '\n- ' + sel;
    else if (type === 'code') ins = '- `' + sel + '`';
    else if (type === 'link') ins = '[' + sel + '](https://)';
    input.value = v.slice(0, s) + ins + v.slice(e);
    input.focus(); input.selectionStart = input.selectionEnd = s + ins.length;
    render();
  });
  render();
})();

// ============ 高级数据表格 ============
(function () {
  const DATA = [
    { name: '高等数学复习', cat: '备考', status: '进行中', progress: 72, updated: '10-29' },
    { name: '日语 N2 单词', cat: '学习', status: '已完成', progress: 100, updated: '10-20' },
    { name: '健身计划', cat: '生活', status: '待办', progress: 0, updated: '10-31' },
    { name: '进击的巨人', cat: '动漫', status: '进行中', progress: 88, updated: '10-30' },
    { name: '原神养成', cat: '游戏', status: '进行中', progress: 45, updated: '10-28' },
    { name: '米哈游抽卡记录', cat: '游戏', status: '已完成', progress: 100, updated: '10-15' },
    { name: '数据结构笔记', cat: '备考', status: '待办', progress: 10, updated: '10-26' },
    { name: '间谍过家家', cat: '动漫', status: '逾期', progress: 30, updated: '09-12' },
    { name: '英语阅读训练', cat: '学习', status: '进行中', progress: 60, updated: '10-27' },
    { name: '番剧收藏夹', cat: '动漫', status: '已完成', progress: 100, updated: '10-10' },
    { name: '待办日历配置', cat: '生活', status: '进行中', progress: 55, updated: '10-29' },
    { name: '课件归档', cat: '学习', status: '待办', progress: 0, updated: '10-31' },
    { name: '链锯人二刷', cat: '动漫', status: '进行中', progress: 75, updated: '10-22' },
    { name: '跑步月计划', cat: '生活', status: '逾期', progress: 40, updated: '09-30' }
  ];
  const COLS = [
    { key: 'name', label: '名称', sortable: true },
    { key: 'cat', label: '分类', sortable: true },
    { key: 'status', label: '状态', sortable: true },
    { key: 'progress', label: '进度', sortable: true, render: v => `<div class="progress" style="width:90px"><div class="bar" style="width:${v}%"></div></div>` },
    { key: 'updated', label: '更新', sortable: true }
  ];
  const statusBadge = s => ({ '进行中': 'badge-accent', '已完成': 'badge-success', '待办': 'badge-warning', '逾期': 'badge-danger' }[s] || '');
  let sortKey = null, sortAsc = true, page = 1, pageSize = 10, filter = '', hidden = new Set();
  const headEl = document.getElementById('dtHead'), bodyEl = document.getElementById('dtBody'), pagerEl = document.getElementById('dtPager');
  const searchEl = document.getElementById('dtSearch'), sizeEl = document.getElementById('dtPageSize');
  const visibleCols = () => COLS.filter(c => !hidden.has(c.key));
  function filtered() {
    let r = filter ? DATA.filter(x => (x.name + x.cat).toLowerCase().includes(filter.toLowerCase())) : DATA.slice();
    if (sortKey) r.sort((a, b) => {
      let va = a[sortKey], vb = b[sortKey];
      if (typeof va === 'number') return sortAsc ? va - vb : vb - va;
      return sortAsc ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
    });
    return r;
  }
  function renderHead() {
    headEl.innerHTML = visibleCols().map(c => {
      const sorted = c.key === sortKey;
      return `<th class="th-sort${sorted ? ' sorted' : ''}" data-key="${c.key}">${c.label}<span class="arrow">${sorted ? (sortAsc ? '▲' : '▼') : '↕'}</span></th>`;
    }).join('');
    headEl.querySelectorAll('.th-sort').forEach(th => th.onclick = () => {
      const k = th.dataset.key;
      if (sortKey === k) sortAsc = !sortAsc; else { sortKey = k; sortAsc = true; }
      page = 1; render();
    });
  }
  function render() {
    renderHead();
    const r = filtered(), total = r.length, pages = Math.max(1, Math.ceil(total / pageSize));
    if (page > pages) page = pages;
    const rows = r.slice((page - 1) * pageSize, page * pageSize);
    bodyEl.innerHTML = rows.length
      ? rows.map(x => `<tr>${visibleCols().map(c => `<td>${c.render ? c.render(x[c.key]) : (c.key === 'status' ? `<span class="badge ${statusBadge(x.status)}">${x.status}</span>` : x[c.key])}</td>`).join('')}</tr>`).join('')
      : `<tr><td colspan="${visibleCols().length}" class="empty">无匹配数据</td></tr>`;
    let p = `<button class="pg-btn" data-pg="prev" ${page === 1 ? 'disabled' : ''}>‹</button>`;
    const s = Math.max(1, page - 2), e = Math.min(pages, page + 2);
    for (let i = s; i <= e; i++) p += `<button class="pg-btn ${i === page ? 'active' : ''}" data-pg="${i}">${i}</button>`;
    p += `<button class="pg-btn" data-pg="next" ${page === pages ? 'disabled' : ''}>›</button>`;
    p += `<span class="spacer"></span><span class="small muted">共 ${total} 条 · ${page}/${pages} 页</span>`;
    pagerEl.innerHTML = p;
    pagerEl.querySelectorAll('.pg-btn').forEach(b => b.onclick = () => {
      const v = b.dataset.pg;
      if (v === 'prev') page = Math.max(1, page - 1);
      else if (v === 'next') page = Math.min(pages, page + 1);
      else page = +v;
      render();
    });
  }
  searchEl.addEventListener('input', () => { filter = searchEl.value.trim(); page = 1; render(); });
  sizeEl.addEventListener('change', () => { pageSize = +sizeEl.value; page = 1; render(); });
  const colsBtn = document.getElementById('dtCols');
  colsBtn.onclick = (ev) => { ev.stopPropagation(); openColMenu(colsBtn); };
  function openColMenu(anchor) {
    closeColMenu();
    const menu = document.createElement('div'); menu.className = 'dt-col-menu'; menu.id = 'dtColMenu';
    menu.innerHTML = COLS.map(c => `<label><input type="checkbox" ${hidden.has(c.key) ? '' : 'checked'} data-key="${c.key}"> ${c.label}</label>`).join('');
    document.body.appendChild(menu);
    const r = anchor.getBoundingClientRect();
    menu.style.top = (r.bottom + 6) + 'px'; menu.style.left = r.left + 'px';
    menu.querySelectorAll('input').forEach(i => i.onchange = () => { if (i.checked) hidden.delete(i.dataset.key); else hidden.add(i.dataset.key); render(); });
    setTimeout(() => document.addEventListener('click', closeColMenu, { once: true }), 0);
  }
  function closeColMenu() { const m = document.getElementById('dtColMenu'); if (m) m.remove(); }
  render();
})();
