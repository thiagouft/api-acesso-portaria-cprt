const API_URL = '/api';
let token = localStorage.getItem('cprt_token');
let userProfile = null;
let isLoggingOut = false;

// Auth Check on load
window.onload = () => {
  if (token) {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      userProfile = payload.perfil;
      document.getElementById('user-name-display').innerText = payload.nome || payload.login;
      showScreen('dashboard-screen');
      loadInitialData();
    } catch(e) {
      logout();
    }
  } else {
    showScreen('login-screen');
  }
};

// UI Navigation
document.querySelectorAll('.nav-btn').forEach(btn => {
  if(btn.id === 'logout-btn') return;
  btn.addEventListener('click', (e) => {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    document.getElementById(btn.dataset.target).classList.add('active');
    
    document.getElementById('current-page-title').innerText = btn.innerText;

    // Load data based on panel
    if (btn.dataset.target === 'panel-users') loadUsers();
    else if (btn.dataset.target === 'panel-portarias') loadPortarias();
    else if (btn.dataset.target === 'panel-leituras') loadLeituras();
    else if (btn.dataset.target === 'panel-pessoas') loadPessoas();
    else if (btn.dataset.target === 'panel-veiculos') loadVeiculos();
    else if (btn.dataset.target === 'panel-leituras-veiculos') loadLeiturasVeiculo();
    else if (btn.dataset.target === 'panel-apk') loadAPKInfo();
  });
});

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

// Login
document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const loginInput = document.getElementById('login-input').value;
  const passwordInput = document.getElementById('password-input').value;

  try {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login: loginInput, senha: passwordInput })
    });
    const data = await res.json();
    if (res.ok) {
      if (data.usuario.perfil !== 'MASTER') {
        document.getElementById('login-error').innerText = 'Acesso apenas para administradores MASTER.';
        return;
      }
      token = data.token;
      localStorage.setItem('cprt_token', token);
      window.location.reload();
    } else {
      document.getElementById('login-error').innerText = data.error || 'Erro no login';
    }
  } catch (err) {
    document.getElementById('login-error').innerText = 'Erro ao conectar no servidor.';
  }
});

// Logout
document.getElementById('logout-btn').addEventListener('click', logout);
function logout() {
  isLoggingOut = true;
  localStorage.removeItem('cprt_token');
  window.location.reload();
}

// Modals
function openModal(id) { document.getElementById(id).classList.add('active'); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); }

