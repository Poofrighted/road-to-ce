// ===================== DATA =====================
let data = JSON.parse(localStorage.getItem('finseed') || 'null') || {
  isNewUser: true,
  userName: '',
  transactions: [],
  planned: [],
  savings: [],
  minBalance: 1000,
  piggyBank: 0,
  treeThresholds: [0, 500, 1500, 50000, 100000]
};

// Migrate: เติม field ที่ขาดสำหรับ data เวอร์ชันเก่า
if (!data.treeThresholds) data.treeThresholds = [0, 500, 1500, 50000, 100000];
if (!data.savings) data.savings = [];
if (!data.planned) data.planned = [];
if (!data.transactions) data.transactions = [];
if (data.userName === undefined) data.userName = '';
if (data.isNewUser === undefined) data.isNewUser = !data.userName && !data.transactions.length && !data.planned.length && !data.savings.length;
if (data.piggyBank === undefined) data.piggyBank = 0;
if (data.minBalance === undefined) data.minBalance = 1000;
// ถ้าเคยใช้ระบบเก่า totalDrops ให้แปลงเป็น piggyBank (1 drop = 1 บาท)
if (data.totalDrops && !data.piggyBank) data.piggyBank = data.totalDrops;
save();

function save() {
  localStorage.setItem('finseed', JSON.stringify(data));
}

// ===================== TREE STAGES =====================
const STAGE_META = [
  { name: 'เมล็ด',   emoji: '🌰', desc: 'จุดเริ่มต้นของทุกอย่าง...' },
  { name: 'ต้นกล้า', emoji: '🌱', desc: 'เริ่มต้นแล้ว! ต้นไม้กำลังงอกงาม' },
  { name: 'ต้นไม้',  emoji: '🌿', desc: 'ต้นไม้แข็งแรงขึ้นแล้ว ออมต่อไปนะ!' },
  { name: 'ป่า',     emoji: '🌳', desc: 'ป่าน้อยๆ กำลังก่อตัว สุดยอด!' },
  { name: 'ป่าทอง',  emoji: '🌴✨', desc: 'ป่าทองแห่งนักออมตัวจริง! คุณทำได้!' }
];

function getStages() {
  return STAGE_META.map((m, i) => ({ ...m, threshold: data.treeThresholds[i] || 0 }));
}

function getStageIndex(piggy) {
  const stages = getStages();
  let s = 0;
  for (let i = stages.length - 1; i >= 0; i--) {
    if (piggy >= stages[i].threshold) { s = i; break; }
  }
  return s;
}

// ===================== UTILS =====================
function fmt(n) {
  return '฿' + Number(n).toLocaleString('th-TH', {minimumFractionDigits:0, maximumFractionDigits:2});
}
function today() {
  return new Date().toISOString().slice(0, 10);
}
function daysLeftInMonth() {
  const now = new Date();
  const last = new Date(now.getFullYear(), now.getMonth()+1, 0).getDate();
  return last - now.getDate() + 1;
}
function thisMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
}
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }

function showToast(msg, ms=2500) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), ms);
}

let _confirmCallback = null;
function showConfirm(msg, onYes) {
  document.getElementById('modal-title').textContent = msg;
  document.getElementById('modal-desc').textContent = 'การกระทำนี้ไม่สามารถย้อนกลับได้';
  document.getElementById('modal-overlay').style.display = 'flex';
  _confirmCallback = onYes;
}
function closeConfirm(e) {
  if (e && e.target !== document.getElementById('modal-overlay')) return;
  document.getElementById('modal-overlay').style.display = 'none';
  _confirmCallback = null;
}
function confirmYes() {
  document.getElementById('modal-overlay').style.display = 'none';
  if (_confirmCallback) _confirmCallback();
  _confirmCallback = null;
}

// ===================== CALCULATIONS =====================
function calcMonth(ym) {
  const txs = data.transactions.filter(t => t.date.startsWith(ym));
  const income  = txs.filter(t => t.type==='income').reduce((s,t)=>s+t.amount, 0);
  const expense = txs.filter(t => t.type==='expense').reduce((s,t)=>s+t.amount, 0);
  return { income, expense, net: income-expense };
}

