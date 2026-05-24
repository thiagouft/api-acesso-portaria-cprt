const API_URL = '/api';
let token = localStorage.getItem('cprt_token');
let userProfile = null;

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
  localStorage.removeItem('cprt_token');
  window.location.reload();
}

// Modals
function openModal(id) { document.getElementById(id).classList.add('active'); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); }

// Fetch Wrapper with Auth
async function fetchAuth(url, options = {}) {
  const headers = options.headers || {};
  if (!options.isFormData && options.body) {
    headers['Content-Type'] = 'application/json';
  }
  headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${url}`, { ...options, headers });
  if (res.status === 401 || res.status === 403) {
    alert('Sessão expirada ou acesso negado');
    logout();
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

// Pessoas
let globalPessoas = [];

async function loadPessoas(forceRefresh = false) {
  const tbody = document.querySelector('#pessoas-table tbody');
  
  if (globalPessoas.length === 0 || forceRefresh) {
    const res = await fetchAuth('/pessoas');
    globalPessoas = await res.json();
  }

  const field = document.getElementById('search-field').value;
  let query = document.getElementById('search-input').value.trim().toLowerCase();
  const statusFilter = document.getElementById('search-status').value;

  // Se a busca for por matrícula, remove os zeros à esquerda
  if (field === 'matricula') {
    query = query.replace(/^0+/, '');
  }

  let filtered = globalPessoas;

  if (query) {
    filtered = filtered.filter(p => {
      let val = p[field] ? p[field].toString().toLowerCase().trim() : '';
      if (field === 'matricula') {
        val = val.replace(/^0+/, '');
        return val === query; // Busca exata para matrícula
      }
      return val.includes(query); // Busca parcial para nome
    });
  }

  if (statusFilter !== 'todas') {
    filtered = filtered.filter(p => p.situacao.toString() === statusFilter);
  }

  // Por padrão, mostrar apenas os últimos 10 ou conforme resultado da busca
  const isSearchActive = query.length > 0 || statusFilter !== 'todas';
  const maxToRender = isSearchActive ? filtered.slice(0, 500) : filtered.slice(-10).reverse(); // últimos 10 invertidos se não tiver busca

  tbody.innerHTML = maxToRender.map(a => `
    <tr>
      <td>${a.matricula}</td>
      <td>${a.nome}</td>
      <td><span class="badge ${a.situacao === 1 ? 'success' : 'danger'}">${a.situacao === 1 ? 'Permitido' : 'Bloqueado'}</span></td>
      <td>${a.credenciais || '-'}</td>
      <td>${a.observacao || '-'}</td>
    </tr>
  `).join('');
  
  if (!isSearchActive && filtered.length > 10) {
    tbody.innerHTML += `<tr><td colspan="4" style="text-align:center; color:var(--text-muted);">Mostrando os últimos 10 de ${filtered.length} registros (Use a busca para ver mais).</td></tr>`;
  } else if (isSearchActive && filtered.length > 500) {
    tbody.innerHTML += `<tr><td colspan="4" style="text-align:center; color:var(--text-muted);">Mostrando 500 de ${filtered.length} resultados encontrados.</td></tr>`;
  }
}

document.getElementById('search-btn').addEventListener('click', () => loadPessoas(false));
document.getElementById('search-input').addEventListener('keyup', (e) => {
  if (e.key === 'Enter') loadPessoas(false);
});

// Leituras
async function loadLeituras() {
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

  const res = await fetchAuth(`/sync?${params.toString()}`);
  const leituras = await res.json();
  const tbody = document.querySelector('#leituras-table tbody');
  
  if (!leituras || leituras.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">Nenhuma leitura encontrada para os filtros aplicados.</td></tr>';
    return;
  }

  // Verifica estado atual das colunas para manter caso tenha sido alterado
  const isHidden = (colIndex) => {
    const cb = document.querySelector(`#column-menu input[value="${colIndex}"]`);
    return cb && !cb.checked;
  };

  tbody.innerHTML = leituras.map(l => `
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
  const table = document.getElementById('leituras-table');
  if(!table) return;

  // Criar clone da tabela para remover colunas ocultas
  const cloneTable = table.cloneNode(true);
  const hiddenElements = cloneTable.querySelectorAll('.hidden-col');
  hiddenElements.forEach(el => el.remove());

  const wb = XLSX.utils.table_to_book(cloneTable, {sheet:"Leituras"});
  XLSX.writeFile(wb, 'leituras_rfid.xlsx');
}

// Export PDF
function exportLeiturasPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF('l', 'pt', 'a4'); // Paisagem

  const table = document.getElementById('leituras-table');
  if(!table) return;

  // Extrair cabeçalhos (apenas visíveis)
  const headers = [];
  table.querySelectorAll('thead th').forEach(th => {
    if (!th.classList.contains('hidden-col')) {
      headers.push(th.innerText);
    }
  });

  // Extrair linhas (apenas visíveis)
  const data = [];
  table.querySelectorAll('tbody tr').forEach(tr => {
    if(tr.cells.length === 1 && tr.cells[0].colSpan > 1) return; // Nenhuma leitura
    
    const row = [];
    tr.querySelectorAll('td').forEach(td => {
      if (!td.classList.contains('hidden-col')) {
        row.push(td.innerText);
      }
    });
    data.push(row);
  });

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

// Veiculos
async function loadVeiculos() {
  const res = await fetchAuth('/veiculos');
  const veiculos = await res.json();
  const tbody = document.querySelector('#veiculos-table tbody');
  tbody.innerHTML = veiculos.map(v => `
    <tr>
      <td>${v.id}</td>
      <td>${v.placa}</td>
      <td>${v.descricao}</td>
      <td><button class="btn secondary-btn" onclick="deleteVeiculo(${v.id})"><i class="fa-solid fa-trash"></i></button></td>
    </tr>
  `).join('');
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

// Leituras Veiculo
async function loadLeiturasVeiculo() {
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

  const res = await fetchAuth(`/sync/leituras-veiculo?${params.toString()}`);
  const leituras = await res.json();
  const tbody = document.querySelector('#leituras-v-table tbody');
  
  if (!leituras || leituras.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align: center;">Nenhuma leitura encontrada.</td></tr>';
    return;
  }

  // Verifica estado atual das colunas para manter caso tenha sido alterado
  const isHiddenVeiculo = (colIndex) => {
    const cb = document.querySelector(`#column-menu-veiculos input[value="${colIndex}"]`);
    return cb && !cb.checked;
  };

  tbody.innerHTML = leituras.map(l => `
    <tr>
      <td data-col="0" class="${isHiddenVeiculo(0) ? 'hidden-col' : ''}">${l.placa}</td>
      <td data-col="1" class="${isHiddenVeiculo(1) ? 'hidden-col' : ''}">${l.portaria}</td>
      <td data-col="2" class="${isHiddenVeiculo(2) ? 'hidden-col' : ''}"><span class="badge ${l.sentido === 'ENTRADA' ? 'success' : l.sentido === 'SAIDA' ? 'danger' : 'secondary'}">${l.sentido}</span></td>
      <td data-col="3" class="${isHiddenVeiculo(3) ? 'hidden-col' : ''}">${l.matricula_condutor || '-'}</td>
      <td data-col="4" class="${isHiddenVeiculo(4) ? 'hidden-col' : ''}">${l.nome_condutor || '-'}</td>
      <td data-col="5" class="${isHiddenVeiculo(5) ? 'hidden-col' : ''}">${l.credencial_condutor || '-'}</td>
      <td data-col="6" class="${isHiddenVeiculo(6) ? 'hidden-col' : ''}">${new Date(l.data_hora_leitura).toLocaleString()}</td>
      <td data-col="7" class="${isHiddenVeiculo(7) ? 'hidden-col' : ''}">${l.is_condutor ? 'Sim' : 'Não'}</td>
      <td data-col="8" class="${isHiddenVeiculo(8) ? 'hidden-col' : ''}"><span class="badge ${l.situacao === 1 ? 'success' : 'danger'}">${l.situacao === 1 ? 'Permitido' : 'Bloqueado'}</span></td>
      <td data-col="9" class="${isHiddenVeiculo(9) ? 'hidden-col' : ''}">${l.id_celular}</td>
    </tr>
  `).join('');
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
  const table = document.getElementById('leituras-v-table');
  if(!table) return;

  const cloneTable = table.cloneNode(true);
  const hiddenElements = cloneTable.querySelectorAll('.hidden-col');
  hiddenElements.forEach(el => el.remove());

  const wb = XLSX.utils.table_to_book(cloneTable, {sheet:"Leituras Veículos"});
  XLSX.writeFile(wb, 'leituras_veiculos.xlsx');
}

function exportLeiturasVeiculoPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF('l', 'pt', 'a4');

  const table = document.getElementById('leituras-v-table');
  if(!table) return;

  const headers = [];
  table.querySelectorAll('thead th').forEach(th => {
    if (!th.classList.contains('hidden-col')) {
      headers.push(th.innerText);
    }
  });

  const data = [];
  table.querySelectorAll('tbody tr').forEach(tr => {
    if(tr.cells.length === 1 && tr.cells[0].colSpan > 1) return;
    const row = [];
    tr.querySelectorAll('td').forEach(td => {
      if (!td.classList.contains('hidden-col')) {
        row.push(td.innerText);
      }
    });
    data.push(row);
  });

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