// Fetch Wrapper with Auth
async function fetchAuth(url, options = {}) {
  if (isLoggingOut) {
    return new Response(JSON.stringify({ error: 'Sessão expirada' }), { status: 401 });
  }

  const headers = options.headers || {};
  if (!options.isFormData && options.body) {
    headers['Content-Type'] = 'application/json';
  }
  headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${url}`, { ...options, headers });
  if (res.status === 401 || res.status === 403) {
    if (!isLoggingOut) {
      isLoggingOut = true;
      alert('Sessão expirada ou acesso negado');
      logout();
    }
  }
  return res;
}

// Load Stats
async function loadInitialData() {
  try {
    const resU = await fetchAuth('/users');
    if(resU.ok) {
      const users = await resU.json();
      document.getElementById('stat-users').innerText = users.length;
    }
    const resP = await fetchAuth('/portarias');
    if(resP.ok) {
      const ports = await resP.json();
      document.getElementById('stat-portarias').innerText = ports.length;
    }
    const resA = await fetchAuth('/pessoas');
    if(resA.ok) {
      const ac = await resA.json();
      document.getElementById('stat-pessoas').innerText = ac.length;
    }

    // Carregar última data de sincronização no painel
    const resSync = await fetchAuth('/pessoas/last-sync');
    if (resSync.ok) {
      const data = await resSync.json();
      const display = document.getElementById('last-sync-time-display');
      if (display) {
        if (data.lastSync) {
          const date = new Date(data.lastSync);
          display.innerText = `Última Atualização: ${date.toLocaleString()}`;
          display.style.color = '#36BF8D';
          display.style.background = 'rgba(54, 191, 141, 0.15)';
          display.style.borderColor = 'rgba(54, 191, 141, 0.3)';
        } else {
          display.innerText = 'Última Atualização: Nunca Realizada';
          display.style.color = '#E74C3C';
          display.style.background = 'rgba(231, 76, 60, 0.15)';
          display.style.borderColor = 'rgba(231, 76, 60, 0.3)';
        }
      }
    }
  } catch(e) { console.log(e); }
}

// Users
async function loadUsers() {
  const res = await fetchAuth('/users');
  const users = await res.json();
  const tbody = document.querySelector('#users-table tbody');
  tbody.innerHTML = users.map(u => `
    <tr>
      <td>${u.nome}</td>
      <td>${u.login}</td>
      <td>${u.email}</td>
      <td><span class="badge ${u.perfil === 'MASTER' ? 'success' : ''}">${u.perfil}</span></td>
      <td><button class="btn secondary-btn" onclick="deleteUser(${u.id})"><i class="fa-solid fa-trash"></i></button></td>
    </tr>
  `).join('');
}

document.getElementById('create-user-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const body = {
    nome: document.getElementById('u-nome').value,
    email: document.getElementById('u-email').value,
    login: document.getElementById('u-login').value,
    cpf: document.getElementById('u-cpf').value,
    senha: document.getElementById('u-senha').value,
    perfil: document.getElementById('u-perfil').value,
  };
  const res = await fetchAuth('/users', { method: 'POST', body: JSON.stringify(body) });
  if(res.ok) {
    closeModal('user-modal');
    loadUsers();
    document.getElementById('create-user-form').reset();
  } else {
    alert('Erro ao criar usuário');
  }
});

async function deleteUser(id) {
  if(!confirm('Deseja excluir este usuário?')) return;
  const res = await fetchAuth(`/users/${id}`, { method: 'DELETE' });
  if(res.ok) loadUsers();
  else alert('Erro ao excluir');
}

// Portarias
async function loadPortarias() {
  const res = await fetchAuth('/portarias');
  const ports = await res.json();
  const tbody = document.querySelector('#portarias-table tbody');
  tbody.innerHTML = ports.map(p => `
    <tr>
      <td>${p.id}</td>
      <td>${p.descricao}</td>
      <td><button class="btn secondary-btn" onclick="deletePortaria(${p.id})"><i class="fa-solid fa-trash"></i></button></td>
    </tr>
  `).join('');
}

document.getElementById('create-portaria-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const body = { descricao: document.getElementById('p-descricao').value };
  const res = await fetchAuth('/portarias', { method: 'POST', body: JSON.stringify(body) });
  if(res.ok) {
    closeModal('portaria-modal');
    loadPortarias();
    document.getElementById('create-portaria-form').reset();
  } else alert('Erro');
});

async function deletePortaria(id) {
  if(!confirm('Excluir portaria?')) return;
  const res = await fetchAuth(`/portarias/${id}`, { method: 'DELETE' });
  if(res.ok) loadPortarias();
  else alert('Erro ao excluir');
}

// Upload & Auto Sync XLS
document.getElementById('file-input').addEventListener('change', (e) => {
  const fileName = e.target.files[0] ? e.target.files[0].name : 'Nenhum arquivo selecionado';
  document.getElementById('selected-file-name').innerText = fileName;
});

document.getElementById('upload-btn').addEventListener('click', async () => {
  const fileInput = document.getElementById('file-input');
  const statusDiv = document.getElementById('upload-status');
  if(!fileInput.files[0]) return alert('Selecione um arquivo.');
  
  const formData = new FormData();
  formData.append('file', fileInput.files[0]);

  statusDiv.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processando arquivo manual...';
  
  try {
    const res = await fetchAuth('/pessoas/upload', {
      method: 'POST',
      body: formData,
      isFormData: true // prevents setting content-type manually so browser sets multipart boundary
    });
    const data = await res.json();
    if(res.ok) {
      statusDiv.innerHTML = `<span style="color:var(--success);"><i class="fa-solid fa-check"></i> ${data.message}</span>`;
      loadInitialData();
    } else {
      statusDiv.innerHTML = `<span style="color:var(--danger);"><i class="fa-solid fa-xmark"></i> ${data.error}</span>`;
    }
  } catch(e) {
    statusDiv.innerHTML = `<span style="color:var(--danger);">Erro de conexão.</span>`;
  }
});

document.getElementById('auto-sync-btn').addEventListener('click', async () => {
  const statusDiv = document.getElementById('upload-status');
  statusDiv.innerHTML = '<i class="fa-solid fa-arrows-rotate fa-spin"></i> Conectando ao portal Dimep, gerando relatório e sincronizando os cadastros... Por favor, aguarde cerca de 15 a 45 segundos.';
  
  try {
    const res = await fetchAuth('/pessoas/auto-sync', {
      method: 'POST'
    });
    const data = await res.json();
    if(res.ok) {
      statusDiv.innerHTML = `<span style="color:var(--success);"><i class="fa-solid fa-check"></i> ${data.message}</span>`;
      loadInitialData();
    } else {
      statusDiv.innerHTML = `<span style="color:var(--danger);"><i class="fa-solid fa-xmark"></i> ${data.error || 'Erro na sincronização automática.'}</span>`;
    }
  } catch(e) {
    statusDiv.innerHTML = `<span style="color:var(--danger);">Erro na conexão ou timeout ao tentar sincronizar automaticamente.</span>`;
  }
});

// Helper universal para paginação numerada (ex: 1 ... 3 4 [5] 6 7 ... 154)
function renderPaginationControls({ containerId, totalCountId, currentPage, totalRecords, perPage, goToPageFn }) {
  const totalEl = document.getElementById(totalCountId);
  const container = document.getElementById(containerId);
  
  if (totalEl) {
    totalEl.innerText = `Total de registros: ${totalRecords.toLocaleString('pt-BR')}`;
  }

  if (!container) return;

  const totalPages = Math.ceil(totalRecords / perPage) || 1;
  if (currentPage < 1) currentPage = 1;
  if (currentPage > totalPages) currentPage = totalPages;

  // Gerar números de página com reticências (...)
  const pages = [];
  const delta = 2; // Quantidade de páginas ao redor da atual

  for (let i = 1; i <= totalPages; i++) {
    if (
      i === 1 ||
      i === totalPages ||
      (i >= currentPage - delta && i <= currentPage + delta)
    ) {
      pages.push(i);
    } else if (pages[pages.length - 1] !== '...') {
      pages.push('...');
    }
  }

  let html = `<div class="pagination-wrapper">`;

  // Botão Anterior
  const prevDisabled = currentPage <= 1 ? 'disabled' : '';
  html += `<button class="page-btn prev-next-btn" ${prevDisabled} onclick="${goToPageFn}(${currentPage - 1})">Anterior</button>`;

  // Botões de Páginas Numeradas
  pages.forEach(p => {
    if (p === '...') {
      html += `<span class="page-ellipsis">...</span>`;
    } else {
      const activeClass = p === currentPage ? 'active' : '';
      html += `<button class="page-btn number-btn ${activeClass}" onclick="${goToPageFn}(${p})">${p}</button>`;
    }
  });

  // Botão Próximo
  const nextDisabled = currentPage >= totalPages ? 'disabled' : '';
  html += `<button class="page-btn prev-next-btn" ${nextDisabled} onclick="${goToPageFn}(${currentPage + 1})">Próximo</button>`;

  html += `</div>`;
  container.innerHTML = html;
}

// Pessoas
let globalPessoas = [];
let currentPessoasData = [];
let currentPessoasPage = 1;
const PESSOAS_PER_PAGE = 20;

async function loadPessoas(forceRefresh = false) {
  const tbody = document.querySelector('#pessoas-table tbody');
  
  if (globalPessoas.length === 0 || forceRefresh) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 30px;"><i class="fa-solid fa-spinner fa-spin" style="font-size: 1.5rem; margin-right: 10px; color: var(--primary-color);"></i> Carregando pessoas cadastradas...</td></tr>';
    const res = await fetchAuth('/pessoas?incluirInativos=true');
    globalPessoas = await res.json();
  }

  const field = document.getElementById('search-field').value;
  let query = document.getElementById('search-input').value.trim().toLowerCase();
  const statusFilter = document.getElementById('search-status').value;
  const ativoFilter = document.getElementById('search-ativo').value;

  if (field === 'matricula') {
    query = query.replace(/^0+/, '');
  }

  let filtered = globalPessoas;

  if (query) {
    filtered = filtered.filter(p => {
      let val = p[field] ? p[field].toString().toLowerCase().trim() : '';
      if (field === 'matricula') {
        val = val.replace(/^0+/, '');
        return val === query;
      }
      return val.includes(query);
    });
  }

  if (statusFilter !== 'todas') {
    filtered = filtered.filter(p => p.situacao.toString() === statusFilter);
  }

  if (ativoFilter === 'ativos') {
    filtered = filtered.filter(p => p.ativo === true);
  } else if (ativoFilter === 'inativos') {
    filtered = filtered.filter(p => p.ativo === false);
  }

  currentPessoasData = filtered;
  currentPessoasPage = 1;
  renderPessoasPage();
}

function renderPessoasPage() {
  const totalRecords = currentPessoasData ? currentPessoasData.length : 0;
  const totalPages = Math.ceil(totalRecords / PESSOAS_PER_PAGE) || 1;
  if (currentPessoasPage < 1) currentPessoasPage = 1;
  if (currentPessoasPage > totalPages) currentPessoasPage = totalPages;

  renderPaginationControls({
    containerId: 'pessoas-pagination',
    totalCountId: 'pessoas-total-count',
    currentPage: currentPessoasPage,
    totalRecords: totalRecords,
    perPage: PESSOAS_PER_PAGE,
    goToPageFn: 'goToPessoasPage'
  });

  const tbody = document.querySelector('#pessoas-table tbody');
  if (!currentPessoasData || totalRecords === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">Nenhuma pessoa encontrada.</td></tr>';
    return;
  }

  const startIndex = (currentPessoasPage - 1) * PESSOAS_PER_PAGE;
  const pageItems = currentPessoasData.slice(startIndex, startIndex + PESSOAS_PER_PAGE);

  tbody.innerHTML = pageItems.map(a => `
    <tr>
      <td>${a.matricula}</td>
      <td>${a.nome}</td>
      <td><span class="badge ${a.situacao === 1 ? 'success' : 'danger'}">${a.situacao === 1 ? 'Permitido' : 'Bloqueado'}</span></td>
      <td><span class="badge ${a.ativo ? 'success' : 'secondary'}">${a.ativo ? 'Ativo' : 'Inativo'}</span></td>
      <td>${a.credenciais || '-'}</td>
      <td>${a.observacao || '-'}</td>
    </tr>
  `).join('');
}

function goToPessoasPage(page) {
  currentPessoasPage = page;
  renderPessoasPage();
}

document.getElementById('search-btn').addEventListener('click', () => loadPessoas(false));
document.getElementById('search-input').addEventListener('keyup', (e) => {
  if (e.key === 'Enter') loadPessoas(false);
});

// Leituras RFID
let currentLeiturasData = [];
let currentLeiturasPage = 1;
const LEITURAS_PER_PAGE = 20;

async function loadLeituras() {
  const tbody = document.querySelector('#leituras-table tbody');
  tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 30px;"><i class="fa-solid fa-spinner fa-spin" style="font-size: 1.5rem; margin-right: 10px; color: var(--primary-color);"></i> Carregando leituras RFID...</td></tr>';

  const dtInicial = document.getElementById('leituras-data-inicial').value;
  const dtFinal = document.getElementById('leituras-data-final').value;
  const horaInicial = document.getElementById('leituras-hora-inicial').value;
  const horaFinal = document.getElementById('leituras-hora-final').value;
  const matricula = document.getElementById('leituras-matricula').value;
  const nome = document.getElementById('leituras-nome').value;

  const params = new URLSearchParams();
  if (dtInicial) params.append('dataInicial', dtInicial);
  if (dtFinal) params.append('dataFinal', dtFinal);
  if (horaInicial) params.append('horaInicial', horaInicial);
  if (horaFinal) params.append('horaFinal', horaFinal);
  if (matricula) params.append('matricula', matricula);
  if (nome) params.append('nome', nome);

  try {
    const res = await fetchAuth(`/sync?${params.toString()}`);
    currentLeiturasData = await res.json();
    currentLeiturasPage = 1;
    renderLeiturasPage();
  } catch (err) {
    console.error(err);
    tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--danger);">Erro ao carregar leituras.</td></tr>';
  }
}

function renderLeiturasPage() {
  const totalRecords = currentLeiturasData ? currentLeiturasData.length : 0;
  const totalPages = Math.ceil(totalRecords / LEITURAS_PER_PAGE) || 1;
  if (currentLeiturasPage < 1) currentLeiturasPage = 1;
  if (currentLeiturasPage > totalPages) currentLeiturasPage = totalPages;

  renderPaginationControls({
    containerId: 'leituras-pagination',
    totalCountId: 'leituras-total-count',
    currentPage: currentLeiturasPage,
    totalRecords: totalRecords,
    perPage: LEITURAS_PER_PAGE,
    goToPageFn: 'goToLeiturasPage'
  });

  const tbody = document.querySelector('#leituras-table tbody');
  if (!currentLeiturasData || totalRecords === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">Nenhuma leitura encontrada para os filtros aplicados.</td></tr>';
    return;
  }

  const isHidden = (colIndex) => {
    const cb = document.querySelector(`#column-menu input[value="${colIndex}"]`);
    return cb && !cb.checked;
  };

  const startIndex = (currentLeiturasPage - 1) * LEITURAS_PER_PAGE;
  const pageItems = currentLeiturasData.slice(startIndex, startIndex + LEITURAS_PER_PAGE);

  tbody.innerHTML = pageItems.map(l => `
    <tr>
      <td data-col="0" class="${isHidden(0) ? 'hidden-col' : ''}">${l.pessoa_matricula || '-'}</td>
      <td data-col="1" class="${isHidden(1) ? 'hidden-col' : ''}">${l.pessoa_nome || 'N/A'}</td>
      <td data-col="2" class="${isHidden(2) ? 'hidden-col' : ''}">${l.credencial}</td>
      <td data-col="3" class="${isHidden(3) ? 'hidden-col' : ''}">${new Date(l.data_hora_leitura).toLocaleString()}</td>
      <td data-col="4" class="${isHidden(4) ? 'hidden-col' : ''}">${l.portaria?.descricao || l.id_portaria}</td>
      <td data-col="5" class="${isHidden(5) ? 'hidden-col' : ''}"><span class="badge ${l.situacao === 1 ? 'success' : 'danger'}">${l.situacao === 1 ? 'Permitido' : 'Bloqueado'}</span></td>
      <td data-col="6" class="${isHidden(6) ? 'hidden-col' : ''}">${l.id_celular}</td>
    </tr>
  `).join('');
}