function calcBalance() {
  const inc  = data.transactions.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0);
  const exp  = data.transactions.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);
  const sav  = data.piggyBank;
  return inc - exp - sav;
}

// ===================== DASHBOARD =====================
function renderDashboard() {
  const balance = calcBalance();
  const planned = data.planned.filter(p=>!p.paid).reduce((s,p)=>s+p.amount, 0);
  const days = daysLeftInMonth();
  const freeAfterPlanned = balance - planned;
  const daily = days > 0 ? freeAfterPlanned / days : 0;
  const { income, expense } = calcMonth(thisMonth());
  const maxIE = Math.max(income, expense, 1);

  const welcomeName = document.getElementById('welcome-name');
  if (welcomeName) welcomeName.textContent = data.userName || 'นักออม';

  document.getElementById('db-balance').textContent = fmt(balance);
  document.getElementById('db-planned').textContent = fmt(planned);
  document.getElementById('db-daily').textContent = daily >= 0 ? fmt(Math.max(0,daily)) : '฿0';
  document.getElementById('db-days-left').textContent = days;
  document.getElementById('db-income').textContent = fmt(income);
  document.getElementById('db-expense').textContent = fmt(expense);
  document.getElementById('db-income-bar').style.width = (income/maxIE*100)+'%';
  document.getElementById('db-expense-bar').style.width = (expense/maxIE*100)+'%';
  const mbInput = document.getElementById('min-balance-input');
  if (mbInput) mbInput.value = data.minBalance || '';

  // Alert
  const az = document.getElementById('alert-zone');
  if (balance < data.minBalance) {
    az.innerHTML = `<div class="alert alert-warn"><span class="alert-icon">⚠️</span>ยอดเงินคงเหลือ <strong>${fmt(balance)}</strong> ต่ำกว่าขั้นต่ำที่กำหนด <strong>${fmt(data.minBalance)}</strong> - ระวังค่าใช้จ่ายด้วยนะ!</div>`;
  } else {
    az.innerHTML = `<div class="alert alert-ok"><span class="alert-icon">✅</span>ยอดเงินปลอดภัย - คงเหลือ <strong>${fmt(balance)}</strong></div>`;
  }

  // Recent list
  const recent = [...data.transactions].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,8);
  const rl = document.getElementById('recent-list');
  if (!recent.length) {
    rl.innerHTML = '<div class="empty"><span class="empty-icon">📭</span>ยังไม่มีรายการ</div>';
  } else {
    rl.innerHTML = recent.map(t => `
      <div class="list-item">
        <div class="list-dot ${t.type==='income'?'dot-green':'dot-red'}"></div>
        <div class="list-name">${t.name}</div>
        <div class="list-meta">
          <div class="list-amount ${t.type==='income'?'stat-green':'stat-red'}">${t.type==='income'?'+':'-'}${fmt(t.amount)}</div>
          <div class="list-date">${t.date}</div>
        </div>
      </div>`).join('');
  }
}

function saveMinBalance() {
  const v = parseFloat(document.getElementById('min-balance-input').value);
  if (isNaN(v) || v < 0) { showToast('⚠️ กรุณากรอกจำนวนที่ถูกต้อง'); return; }
  data.minBalance = v;
  save();
  renderDashboard();
  showToast(`✅ ตั้งยอดขั้นต่ำ ${fmt(v)} แล้ว`);
}

function saveUserProfile() {
  const inp = document.getElementById('user-name-input');
  data.userName = inp ? inp.value.trim() : '';
  save();
  renderNewUserPages();
  renderDashboard();
  showToast(data.userName ? `✅ บันทึกชื่อ ${data.userName} แล้ว` : '✅ ล้างชื่อผู้ใช้แล้ว');
}

function renderSettingsThresholds() {
  const nameInp = document.getElementById('user-name-input');
  if (nameInp) nameInp.value = data.userName || '';

  const inp = document.getElementById('min-balance-input');
  if (inp) inp.value = data.minBalance || '';

  const stages = getStages();
  const tf = document.getElementById('threshold-fields');
  if (!tf) return;
  tf.innerHTML = stages.slice(1).map((s, i) => `
    <div class="setting-row">
      <div class="setting-label">${s.emoji} ${s.name}<small>ยอดขั้นต่ำที่ต้องออมเพื่ออัพเลเวล</small></div>
      <input type="number" id="thresh-${i+1}" value="${s.threshold}" min="0" style="width:130px">
    </div>`).join('');
}

