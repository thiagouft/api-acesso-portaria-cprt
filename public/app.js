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

// Upload XLS
document.getElementById('upload-btn').addEventListener('click', async () => {
  const fileInput = document.getElementById('file-input');
  const statusDiv = document.getElementById('upload-status');
  if(!fileInput.files[0]) return alert('Selecione um arquivo.');
  
  const formData = new FormData();
  formData.append('file', fileInput.files[0]);

  statusDiv.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processando...';
  
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
  const res = await fetchAuth('/sync');
  const leituras = await res.json();
  const tbody = document.querySelector('#leituras-table tbody');
  tbody.innerHTML = leituras.map(l => `
    <tr>
      <td>${new Date(l.data_hora_leitura).toLocaleString()}</td>
      <td>${l.portaria?.descricao || l.id_portaria}</td>
      <td>${l.credencial}</td>
      <td><span class="badge ${l.situacao === 1 ? 'success' : 'danger'}">${l.situacao === 1 ? 'Permitido' : 'Bloqueado'}</span></td>
      <td>${l.id_celular}</td>
    </tr>
  `).join('');
}