function goToLeiturasPage(page) {
  currentLeiturasPage = page;
  renderLeiturasPage();
}

function clearLeiturasFilters() {
  document.getElementById('leituras-data-inicial').value = '';
  document.getElementById('leituras-data-final').value = '';
  document.getElementById('leituras-hora-inicial').value = '';
  document.getElementById('leituras-hora-final').value = '';
  document.getElementById('leituras-matricula').value = '';
  document.getElementById('leituras-nome').value = '';
  loadLeituras();
}

// Columns Toggle
function toggleColumnMenu() {
  const menu = document.getElementById('column-menu');
  menu.classList.toggle('hidden');
}

function toggleColumn(colIndex) {
  const checkbox = document.querySelector(`#column-menu input[value="${colIndex}"]`);
  const isChecked = checkbox.checked;
  const th = document.querySelector(`th[data-col="${colIndex}"]`);
  const tds = document.querySelectorAll(`td[data-col="${colIndex}"]`);
  
  if (isChecked) {
    if (th) th.classList.remove('hidden-col');
    tds.forEach(td => td.classList.remove('hidden-col'));
  } else {
    if (th) th.classList.add('hidden-col');
    tds.forEach(td => td.classList.add('hidden-col'));
  }
}

// Fechar menu ao clicar fora
document.addEventListener('click', (e) => {
  const menu = document.getElementById('column-menu');
  const btn = document.querySelector('button[onclick="toggleColumnMenu()"]');
  if (menu && btn && !menu.classList.contains('hidden') && !menu.contains(e.target) && !btn.contains(e.target)) {
    menu.classList.add('hidden');
  }
});