function renderNewUserPages() {
  const setupName = document.getElementById('setup-user-name-input');
  if (setupName) setupName.value = data.userName || '';

  const setupMin = document.getElementById('setup-min-balance-input');
  if (setupMin) setupMin.value = data.minBalance || '';

  const stages = getStages();
  const setupTf = document.getElementById('setup-threshold-fields');
  if (setupTf) {
    setupTf.innerHTML = stages.slice(1).map((s, i) => `
      <div class="setting-row">
        <div class="setting-label">
          ${s.emoji} ${s.name}
          <small>เมื่อต้นไม้ในกระปุกมีเงินถึง ${fmt(s.threshold)} จะอยู่ระดับนี้ ปรับให้เหมาะกับเป้าหมายการออมของคุณ</small>
        </div>
        <input type="number" id="setup-thresh-${i+1}" value="${s.threshold}" min="0" style="width:140px">
      </div>`).join('');
  }
}

function saveInitialSetup() {
  const name = document.getElementById('setup-user-name-input').value.trim();
  const minBalance = parseFloat(document.getElementById('setup-min-balance-input').value);
  const stages = getStages();
  const vals = stages.slice(1).map((_, i) => parseFloat(document.getElementById(`setup-thresh-${i+1}`).value));

  if (isNaN(minBalance) || minBalance < 0) { showToast('⚠️ กรุณากรอกยอดแจ้งเตือนขั้นต่ำให้ถูกต้อง'); return; }
  if (vals.some(v => isNaN(v) || v < 0)) { showToast('⚠️ กรุณากรอกเกณฑ์ต้นไม้ให้ครบ'); return; }
  for (let i = 1; i < vals.length; i++) {
    if (vals[i] <= vals[i-1]) { showToast('⚠️ เกณฑ์ต้นไม้ต้องเรียงจากน้อยไปมาก'); return; }
  }

  data.userName = name;
  data.isNewUser = false;
  data.minBalance = minBalance;
  data.treeThresholds = [0, ...vals];
  save();
  renderAll();
  renderSettingsThresholds();
  showToast(name ? `✅ พร้อมแล้ว ${name}!` : '✅ ตั้งค่าครั้งแรกเรียบร้อย');
  showPage('dashboard');
}

// ===================== TRANSACTIONS =====================
function addIncome() {
  const name = document.getElementById('inc-name').value.trim();
  const amount = parseFloat(document.getElementById('inc-amount').value);
  const date = document.getElementById('inc-date').value || today();
  if (!name || isNaN(amount) || amount <= 0) { showToast('⚠️ กรุณากรอกข้อมูลให้ครบ'); return; }
  data.transactions.push({ id: uid(), type:'income', name, amount, date });
  save(); renderAll();
  document.getElementById('inc-name').value = '';
  document.getElementById('inc-amount').value = '';
  showToast(`✅ บันทึกรายรับ ${fmt(amount)} แล้ว`);
}

function addExpense() {
  const name = document.getElementById('exp-name').value.trim();
  const amount = parseFloat(document.getElementById('exp-amount').value);
  const date = document.getElementById('exp-date').value || today();
  if (!name || isNaN(amount) || amount <= 0) { showToast('⚠️ กรุณากรอกข้อมูลให้ครบ'); return; }
  data.transactions.push({ id: uid(), type:'expense', name, amount, date });
  save(); renderAll();
  document.getElementById('exp-name').value = '';
  document.getElementById('exp-amount').value = '';
  showToast(`✅ บันทึกรายจ่าย ${fmt(amount)} แล้ว`);
}

function addPlanned() {
  const name = document.getElementById('plan-name').value.trim();
  const amount = parseFloat(document.getElementById('plan-amount').value);
  const cat = document.getElementById('plan-cat').value;
  const due = document.getElementById('plan-due').value;
  const time = document.getElementById('plan-time').value || '23:59';
  if (!name || isNaN(amount) || amount <= 0) { showToast('⚠️ กรุณากรอกข้อมูลให้ครบ'); return; }
  if (!due) { showToast('⚠️ กรุณาเลือกวันครบกำหนด'); return; }
  data.planned.push({ id: uid(), name, amount, cat, due, time, paid: false });
  save(); renderAll();
  document.getElementById('plan-name').value = '';
  document.getElementById('plan-amount').value = '';
  document.getElementById('plan-due').value = '';
  document.getElementById('plan-time').value = '23:59';
  showToast(`📋 เพิ่มรายจ่ายที่วางแผน ${fmt(amount)} แล้ว`);
}

