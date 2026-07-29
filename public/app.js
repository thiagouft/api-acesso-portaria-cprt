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
    else if (btn.dataset.target === 'panel-visitantes') loadVisitantes();
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

function clearPessoasFilters() {
  document.getElementById('search-field').value = 'matricula';
  document.getElementById('search-input').value = '';
  document.getElementById('search-status').value = 'todas';
  document.getElementById('search-ativo').value = 'todos';
  loadPessoas(false);
}

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
  const tipo = document.getElementById('leituras-tipo').value;
  const searchField = document.getElementById('leituras-search-field').value;
  const searchInput = document.getElementById('leituras-search-input').value;

  const params = new URLSearchParams();
  if (dtInicial) params.append('dataInicial', dtInicial);
  if (dtFinal) params.append('dataFinal', dtFinal);
  if (horaInicial) params.append('horaInicial', horaInicial);
  if (horaFinal) params.append('horaFinal', horaFinal);
  if (tipo) params.append('tipo', tipo);
  if (searchInput) params.append(searchField, searchInput);

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
      <td data-col="1" class="${isHidden(1) ? 'hidden-col' : ''}">${l.pessoa_nome || 'N/A'} ${l.pessoa_tipo === 'VISITANTE' ? '<span class="badge info" style="margin-left: 5px; font-size: 0.7rem; background: #0284c7; color: white;">Visitante</span>' : ''}</td>
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
  document.getElementById('leituras-tipo').value = '';
  document.getElementById('leituras-search-field').value = 'matricula';
  document.getElementById('leituras-search-input').value = '';
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
  
  const searchField = document.getElementById('veiculos-search-field').value;
  const searchInput = document.getElementById('veiculos-search-input').value;

  const params = new URLSearchParams();
  if (searchInput) {
    params.append('searchField', searchField);
    params.append('searchInput', searchInput);
  }

  try {
    const res = await fetchAuth(`/veiculos?${params.toString()}`);
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
      <td>
        <div style="display: flex; gap: 8px;">
          <button class="btn secondary-btn" style="padding: 5px 10px; width: auto; margin: 0;" onclick="editVeiculo(${v.id}, '${v.placa}', '${v.descricao.replace(/'/g, "\\'")}')"><i class="fa-solid fa-pen"></i></button>
          <button class="btn secondary-btn" style="padding: 5px 10px; width: auto; margin: 0;" onclick="deleteVeiculo(${v.id})"><i class="fa-solid fa-trash"></i></button>
        </div>
      </td>
    </tr>
  `).join('');
}

function goToVeiculosCadastroPage(page) {
  currentVeiculosCadastroPage = page;
  renderVeiculosCadastroPage();
}

function editVeiculo(id, placa, descricao) {
  document.getElementById('veiculo-modal-title').innerText = 'Editar Veículo';
  document.getElementById('v-id').value = id;
  document.getElementById('v-placa').value = placa;
  document.getElementById('v-placa').disabled = true;
  document.getElementById('v-descricao').value = descricao;
  openModal('veiculo-modal');
}

// Reset modal when closing or opening for new
const originalOpenModal = openModal;
openModal = function(id) {
  if (id === 'veiculo-modal' && !document.getElementById('v-id').value) {
    document.getElementById('veiculo-modal-title').innerText = 'Novo Veículo';
    document.getElementById('v-placa').disabled = false;
    document.getElementById('v-id').value = '';
    document.getElementById('create-veiculo-form').reset();
  }
  originalOpenModal(id);
};

function clearVeiculosCadastroFilters() {
  document.getElementById('veiculos-search-field').value = 'placa';
  document.getElementById('veiculos-search-input').value = '';
  loadVeiculos();
}

document.getElementById('veiculos-search-btn').addEventListener('click', () => loadVeiculos());
document.getElementById('veiculos-search-input').addEventListener('keyup', (e) => {
  if (e.key === 'Enter') loadVeiculos();
});

document.getElementById('create-veiculo-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('v-id').value;
  const placaInput = document.getElementById('v-placa').value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  
  if (id) {
    // Edit vehicle description
    const body = {
      descricao: document.getElementById('v-descricao').value
    };
    const res = await fetchAuth(`/veiculos/${id}`, { method: 'PUT', body: JSON.stringify(body) });
    if(res.ok) {
      closeModal('veiculo-modal');
      loadVeiculos();
      document.getElementById('create-veiculo-form').reset();
      document.getElementById('v-id').value = '';
    } else {
      const err = await res.json();
      alert('Erro: ' + (err.error || 'Não foi possível salvar o veículo.'));
    }
  } else {
    // Create new vehicle
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
  const tipo = document.getElementById('leituras-v-tipo').value;
  const searchField = document.getElementById('leituras-v-search-field').value;
  const searchInput = document.getElementById('leituras-v-search-input').value;

  const params = new URLSearchParams();
  if (dtInicial) params.append('dataInicial', dtInicial);
  if (dtFinal) params.append('dataFinal', dtFinal);
  if (horaInicial) params.append('horaInicial', horaInicial);
  if (horaFinal) params.append('horaFinal', horaFinal);
  if (tipo) params.append('tipo', tipo);
  if (searchInput) params.append(searchField, searchInput);

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
      <td data-col="5" class="${isHiddenVeiculo(5) ? 'hidden-col' : ''}">${l.nome_condutor || '-'} ${l.tipo_condutor === 'VISITANTE' ? '<span class="badge info" style="margin-left: 5px; font-size: 0.7rem; background: #0284c7; color: white;">Visitante</span>' : ''}</td>
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
  document.getElementById('leituras-v-tipo').value = '';
  document.getElementById('leituras-v-search-field').value = 'placa';
  document.getElementById('leituras-v-search-input').value = '';
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

// =====================================
// Gestão de Visitantes
// =====================================
let globalVisitantes = [];
let currentVisitantesData = [];
let currentVisitantesPage = 1;
const VISITANTES_PER_PAGE = 20;

async function loadVisitantes(forceRefresh = false) {
  const tbody = document.querySelector('#visitantes-table tbody');
  if (!tbody) return;

  if (globalVisitantes.length === 0 || forceRefresh) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 30px;"><i class="fa-solid fa-spinner fa-spin" style="font-size: 1.5rem; margin-right: 10px; color: var(--primary-color);"></i> Carregando visitantes...</td></tr>';
    try {
      const res = await fetchAuth('/visitantes?incluirInativos=true');
      globalVisitantes = await res.json();
    } catch (err) {
      console.error(err);
      tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: var(--danger);">Erro ao carregar visitantes.</td></tr>';
      return;
    }
  }

  const query = document.getElementById('visitantes-search-input')?.value.trim().toLowerCase() || '';
  const statusFilter = document.getElementById('visitantes-search-status')?.value || 'todas';
  const ativoFilter = document.getElementById('visitantes-search-ativo')?.value || 'todos';

  let filtered = globalVisitantes;

  if (query) {
    filtered = filtered.filter(v => {
      const nomeMatch = v.nome ? v.nome.toLowerCase().includes(query) : false;
      const cpfMatch = v.cpf ? v.cpf.toLowerCase().includes(query) : false;
      const empresaMatch = v.empresa ? v.empresa.toLowerCase().includes(query) : false;
      return nomeMatch || cpfMatch || empresaMatch;
    });
  }

  if (statusFilter !== 'todas') {
    filtered = filtered.filter(v => v.situacao.toString() === statusFilter);
  }

  if (ativoFilter === 'ativos') {
    filtered = filtered.filter(v => v.ativo === true);
  } else if (ativoFilter === 'inativos') {
    filtered = filtered.filter(v => v.ativo === false);
  }

  currentVisitantesData = filtered;
  currentVisitantesPage = 1;
  renderVisitantesPage();
}

const formatDateLocal = (dateStr) => {
  if (!dateStr) return '-';
  const parts = dateStr.substring(0, 10).split('-');
  if (parts.length !== 3) return '-';
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
};

function renderVisitantesPage() {
  const totalRecords = currentVisitantesData ? currentVisitantesData.length : 0;
  const totalPages = Math.ceil(totalRecords / VISITANTES_PER_PAGE) || 1;
  if (currentVisitantesPage < 1) currentVisitantesPage = 1;
  if (currentVisitantesPage > totalPages) currentVisitantesPage = totalPages;

  renderPaginationControls({
    containerId: 'visitantes-pagination',
    totalCountId: 'visitantes-total-count',
    currentPage: currentVisitantesPage,
    totalRecords: totalRecords,
    perPage: VISITANTES_PER_PAGE,
    goToPageFn: 'goToVisitantesPage'
  });

  const tbody = document.querySelector('#visitantes-table tbody');
  if (!tbody) return;

  if (!currentVisitantesData || totalRecords === 0) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align: center;">Nenhum visitante encontrado.</td></tr>';
    return;
  }

  const startIndex = (currentVisitantesPage - 1) * VISITANTES_PER_PAGE;
  const pageItems = currentVisitantesData.slice(startIndex, startIndex + VISITANTES_PER_PAGE);

  tbody.innerHTML = pageItems.map(v => `
    <tr>
      <td>${v.cpf}</td>
      <td><strong>${v.nome}</strong></td>
      <td>${v.empresa || '-'}</td>
      <td>${v.credenciais || '-'}</td>
      <td>${formatDateLocal(v.data_inicio)} a ${formatDateLocal(v.data_fim)}</td>
      <td><span class="badge ${v.situacao === 1 ? 'success' : 'danger'}">${v.situacao === 1 ? 'Permitido' : 'Bloqueado'}</span></td>
      <td><span class="badge ${v.ativo ? 'success' : 'secondary'}">${v.ativo ? 'Ativo' : 'Inativo'}</span></td>
      <td>${v.observacao || '-'}</td>
      <td style="display: flex; gap: 6px; justify-content: center;">
        <button class="btn secondary-btn" style="padding: 4px 8px; font-size: 0.8rem; width: auto;" onclick="openVisitanteModal(${JSON.stringify(v).replace(/"/g, '&quot;')})" title="Editar"><i class="fa-solid fa-pen"></i></button>
        <button class="btn secondary-btn" style="padding: 4px 8px; font-size: 0.8rem; width: auto;" onclick="toggleVisitanteStatus(${v.id})" title="${v.ativo ? 'Inativar' : 'Ativar'}"><i class="fa-solid ${v.ativo ? 'fa-user-slash' : 'fa-user-check'}"></i></button>
        <button class="btn danger-btn" style="padding: 4px 8px; font-size: 0.8rem; width: auto; background: var(--danger); color: white;" onclick="deleteVisitanteConfirm(${v.id})" title="Excluir"><i class="fa-solid fa-trash"></i></button>
      </td>
    </tr>
  `).join('');
}

function goToVisitantesPage(page) {
  currentVisitantesPage = page;
  renderVisitantesPage();
}

function changeVisitantesPage(delta) {
  currentVisitantesPage += delta;
  renderVisitantesPage();
}

function openVisitanteModal(visitante = null) {
  const modalTitle = document.getElementById('visitante-modal-title');
  const form = document.getElementById('visitante-form');
  
  if (visitante) {
    modalTitle.innerText = 'Editar Visitante';
    document.getElementById('vis-id').value = visitante.id;
    document.getElementById('vis-cpf').value = visitante.cpf;
    document.getElementById('vis-cpf').readOnly = true;
    document.getElementById('vis-nome').value = visitante.nome;
    document.getElementById('vis-empresa').value = visitante.empresa || '';
    document.getElementById('vis-credenciais').value = visitante.credenciais || '';
    document.getElementById('vis-situacao').value = visitante.situacao;
    document.getElementById('vis-observacao').value = visitante.observacao || '';
    document.getElementById('vis-data-inicio').value = visitante.data_inicio ? visitante.data_inicio.substring(0, 10) : '';
    document.getElementById('vis-data-fim').value = visitante.data_fim ? visitante.data_fim.substring(0, 10) : '';
  } else {
    modalTitle.innerText = 'Novo Visitante';
    form.reset();
    document.getElementById('vis-id').value = '';
    document.getElementById('vis-cpf').readOnly = false;
    document.getElementById('vis-situacao').value = '1';
    
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const todayLocal = `${year}-${month}-${day}`;
    document.getElementById('vis-data-inicio').value = todayLocal;
    document.getElementById('vis-data-fim').value = todayLocal;
  }

  openModal('visitante-modal');
}

document.addEventListener('DOMContentLoaded', () => {
  const visForm = document.getElementById('visitante-form');
  if (visForm) {
    visForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('vis-id').value;
      const cpf = document.getElementById('vis-cpf').value.trim();
      const nome = document.getElementById('vis-nome').value.trim();
      const empresa = document.getElementById('vis-empresa').value.trim();
      const credenciais = document.getElementById('vis-credenciais').value.trim();
      const situacao = parseInt(document.getElementById('vis-situacao').value);
      const observacao = document.getElementById('vis-observacao').value.trim();
      const data_inicio = document.getElementById('vis-data-inicio').value;
      const data_fim = document.getElementById('vis-data-fim').value;

      const payload = { cpf, nome, empresa, credenciais, situacao, observacao, data_inicio, data_fim };

      try {
        let res;
        if (id) {
          res = await fetchAuth(`/visitantes/${id}`, {
            method: 'PUT',
            body: JSON.stringify(payload)
          });
        } else {
          res = await fetchAuth('/visitantes', {
            method: 'POST',
            body: JSON.stringify(payload)
          });
        }

        const data = await res.json();

        if (res.ok) {
          closeModal('visitante-modal');
          loadVisitantes(true);
        } else {
          alert(data.error || 'Erro ao salvar visitante.');
        }
      } catch (err) {
        console.error(err);
        alert('Erro de conexão ao salvar visitante.');
      }
    });
  }

  const visSearchBtn = document.getElementById('visitantes-search-btn');
  if (visSearchBtn) {
    visSearchBtn.addEventListener('click', () => loadVisitantes(false));
  }

  const visSearchInput = document.getElementById('visitantes-search-input');
  if (visSearchInput) {
    visSearchInput.addEventListener('keyup', (e) => {
      if (e.key === 'Enter') loadVisitantes(false);
    });
  }
});

async function toggleVisitanteStatus(id) {
  try {
    const res = await fetchAuth(`/visitantes/${id}/status`, { method: 'PATCH' });
    if (res.ok) {
      loadVisitantes(true);
    } else {
      const data = await res.json();
      alert(data.error || 'Erro ao alterar status.');
    }
  } catch (err) {
    console.error(err);
    alert('Erro de conexão.');
  }
}

async function deleteVisitanteConfirm(id) {
  if (!confirm('Tem certeza que deseja excluir permanentemente este visitante?')) return;
  try {
    const res = await fetchAuth(`/visitantes/${id}`, { method: 'DELETE' });
    if (res.ok) {
      loadVisitantes(true);
    } else {
      const data = await res.json();
      alert(data.error || 'Erro ao excluir visitante.');
    }
  } catch (err) {
    console.error(err);
    alert('Erro de conexão.');
  }
}