// Export Excel
function exportLeiturasExcel() {
  if (!currentLeiturasData || currentLeiturasData.length === 0) return;

  const isHidden = (colIndex) => {
    const cb = document.querySelector(`#column-menu input[value="${colIndex}"]`);
    return cb && !cb.checked;
  };

  const columnsMap = [
    { index: 0, title: 'Matrícula', key: l => l.pessoa_matricula || '-' },
    { index: 1, title: 'Nome', key: l => l.pessoa_nome || 'N/A' },
    { index: 2, title: 'Credencial', key: l => l.credencial },
    { index: 3, title: 'Data/Hora Leitura', key: l => new Date(l.data_hora_leitura).toLocaleString() },
    { index: 4, title: 'Portaria', key: l => l.portaria?.descricao || l.id_portaria },
    { index: 5, title: 'Situação', key: l => l.situacao === 1 ? 'Permitido' : 'Bloqueado' },
    { index: 6, title: 'ID Celular', key: l => l.id_celular }
  ];

  const activeColumns = columnsMap.filter(col => !isHidden(col.index));

  const exportData = currentLeiturasData.map(l => {
    const row = {};
    activeColumns.forEach(col => {
      row[col.title] = col.key(l);
    });
    return row;
  });

  const ws = XLSX.utils.json_to_sheet(exportData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Leituras RFID");
  XLSX.writeFile(wb, 'leituras_rfid.xlsx');
}

// Export PDF
function exportLeiturasPDF() {
  if (!currentLeiturasData || currentLeiturasData.length === 0) return;
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF('l', 'pt', 'a4');

  const isHidden = (colIndex) => {
    const cb = document.querySelector(`#column-menu input[value="${colIndex}"]`);
    return cb && !cb.checked;
  };

  const columnsMap = [
    { index: 0, title: 'Matrícula', key: l => l.pessoa_matricula || '-' },
    { index: 1, title: 'Nome', key: l => l.pessoa_nome || 'N/A' },
    { index: 2, title: 'Credencial', key: l => l.credencial },
    { index: 3, title: 'Data/Hora Leitura', key: l => new Date(l.data_hora_leitura).toLocaleString() },
    { index: 4, title: 'Portaria', key: l => l.portaria?.descricao || l.id_portaria },
    { index: 5, title: 'Situação', key: l => l.situacao === 1 ? 'Permitido' : 'Bloqueado' },
    { index: 6, title: 'ID Celular', key: l => l.id_celular }
  ];

  const activeColumns = columnsMap.filter(col => !isHidden(col.index));
  const headers = activeColumns.map(col => col.title);
  const data = currentLeiturasData.map(l => activeColumns.map(col => col.key(l)));

  doc.text("Relatório de Leituras RFID", 40, 40);
  
  doc.autoTable({
    head: [headers],
    body: data,
    startY: 50,
    theme: 'grid',
    styles: { fontSize: 8 },
    headStyles: { fillColor: [59, 130, 246] }
  });

  doc.save('leituras_rfid.pdf');
}

// Veiculos Cadastrados
let currentVeiculosCadastroData = [];
let currentVeiculosCadastroPage = 1;
const VEICULOS_CADASTRO_PER_PAGE = 20;

async function loadVeiculos() {
  const tbody = document.querySelector('#veiculos-table tbody');
  tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 30px;"><i class="fa-solid fa-spinner fa-spin" style="font-size: 1.5rem; margin-right: 10px; color: var(--primary-color);"></i> Carregando veículos...</td></tr>';
  
  try {
    const res = await fetchAuth('/veiculos');
    currentVeiculosCadastroData = await res.json();
    currentVeiculosCadastroPage = 1;
    renderVeiculosCadastroPage();
  } catch (err) {
    console.error(err);
    tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--danger);">Erro ao carregar veículos.</td></tr>';
  }
}