// ตรวจสอบและหักรายจ่ายอัตโนมัติที่ถึงกำหนด
function autoDeductPlanned() {
  const now = new Date();
  const t = today();
  const nowTime = now.getHours().toString().padStart(2,'0') + ':' + now.getMinutes().toString().padStart(2,'0');
  let deducted = [];
  data.planned.forEach(p => {
    if (p.paid) return;
    if (!p.due) return;
    const dueTime = p.time || '23:59';
    // ถึงกำหนดเมื่อ: วันผ่านไปแล้ว หรือ วันนี้และเวลาผ่านแล้ว
    const pastDay = p.due < t;
    const todayPastTime = p.due === t && nowTime >= dueTime;
    if (pastDay || todayPastTime) {
      data.transactions.push({ id: uid(), type: 'expense', name: `[อัตโนมัติ] ${p.name}`, amount: p.amount, date: p.due });
      p.paid = true;
      deducted.push(p.name);
    }
  });
  if (deducted.length) {
    save();
    setTimeout(() => showToast(`🔔 หักอัตโนมัติ ${deducted.length} รายการ: ${deducted.join(', ')}`, 4000), 300);
  }
}

function deletePlanned(id) {
  data.planned = data.planned.filter(p=>p.id!==id);
  save(); renderAll();
}

function deleteTx(id) {
  data.transactions = data.transactions.filter(t=>t.id!==id);
  save(); renderAll();
}

function clearAll() {
  showConfirm('คุณต้องการล้างรายการทั้งหมดใช่หรือไม่?', () => {
    data.transactions = [];
    save(); renderAll();
    showToast('🗑️ ล้างรายการแล้ว');
  });
}

function clearSavings() {
  showConfirm('คุณต้องการล้างประวัติกระปุกทั้งหมดใช่หรือไม่?', () => {
    data.savings = [];
    save(); renderAll();
    showToast('🗑️ ล้างประวัติกระปุกแล้ว');
  });
}

function renderTransactions() {
  // Planned
  const pl = document.getElementById('planned-list');
  if (!data.planned.length) {
    pl.innerHTML = '<div class="empty"><span class="empty-icon">📋</span>ยังไม่มีรายจ่ายที่วางแผน</div>';
  } else {
    const t = today();
    const now = new Date();
    const nowTime = now.getHours().toString().padStart(2,'0') + ':' + now.getMinutes().toString().padStart(2,'0');
    pl.innerHTML = data.planned.map(p => {
      const dueTime = p.time || '23:59';
      let statusBadge = '';
      if (p.paid) {
        statusBadge = `<span class="badge badge-red">✅ ตัดแล้ว</span>`;
      } else if (p.due < t) {
        statusBadge = `<span class="badge badge-red">⚠️ เลยกำหนด</span>`;
      } else if (p.due === t && nowTime >= dueTime) {
        statusBadge = `<span class="badge badge-red">⚠️ เลยเวลา</span>`;
      } else if (p.due === t) {
        const [h, m] = dueTime.split(':');
        const minsLeft = (parseInt(h)*60 + parseInt(m)) - (now.getHours()*60 + now.getMinutes());
        statusBadge = minsLeft <= 60
          ? `<span class="badge badge-gold">🔔 อีก ${minsLeft} นาที!</span>`
          : `<span class="badge badge-gold">🔔 วันนี้ ${dueTime} น.</span>`;
      } else {
        const daysLeft = Math.ceil((new Date(p.due) - new Date(t)) / 86400000);
        statusBadge = `<span class="badge badge-blue">⏳ อีก ${daysLeft} วัน</span>`;
      }
      return `
      <div class="list-item" style="${p.paid ? 'opacity:0.5' : ''}">
        <div class="list-dot dot-red"></div>
        <div class="list-name">
          ${p.name}
          <span class="badge badge-red" style="margin-left:4px">${p.cat}</span>
          ${statusBadge}
          <div style="font-size:12px; color:var(--text-muted); margin-top:2px">ครบกำหนด: ${p.due} เวลา ${dueTime} น.</div>
        </div>
        <div class="list-meta">
          <div class="list-amount stat-red">-${fmt(p.amount)}</div>
          <button class="btn btn-red" onclick="deletePlanned('${p.id}')">ลบ</button>
        </div>
      </div>`;
    }).join('');
  }

  // Tx history
  const txl = document.getElementById('tx-list');
  const sorted = [...data.transactions].sort((a,b)=>b.date.localeCompare(a.date));
  if (!sorted.length) {
    txl.innerHTML = '<div class="empty"><span class="empty-icon">📭</span>ยังไม่มีรายการ</div>';
  } else {
    txl.innerHTML = sorted.map(t => `
      <div class="list-item">
        <div class="list-dot ${t.type==='income'?'dot-green':'dot-red'}"></div>
        <div class="list-name">${t.name}</div>
        <div class="list-meta">
          <div class="list-amount ${t.type==='income'?'stat-green':'stat-red'}">${t.type==='income'?'+':'-'}${fmt(t.amount)}</div>
          <div style="display:flex;gap:6px;align-items:center">
            <span class="list-date">${t.date}</span>
            <button class="btn btn-red" onclick="deleteTx('${t.id}')">ลบ</button>
          </div>
        </div>
      </div>`).join('');
  }
}