function renderVeiculosCadastroPage() {
  const totalRecords = currentVeiculosCadastroData ? currentVeiculosCadastroData.length : 0;
  const totalPages = Math.ceil(totalRecords / VEICULOS_CADASTRO_PER_PAGE) || 1;
  if (currentVeiculosCadastroPage < 1) currentVeiculosCadastroPage = 1;
  if (currentVeiculosCadastroPage > totalPages) currentVeiculosCadastroPage = totalPages;

  renderPaginationControls({
    containerId: 'veiculos-pagination',
    totalCountId: 'veiculos-total-count',
    currentPage: currentVeiculosCadastroPage,
    totalRecords: totalRecords,
    perPage: VEICULOS_CADASTRO_PER_PAGE,
    goToPageFn: 'goToVeiculosCadastroPage'
  });

  const tbody = document.querySelector('#veiculos-table tbody');
  if (!currentVeiculosCadastroData || totalRecords === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align: center;">Nenhum veículo cadastrado.</td></tr>';
    return;
  }

  const startIndex = (currentVeiculosCadastroPage - 1) * VEICULOS_CADASTRO_PER_PAGE;
  const pageItems = currentVeiculosCadastroData.slice(startIndex, startIndex + VEICULOS_CADASTRO_PER_PAGE);

  tbody.innerHTML = pageItems.map(v => `
    <tr>
      <td>${v.id}</td>
      <td>${v.placa}</td>
      <td>${v.descricao}</td>
      <td><button class="btn secondary-btn" onclick="deleteVeiculo(${v.id})"><i class="fa-solid fa-trash"></i></button></td>
    </tr>
  `).join('');
}