// ===================== CHART =====================
let chartSelectedMonth = thisMonth();
let chartInstance = null;

function renderChart() {
  // Collect all months
  const months = [...new Set(data.transactions.map(t=>t.date.slice(0,7)))].sort();
  if (!months.includes(thisMonth())) months.push(thisMonth());
  months.sort();

  const mc = document.getElementById('month-chips');
  mc.innerHTML = months.map(m => {
    const [y, mo] = m.split('-');
    const label = `${parseInt(mo)}/${y.slice(2)}`;
    return `<button class="month-chip ${m===chartSelectedMonth?'active':''}" onclick="selectMonth('${m}')">${label}</button>`;
  }).join('');

  drawBarChart(months);
  updateChartStats();
}

function selectMonth(m) {
  chartSelectedMonth = m;
  renderChart();
}

function drawBarChart(months) {
  const canvas = document.getElementById('bar-chart');
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.parentElement.offsetWidth - 40;
  const H = 300;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';
  ctx.scale(dpr, dpr);

  const incomes  = months.map(m => calcMonth(m).income);
  const expenses = months.map(m => calcMonth(m).expense);
  const max = Math.max(...incomes, ...expenses, 1);

  ctx.clearRect(0, 0, W, H);

  const pad = { top: 20, bottom: 50, left: 50, right: 20 };
  const chartW = W - pad.left - pad.right;
  const chartH = H - pad.top - pad.bottom;
  const n = months.length;
  const groupW = chartW / n;
  const barW = Math.min(groupW * 0.3, 24);

  // Grid lines
  ctx.strokeStyle = '#2e3248';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = pad.top + chartH * (1 - i/4);
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(W - pad.right, y);
    ctx.stroke();
    ctx.fillStyle = '#7c82a0';
    ctx.font = '11px Space Grotesk, sans-serif';
    ctx.textAlign = 'right';
    const val = max * i / 4;
    ctx.fillText(val >= 1000 ? (val/1000).toFixed(0)+'k' : val.toFixed(0), pad.left-6, y+4);
  }

  months.forEach((m, i) => {
    const cx = pad.left + groupW * i + groupW/2;
    const ih = (incomes[i]/max) * chartH;
    const eh = (expenses[i]/max) * chartH;

    // Income bar
    ctx.fillStyle = m === chartSelectedMonth ? '#4ade80' : '#1a5c35';
    ctx.beginPath();
    ctx.roundRect(cx - barW - 3, pad.top + chartH - ih, barW, ih, [4,4,0,0]);
    ctx.fill();

    // Expense bar
    ctx.fillStyle = m === chartSelectedMonth ? '#f87171' : '#5c1a1a';
    ctx.beginPath();
    ctx.roundRect(cx + 3, pad.top + chartH - eh, barW, eh, [4,4,0,0]);
    ctx.fill();

    // Month label
    ctx.fillStyle = m === chartSelectedMonth ? '#e8eaf6' : '#7c82a0';
    ctx.font = `${m===chartSelectedMonth?'600':'400'} 11px Sarabun, sans-serif`;
    ctx.textAlign = 'center';
    const [y, mo] = m.split('-');
    ctx.fillText(`${parseInt(mo)}/${y.slice(2)}`, cx, H - 10);
  });

  // Legend
  ctx.fillStyle = '#4ade80';
  ctx.fillRect(pad.left, H-32, 10, 10);
  ctx.fillStyle = '#7c82a0';
  ctx.font = '11px Sarabun';
  ctx.textAlign = 'left';
  ctx.fillText('รายรับ', pad.left+14, H-23);
  ctx.fillStyle = '#f87171';
  ctx.fillRect(pad.left+70, H-32, 10, 10);
  ctx.fillStyle = '#7c82a0';
  ctx.fillText('รายจ่าย', pad.left+84, H-23);
}

function updateChartStats() {
  const { income, expense, net } = calcMonth(chartSelectedMonth);
  document.getElementById('chart-income').textContent = fmt(income);
  document.getElementById('chart-expense').textContent = fmt(expense);
  const netEl = document.getElementById('chart-net');
  netEl.textContent = fmt(net);
  netEl.className = 'stat-value ' + (net >= 0 ? 'stat-green' : 'stat-red');
}

// ===================== TREE =====================
function renderTree() {
  const piggy = data.piggyBank;
  const stages = getStages();
  const si = getStageIndex(piggy);
  const stage = stages[si];
  const nextStage = stages[si+1];

  document.getElementById('tree-emoji').textContent = stage.emoji;
  document.getElementById('tree-name').textContent = stage.name;
  document.getElementById('tree-desc').textContent = stage.desc;

  const prevThreshold = stage.threshold;
  const nextThreshold = nextStage ? nextStage.threshold : stage.threshold;
  const progress = nextStage
    ? Math.min(((piggy - prevThreshold) / (nextThreshold - prevThreshold)) * 100, 100)
    : 100;
  document.getElementById('tree-progress').style.width = progress + '%';
  document.getElementById('tree-piggy-display').textContent = fmt(piggy);
  document.getElementById('tree-next-amount').textContent = nextStage ? fmt(nextStage.threshold) : '🎉 MAX';

  // Stages row
  const sr = document.getElementById('stages-row');
  sr.innerHTML = stages.map((s, i) => `
    <div class="stage-pill ${i < si ? 'reached' : ''} ${i === si ? 'current' : ''}">
      <span>${s.emoji}</span>
      <span>${s.name}</span>
      <span style="font-size:10px; opacity:0.7">${fmt(s.threshold)}</span>
    </div>`).join('');

  // Saveable
  const balance = calcBalance();
  document.getElementById('saveable-amount').textContent = fmt(Math.max(0, balance));

  // Piggy total
  document.getElementById('piggy-total').textContent = fmt(piggy);
  const pt2 = document.getElementById('piggy-total-2');
  if (pt2) pt2.textContent = fmt(piggy);

  // Save log
  const sl = document.getElementById('save-log');
  const saves = [...data.savings].sort((a,b) => b.date.localeCompare(a.date));
  if (!saves.length) {
    sl.innerHTML = '<div class="empty"><span class="empty-icon">💰</span>ยังไม่มีการออม</div>';
  } else {
    sl.innerHTML = saves.map(s => `
      <div class="saving-log">
        <span class="drop-icon">${s.type === 'withdraw' ? '📤' : '💧'}</span>
        <span style="flex:1; color:${s.type==='withdraw'?'var(--red)':'inherit'}">${s.type==='withdraw'?'ถอน':'ออม'} ${fmt(s.amount)} - ${s.date}</span>
      </div>`).join('');
  }
}