function goToVeiculosCadastroPage(page) {
  currentVeiculosCadastroPage = page;
  renderVeiculosCadastroPage();
}

document.getElementById('create-veiculo-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const placaInput = document.getElementById('v-placa').value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const body = { 
    placa: placaInput,
    descricao: document.getElementById('v-descricao').value 
  };
  const res = await fetchAuth('/veiculos', { method: 'POST', body: JSON.stringify(body) });
  if(res.ok) {
    closeModal('veiculo-modal');
    loadVeiculos();
    document.getElementById('create-veiculo-form').reset();
  } else {
    const err = await res.json();
    alert('Erro: ' + (err.error || 'Não foi possível salvar o veículo.'));
  }
});

async function deleteVeiculo(id) {
  if(!confirm('Excluir veículo?')) return;
  const res = await fetchAuth(`/veiculos/${id}`, { method: 'DELETE' });
  if(res.ok) loadVeiculos();
  else alert('Erro ao excluir veículo');
}

// Leituras Veículo
let currentVeiculosData = [];
let currentVeiculosPage = 1;
const VEICULOS_PER_PAGE = 20;

async function loadLeiturasVeiculo() {
  const tbody = document.querySelector('#leituras-v-table tbody');
  tbody.innerHTML = '<tr><td colspan="11" style="text-align: center; padding: 30px;"><i class="fa-solid fa-spinner fa-spin" style="font-size: 1.5rem; margin-right: 10px; color: var(--primary-color);"></i> Carregando leituras de veículos...</td></tr>';

  const dtInicial = document.getElementById('leituras-v-data-inicial').value;
  const dtFinal = document.getElementById('leituras-v-data-final').value;
  const horaInicial = document.getElementById('leituras-v-hora-inicial').value;
  const horaFinal = document.getElementById('leituras-v-hora-final').value;
  const placa = document.getElementById('leituras-v-placa').value;
  const matricula = document.getElementById('leituras-v-matricula').value;
  const nome = document.getElementById('leituras-v-nome').value;

  const params = new URLSearchParams();
  if (dtInicial) params.append('dataInicial', dtInicial);
  if (dtFinal) params.append('dataFinal', dtFinal);
  if (horaInicial) params.append('horaInicial', horaInicial);
  if (horaFinal) params.append('horaFinal', horaFinal);
  if (placa) params.append('placa', placa);
  if (matricula) params.append('matricula', matricula);
  if (nome) params.append('nome', nome);

  try {
    const res = await fetchAuth(`/sync/leituras-veiculo?${params.toString()}`);
    currentVeiculosData = await res.json();
    currentVeiculosPage = 1;
    renderVeiculosPage();
  } catch (err) {
    console.error(err);
    tbody.innerHTML = '<tr><td colspan="11" style="text-align: center; color: var(--danger);">Erro ao carregar leituras.</td></tr>';
  }
}

function renderVeiculosPage() {
  const totalRecords = currentVeiculosData ? currentVeiculosData.length : 0;
  const totalPages = Math.ceil(totalRecords / VEICULOS_PER_PAGE) || 1;

  if (currentVeiculosPage < 1) currentVeiculosPage = 1;
  if (currentVeiculosPage > totalPages) currentVeiculosPage = totalPages;

  renderPaginationControls({
    containerId: 'leituras-v-pagination',
    totalCountId: 'leituras-v-total-count',
    currentPage: currentVeiculosPage,
    totalRecords: totalRecords,
    perPage: VEICULOS_PER_PAGE,
    goToPageFn: 'goToVeiculosPage'
  });

  const tbody = document.querySelector('#leituras-v-table tbody');
  if (!currentVeiculosData || totalRecords === 0) {
    tbody.innerHTML = '<tr><td colspan="11" style="text-align: center;">Nenhuma leitura encontrada.</td></tr>';
    return;
  }

  const isHiddenVeiculo = (colIndex) => {
    const cb = document.querySelector(`#column-menu-veiculos input[value="${colIndex}"]`);
    return cb && !cb.checked;
  };

  const startIndex = (currentVeiculosPage - 1) * VEICULOS_PER_PAGE;
  const pageItems = currentVeiculosData.slice(startIndex, startIndex + VEICULOS_PER_PAGE);

  tbody.innerHTML = pageItems.map(l => `
    <tr>
      <td data-col="0" class="${isHiddenVeiculo(0) ? 'hidden-col' : ''}">${l.placa}</td>
      <td data-col="1" class="${isHiddenVeiculo(1) ? 'hidden-col' : ''}">${l.descricao_veiculo || '-'}</td>
      <td data-col="2" class="${isHiddenVeiculo(2) ? 'hidden-col' : ''}">${l.portaria}</td>
      <td data-col="3" class="${isHiddenVeiculo(3) ? 'hidden-col' : ''}"><span class="badge ${l.sentido === 'ENTRADA' ? 'success' : l.sentido === 'SAIDA' ? 'danger' : 'secondary'}">${l.sentido}</span></td>
      <td data-col="4" class="${isHiddenVeiculo(4) ? 'hidden-col' : ''}">${l.matricula_condutor || '-'}</td>
      <td data-col="5" class="${isHiddenVeiculo(5) ? 'hidden-col' : ''}">${l.nome_condutor || '-'}</td>
      <td data-col="6" class="${isHiddenVeiculo(6) ? 'hidden-col' : ''}">${l.credencial_condutor || '-'}</td>
      <td data-col="7" class="${isHiddenVeiculo(7) ? 'hidden-col' : ''}">${new Date(l.data_hora_leitura).toLocaleString()}</td>
      <td data-col="8" class="${isHiddenVeiculo(8) ? 'hidden-col' : ''}">${l.is_condutor ? 'Sim' : 'Não'}</td>
      <td data-col="9" class="${isHiddenVeiculo(9) ? 'hidden-col' : ''}"><span class="badge ${l.situacao === 1 ? 'success' : 'danger'}">${l.situacao === 1 ? 'Permitido' : 'Bloqueado'}</span></td>
      <td data-col="10" class="${isHiddenVeiculo(10) ? 'hidden-col' : ''}">${l.id_celular}</td>
    </tr>
  `).join('');
}

function goToVeiculosPage(page) {
  currentVeiculosPage = page;
  renderVeiculosPage();
}

function toggleColumnMenuVeiculos() {
  const menu = document.getElementById('column-menu-veiculos');
  menu.classList.toggle('hidden');
}

function toggleColumnVeiculos(colIndex) {
  const checkbox = document.querySelector(`#column-menu-veiculos input[value="${colIndex}"]`);
  const isChecked = checkbox.checked;
  const th = document.querySelector(`#leituras-v-table th[data-col="${colIndex}"]`);
  const tds = document.querySelectorAll(`#leituras-v-table td[data-col="${colIndex}"]`);
  
  if (isChecked) {
    if (th) th.classList.remove('hidden-col');
    tds.forEach(td => td.classList.remove('hidden-col'));
  } else {
    if (th) th.classList.add('hidden-col');
    tds.forEach(td => td.classList.add('hidden-col'));
  }
}

document.addEventListener('click', (e) => {
  const menuV = document.getElementById('column-menu-veiculos');
  const btnV = document.querySelector('button[onclick="toggleColumnMenuVeiculos()"]');
  if (menuV && btnV && !menuV.classList.contains('hidden') && !menuV.contains(e.target) && !btnV.contains(e.target)) {
    menuV.classList.add('hidden');
  }
});

function clearLeiturasVeiculoFilters() {
  document.getElementById('leituras-v-data-inicial').value = '';
  document.getElementById('leituras-v-data-final').value = '';
  document.getElementById('leituras-v-hora-inicial').value = '';
  document.getElementById('leituras-v-hora-final').value = '';
  document.getElementById('leituras-v-placa').value = '';
  document.getElementById('leituras-v-matricula').value = '';
  document.getElementById('leituras-v-nome').value = '';
  loadLeiturasVeiculo();
}