function doSave() {
  const amount = parseFloat(document.getElementById('save-amount').value);
  const balance = calcBalance();
  if (isNaN(amount) || amount <= 0) { showToast('⚠️ กรุณากรอกจำนวนที่ถูกต้อง'); return; }
  if (amount > balance) { showToast(`⚠️ เงินไม่พอ! คงเหลือแค่ ${fmt(balance)}`); return; }

  const prevSI = getStageIndex(data.piggyBank);
  data.piggyBank += amount;
  data.savings.push({ id: uid(), amount, date: today(), type: 'save' });
  save();

  const newSI = getStageIndex(data.piggyBank);
  const stages = getStages();
  if (newSI > prevSI) {
    setTimeout(() => showToast(`🎉 ต้นไม้เติบโต! ขึ้นสู่ระดับ "${stages[newSI].name}"!`, 3500), 400);
  } else {
    showToast(`💧 รดน้ำสำเร็จ! ออม ${fmt(amount)} แล้ว`);
  }

  document.getElementById('save-amount').value = '';
  renderAll();
}

function doWithdraw() {
  const amount = parseFloat(document.getElementById('withdraw-amount').value);
  if (isNaN(amount) || amount <= 0) { showToast('⚠️ กรุณากรอกจำนวนที่ถูกต้อง'); return; }
  if (amount > data.piggyBank) { showToast(`⚠️ เงินในกระปุกมีแค่ ${fmt(data.piggyBank)}`); return; }

  const prevSI = getStageIndex(data.piggyBank);
  data.piggyBank -= amount;
  data.savings.push({ id: uid(), amount, date: today(), type: 'withdraw' });
  save();

  const newSI = getStageIndex(data.piggyBank);
  const stages = getStages();
  if (newSI < prevSI) {
    setTimeout(() => showToast(`📉 ต้นไม้หดลง... กลับสู่ระดับ "${stages[newSI].name}"`, 3500), 400);
  } else {
    showToast(`📤 ถอนเงิน ${fmt(amount)} จากกระปุกแล้ว`);
  }

  document.getElementById('withdraw-amount').value = '';
  renderAll();
}

function saveThresholds() {
  const stages = getStages();
  const vals = stages.slice(1).map((_, i) => parseFloat(document.getElementById(`thresh-${i+1}`).value));
  if (vals.some(v => isNaN(v) || v < 0)) { showToast('⚠️ กรุณากรอกตัวเลขให้ครบ'); return; }
  // ตรวจสอบว่าเรียงลำดับถูกต้อง
  for (let i = 1; i < vals.length; i++) {
    if (vals[i] <= vals[i-1]) { showToast(`⚠️ ยอด "${stages[i+1].name}" ต้องมากกว่า "${stages[i].name}"`); return; }
  }
  data.treeThresholds = [0, ...vals];
  save(); renderAll();
  showToast('✅ บันทึกเกณฑ์อัพเลเวลแล้ว');
}

// ===================== SIDEBAR =====================
function openSidebar() {
  document.getElementById('sidebar').classList.add('open');
  document.getElementById('sidebar-overlay').classList.add('open');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').classList.remove('open');
}

// ===================== PAGES =====================
function showPage(name) {
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.sidebar-item').forEach(t=>t.classList.remove('active'));

  document.getElementById('page-'+name).classList.add('active');

  const navPages = ['dashboard','transactions','chart','tree'];
  const navIdx = navPages.indexOf(name);
  if (navIdx >= 0) {
    document.querySelectorAll('.nav-tab')[navIdx].classList.add('active');
  }

  const sitem = document.getElementById('sitem-'+name);
  if (sitem) sitem.classList.add('active');

  if (name==='chart') setTimeout(renderChart, 50);
  if (name==='settings') renderSettingsThresholds();
  if (name==='intro' || name==='first-setup') renderNewUserPages();
}

function renderAll() {
  renderDashboard();
  renderTransactions();
  renderTree();
  if (document.getElementById('page-chart').classList.contains('active')) renderChart();
}

// ===================== INIT =====================
document.getElementById('inc-date').value = today();
document.getElementById('exp-date').value = today();
document.getElementById('plan-due').value = today();
autoDeductPlanned();
renderAll();
renderNewUserPages();
if (data.isNewUser) showPage('intro');
// ตรวจสอบทุก 1 นาที กรณีแอปเปิดค้างไว้
setInterval(() => { autoDeductPlanned(); renderAll(); }, 60000);
window.addEventListener('resize', () => {
  if (document.getElementById('page-chart').classList.contains('active')) renderChart();
});