function exportLeiturasVeiculoExcel() {
  if (!currentVeiculosData || currentVeiculosData.length === 0) return;

  const isHiddenVeiculo = (colIndex) => {
    const cb = document.querySelector(`#column-menu-veiculos input[value="${colIndex}"]`);
    return cb && !cb.checked;
  };

  const columnsMap = [
    { index: 0, title: 'Placa', key: l => l.placa },
    { index: 1, title: 'Descrição', key: l => l.descricao_veiculo || '-' },
    { index: 2, title: 'Portaria', key: l => l.portaria },
    { index: 3, title: 'Sentido', key: l => l.sentido },
    { index: 4, title: 'Matrícula', key: l => l.matricula_condutor || '-' },
    { index: 5, title: 'Nome', key: l => l.nome_condutor || '-' },
    { index: 6, title: 'Credencial', key: l => l.credencial_condutor || '-' },
    { index: 7, title: 'Data/Hora', key: l => new Date(l.data_hora_leitura).toLocaleString() },
    { index: 8, title: 'Condutor', key: l => l.is_condutor ? 'Sim' : 'Não' },
    { index: 9, title: 'Situação', key: l => l.situacao === 1 ? 'Permitido' : 'Bloqueado' },
    { index: 10, title: 'ID Celular', key: l => l.id_celular }
  ];

  const activeColumns = columnsMap.filter(col => !isHiddenVeiculo(col.index));

  const exportData = currentVeiculosData.map(l => {
    const row = {};
    activeColumns.forEach(col => {
      row[col.title] = col.key(l);
    });
    return row;
  });

  const ws = XLSX.utils.json_to_sheet(exportData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Leituras Veículos");
  XLSX.writeFile(wb, 'leituras_veiculos.xlsx');
}

function exportLeiturasVeiculoPDF() {
  if (!currentVeiculosData || currentVeiculosData.length === 0) return;
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF('l', 'pt', 'a4');

  const isHiddenVeiculo = (colIndex) => {
    const cb = document.querySelector(`#column-menu-veiculos input[value="${colIndex}"]`);
    return cb && !cb.checked;
  };

  const columnsMap = [
    { index: 0, title: 'Placa', key: l => l.placa },
    { index: 1, title: 'Descrição', key: l => l.descricao_veiculo || '-' },
    { index: 2, title: 'Portaria', key: l => l.portaria },
    { index: 3, title: 'Sentido', key: l => l.sentido },
    { index: 4, title: 'Matrícula', key: l => l.matricula_condutor || '-' },
    { index: 5, title: 'Nome', key: l => l.nome_condutor || '-' },
    { index: 6, title: 'Credencial', key: l => l.credencial_condutor || '-' },
    { index: 7, title: 'Data/Hora', key: l => new Date(l.data_hora_leitura).toLocaleString() },
    { index: 8, title: 'Condutor', key: l => l.is_condutor ? 'Sim' : 'Não' },
    { index: 9, title: 'Situação', key: l => l.situacao === 1 ? 'Permitido' : 'Bloqueado' },
    { index: 10, title: 'ID Celular', key: l => l.id_celular }
  ];

  const activeColumns = columnsMap.filter(col => !isHiddenVeiculo(col.index));
  const headers = activeColumns.map(col => col.title);
  const data = currentVeiculosData.map(l => activeColumns.map(col => col.key(l)));

  doc.text("Relatório de Leituras de Veículos", 40, 40);
  
  doc.autoTable({
    head: [headers],
    body: data,
    startY: 50,
    theme: 'grid',
    styles: { fontSize: 8 },
    headStyles: { fillColor: [59, 130, 246] }
  });

  doc.save('leituras_veiculos.pdf');
}

// APK Management
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = 2;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function formatDate(dateString) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString('pt-BR') + ' ' + date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

async function loadAPKInfo() {
  const sizeEl = document.getElementById('admin-apk-size');
  const dateEl = document.getElementById('admin-apk-date');
  const statusEl = document.getElementById('admin-apk-status');
  const linkInput = document.getElementById('public-download-link');
  const testDownloadBtn = document.getElementById('admin-test-download');

  const publicURL = `${window.location.origin}/download.html`;
  linkInput.value = publicURL;

  try {
    const response = await fetch('/api/apk/info');
    const data = await response.json();

    if (response.ok && data.exists) {
      sizeEl.innerText = formatBytes(data.size);
      dateEl.innerText = formatDate(data.updatedAt);
      statusEl.innerText = 'Disponível';
      statusEl.style.color = 'var(--success)';
      testDownloadBtn.style.pointerEvents = 'auto';
      testDownloadBtn.style.opacity = '1';
    } else {
      sizeEl.innerText = '-';
      dateEl.innerText = '-';
      statusEl.innerText = 'Não disponível';
      statusEl.style.color = 'var(--danger)';
      testDownloadBtn.style.pointerEvents = 'none';
      testDownloadBtn.style.opacity = '0.5';
    }
  } catch (error) {
    console.error('Erro ao carregar informações do APK:', error);
  }
}

// Event Listeners para Gerenciamento de APK
document.addEventListener('DOMContentLoaded', () => {
  const fileInput = document.getElementById('apk-file-input');
  const label = document.getElementById('selected-apk-name');
  const uploadBtn = document.getElementById('apk-upload-btn');
  const copyBtn = document.getElementById('copy-link-btn');

  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        label.innerText = file.name;
        label.style.color = '#fff';
      } else {
        label.innerText = 'Nenhum arquivo selecionado';
        label.style.color = 'var(--text-muted)';
      }
    });
  }

  if (uploadBtn) {
    uploadBtn.addEventListener('click', async () => {
      const file = fileInput.files[0];
      const statusEl = document.getElementById('apk-upload-status');

      if (!file) {
        statusEl.innerHTML = '<span style="color: var(--danger);"><i class="fa-solid fa-triangle-exclamation"></i> Por favor, selecione um arquivo APK primeiro.</span>';
        return;
      }

      statusEl.innerHTML = '<span style="color: #fff;"><i class="fa-solid fa-spinner fa-spin"></i> Enviando e publicando arquivo APK...</span>';

      const formData = new FormData();
      formData.append('file', file);

      try {
        const response = await fetchAuth('/apk/upload', {
          method: 'POST',
          isFormData: true,
          body: formData
        });

        const data = await response.json();

        if (response.ok) {
          statusEl.innerHTML = `<span style="color: var(--success);"><i class="fa-solid fa-circle-check"></i> ${data.message || 'APK publicado com sucesso!'}</span>`;
          fileInput.value = '';
          label.innerText = 'Nenhum arquivo selecionado';
          label.style.color = 'var(--text-muted)';
          loadAPKInfo();
        } else {
          statusEl.innerHTML = `<span style="color: var(--danger);"><i class="fa-solid fa-circle-xmark"></i> ${data.error || 'Erro ao publicar APK.'}</span>`;
        }
      } catch (error) {
        console.error('Erro ao fazer upload do APK:', error);
        statusEl.innerHTML = '<span style="color: var(--danger);"><i class="fa-solid fa-circle-xmark"></i> Erro de conexão com o servidor.</span>';
      }
    });
  }

  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      const linkInput = document.getElementById('public-download-link');
      linkInput.select();
      linkInput.setSelectionRange(0, 99999);
      navigator.clipboard.writeText(linkInput.value);

      const originalHTML = copyBtn.innerHTML;
      copyBtn.innerHTML = '<i class="fa-solid fa-check"></i> Copiado!';
      copyBtn.style.backgroundColor = 'var(--success)';
      setTimeout(() => {
        copyBtn.innerHTML = originalHTML;
        copyBtn.style.backgroundColor = '';
      }, 2000);
    });
  }
});

