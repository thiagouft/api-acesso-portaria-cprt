const API_URL = '/api';
let token = localStorage.getItem('cprt_token');
let userProfile = null;
let isLoggingOut = false;
let tempLoginData = null;
let allRefeitorios = [];

// Auth Check on load
window.onload = () => {
  if (token) {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      userProfile = payload.perfil;
      document.getElementById('user-name-display').innerText = `${payload.nome || payload.login} (${userProfile})`;
      
      // Ajustar visibilidade de menus para perfis de Refeição
      if (userProfile === 'REFEICAO' || userProfile === 'REFEICAO_MULTI') {
        applyRefeicaoProfileRestrictions();
      }

      showScreen('dashboard-screen');
      loadInitialData();
    } catch(e) {
      console.error(e);
      logout();
    }
  } else {
    showScreen('login-screen');
  }
};

function applyRefeicaoProfileRestrictions() {
  // Ocultar menus exclusivos MASTER
  const masterPanels = ['panel-home', 'panel-users', 'panel-portarias', 'panel-upload', 'panel-leituras', 'panel-pessoas', 'panel-visitantes', 'panel-veiculos', 'panel-leituras-veiculos', 'panel-apk'];
  document.querySelectorAll('.sidebar-nav .nav-btn').forEach(btn => {
    if (masterPanels.includes(btn.dataset.target)) {
      btn.style.display = 'none';
    }
  });

  // Abrir o grupo de refeições e selecionar Leituras de Refeição
  const group = document.getElementById('nav-group-refeicoes');
  if (group) group.classList.add('open');

  const btnRefeicoes = document.querySelector('.nav-btn[data-target="panel-refeicoes"]');
  if (btnRefeicoes) {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    btnRefeicoes.classList.add('active');
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    document.getElementById('panel-refeicoes').classList.add('active');
    document.getElementById('current-page-title').innerText = 'Leituras Refeição';
  }
}

// Submenu toggle listener
const refeicoesToggle = document.getElementById('btn-refeicoes-toggle');
if (refeicoesToggle) {
  refeicoesToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    const group = document.getElementById('nav-group-refeicoes');
    if (group) {
      const isOpening = !group.classList.contains('open');
      group.classList.toggle('open');
      
      if (isOpening) {
        setTimeout(() => {
          const sidebarNav = document.querySelector('.sidebar-nav');
          if (sidebarNav) {
            sidebarNav.scrollTo({
              top: sidebarNav.scrollHeight,
              behavior: 'smooth'
            });
          }
          group.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 120);
      }
    }
  });
}

// UI Navigation
document.querySelectorAll('.nav-btn').forEach(btn => {
  if(btn.id === 'logout-btn' || btn.id === 'btn-refeicoes-toggle') return;
  btn.addEventListener('click', (e) => {
    if (!btn.dataset.target) return;

    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    const targetPanel = document.getElementById(btn.dataset.target);
    if (targetPanel) targetPanel.classList.add('active');
    
    document.getElementById('current-page-title').innerText = btn.innerText.trim();

    // Se clicou em um sub-botão de refeições, manter o grupo aberto
    if (btn.classList.contains('nav-sub-btn')) {
      const group = document.getElementById('nav-group-refeicoes');
      if (group) group.classList.add('open');
    }

    // Load data based on panel
    if (btn.dataset.target === 'panel-users') loadUsers();
    else if (btn.dataset.target === 'panel-portarias') loadPortarias();
    else if (btn.dataset.target === 'panel-leituras') loadLeituras();
    else if (btn.dataset.target === 'panel-pessoas') loadPessoas();
    else if (btn.dataset.target === 'panel-visitantes') loadVisitantes();
    else if (btn.dataset.target === 'panel-veiculos') loadVeiculos();
    else if (btn.dataset.target === 'panel-leituras-veiculos') loadLeiturasVeiculo();
    else if (btn.dataset.target === 'panel-refeitorios') loadRefeitorios();
    else if (btn.dataset.target === 'panel-refeicoes') {
      loadRefeitoriosOptions();
      loadLeiturasRefeicao();
    }
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
  const loginError = document.getElementById('login-error');
  loginError.innerText = '';

  try {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login: loginInput, senha: passwordInput })
    });
    const data = await res.json();
    if (res.ok) {
      if (data.usuario.perfil === 'MOBILE') {
        loginError.innerText = 'Acesso MOBILE exclusivo pelo aplicativo.';
        return;
      }

      // Se for perfil de refeição, apresentar a escolha do(s) refeitório(s)
      if (data.usuario.perfil === 'REFEICAO' || data.usuario.perfil === 'REFEICAO_MULTI') {
        tempLoginData = data;
        showRefeitorioSelectionStep(data);
        return;
      }

      if (data.usuario.perfil !== 'MASTER') {
        loginError.innerText = 'Acesso não permitido para este perfil.';
        return;
      }

      token = data.token;
      localStorage.setItem('cprt_token', token);
      window.location.reload();
    } else {
      loginError.innerText = data.error || 'Erro no login';
    }
  } catch (err) {
    loginError.innerText = 'Erro ao conectar no servidor.';
  }
});

// Etapa de Escolha de Refeitório no Login
function showRefeitorioSelectionStep(data) {
  document.getElementById('login-form').style.display = 'none';
  const stepDiv = document.getElementById('login-refeitorios-step');
  stepDiv.style.display = 'block';

  const hint = document.getElementById('refeitorio-selection-hint');
  const list = document.getElementById('login-refeitorios-list');
  const err = document.getElementById('login-refeitorio-error');
  err.style.display = 'none';
  list.innerHTML = '';

  const isMulti = data.usuario.podeSelecionarMultiplosRefeitorios;
  if (isMulti) {
    hint.innerText = 'Seu perfil (REFEICAO MULTI) permite selecionar de 1 a N refeitórios:';
  } else {
    hint.innerText = 'Selecione o refeitório em que você está operando:';
  }

  const refeitorios = data.refeitorios || [];
  if (refeitorios.length === 0) {
    list.innerHTML = '<p style="color: var(--danger); font-size: 0.85rem; padding: 10px; margin: 0; line-height: 1.4;"><i class="fa-solid fa-circle-exclamation"></i> Nenhum refeitório autorizado para este usuário. Solicite ao administrador MASTER o vínculo do seu refeitório.</p>';
    document.getElementById('btn-confirm-refeitorios').disabled = true;
    return;
  }

  document.getElementById('btn-confirm-refeitorios').disabled = false;

  if (isMulti) {
    // Checkbox Selecionar Todos
    const selectAllLabel = document.createElement('label');
    selectAllLabel.className = 'refeitorio-option-item';
    selectAllLabel.style.fontWeight = 'bold';
    selectAllLabel.style.borderColor = 'rgba(59, 130, 246, 0.4)';
    selectAllLabel.innerHTML = `<input type="checkbox" id="check-all-refeitorios"> <span>(Selecionar Todos)</span>`;
    selectAllLabel.querySelector('input').addEventListener('change', (e) => {
      document.querySelectorAll('.login-refeitorio-chk').forEach(chk => chk.checked = e.target.checked);
    });
    list.appendChild(selectAllLabel);
  }

  refeitorios.forEach((ref, index) => {
    const label = document.createElement('label');
    label.className = 'refeitorio-option-item';
    const inputType = isMulti ? 'checkbox' : 'radio';
    const checkedAttr = (!isMulti && index === 0) ? 'checked' : '';
    label.innerHTML = `
      <input type="${inputType}" name="refeitorio_choice" class="${isMulti ? 'login-refeitorio-chk' : 'login-refeitorio-radio'}" value="${ref.id}" data-desc="${ref.descricao}" ${checkedAttr}>
      <span>${ref.descricao}</span>
    `;
    list.appendChild(label);
  });
}

document.getElementById('btn-cancel-refeitorios').addEventListener('click', () => {
  tempLoginData = null;
  document.getElementById('login-refeitorios-step').style.display = 'none';
  document.getElementById('login-form').style.display = 'block';
  document.getElementById('login-error').innerText = '';
});

document.getElementById('btn-confirm-refeitorios').addEventListener('click', () => {
  const err = document.getElementById('login-refeitorio-error');
  err.style.display = 'none';

  const isMulti = tempLoginData.usuario.podeSelecionarMultiplosRefeitorios;
  const selected = [];
  const selector = isMulti ? '.login-refeitorio-chk:checked' : '.login-refeitorio-radio:checked';
  document.querySelectorAll(selector).forEach(input => {
    selected.push({ id: parseInt(input.value), descricao: input.dataset.desc });
  });

  if (selected.length === 0) {
    err.innerText = isMulti ? 'Selecione pelo menos um refeitório para continuar.' : 'Selecione um refeitório para continuar.';
    err.style.display = 'block';
    return;
  }

  localStorage.setItem('cprt_token', tempLoginData.token);
  localStorage.setItem('cprt_refeitorios_selecionados', JSON.stringify(selected));
  window.location.reload();
});

// Logout
document.getElementById('logout-btn').addEventListener('click', logout);
function logout() {
  isLoggingOut = true;
  localStorage.removeItem('cprt_token');
  localStorage.removeItem('cprt_refeitorios_selecionados');
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
  if (!options.isFormData && !(options.body instanceof FormData) && options.body) {
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
// Users
let allUsersList = [];

async function loadUsers() {
  const tbody = document.querySelector('#users-table tbody');
  tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 20px;"><i class="fa-solid fa-spinner fa-spin"></i> Carregando usuários...</td></tr>';
  
  try {
    const res = await fetchAuth('/users');
    allUsersList = await res.json();

    if (!allUsersList || allUsersList.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 20px;">Nenhum usuário cadastrado.</td></tr>';
      return;
    }

    tbody.innerHTML = allUsersList.map(u => {
      const hasRefeitorios = u.refeitorios && u.refeitorios.length > 0;
      const refeitoriosText = hasRefeitorios 
        ? u.refeitorios.map(r => r.descricao).join(', ')
        : 'Nenhum refeitório vinculado';
      return `
        <tr>
          <td style="font-weight: 500;">${u.nome}</td>
          <td>${u.login}</td>
          <td>${u.email}</td>
          <td>
            <span class="badge ${u.perfil === 'MASTER' ? 'success' : (String(u.perfil).startsWith('REFEICAO') ? 'info' : '')}">${u.perfil}</span>
            ${String(u.perfil).startsWith('REFEICAO') ? `
              <div style="font-size: 0.75rem; color: #93c5fd; margin-top: 4px; display: flex; align-items: center; gap: 4px;">
                <i class="fa-solid fa-utensils"></i> <span title="${refeitoriosText}">${refeitoriosText}</span>
              </div>
            ` : ''}
          </td>
          <td>
            <button class="btn secondary-btn" onclick="openEditUserModal(${u.id})" title="Editar Usuário"><i class="fa-solid fa-pen"></i></button>
            <button class="btn secondary-btn" onclick="deleteUser(${u.id})" title="Excluir Usuário"><i class="fa-solid fa-trash"></i></button>
          </td>
        </tr>
      `;
    }).join('');
  } catch (e) {
    console.error(e);
    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--danger);">Erro ao carregar usuários.</td></tr>';
  }
}

async function ensureRefeitoriosLoaded() {
  if (!allRefeitorios || allRefeitorios.length === 0) {
    try {
      const res = await fetchAuth('/refeitorios');
      if (res.ok) {
        allRefeitorios = await res.json();
      }
    } catch (e) {
      console.warn('Erro ao carregar lista de refeitórios:', e);
    }
  }
  return allRefeitorios || [];
}

async function updateUserModalRefeitorios(perfil, selectedIds = []) {
  const group = document.getElementById('u-refeitorios-group');
  const singleBox = document.getElementById('u-refeitorio-single-box');
  const multiBox = document.getElementById('u-refeitorio-multi-box');
  const label = document.getElementById('u-refeitorios-label');
  const singleSelect = document.getElementById('u-refeitorio-single');
  const checkList = document.getElementById('u-refeitorios-checklist');

  if (!group || !singleBox || !multiBox) return;

  if (perfil !== 'REFEICAO' && perfil !== 'REFEICAO_MULTI') {
    group.style.display = 'none';
    singleBox.style.display = 'none';
    multiBox.style.display = 'none';
    return;
  }

  const refeitorios = await ensureRefeitoriosLoaded();
  const ativos = (refeitorios || []).filter(r => r.ativo);

  group.style.display = 'block';

  if (perfil === 'REFEICAO') {
    label.innerHTML = '<i class="fa-solid fa-utensils"></i> Refeitório Autorizado (Selecione 1):';
    singleBox.style.display = 'block';
    multiBox.style.display = 'none';

    singleSelect.innerHTML = '<option value="">Selecione o refeitório...</option>';
    ativos.forEach(r => {
      const opt = document.createElement('option');
      opt.value = r.id;
      opt.innerText = r.descricao;
      if (selectedIds.includes(r.id)) {
        opt.selected = true;
      }
      singleSelect.appendChild(opt);
    });
  } else if (perfil === 'REFEICAO_MULTI') {
    label.innerHTML = '<i class="fa-solid fa-utensils"></i> Refeitórios Autorizados (Selecione 1 ou mais):';
    singleBox.style.display = 'none';
    multiBox.style.display = 'block';

    checkList.innerHTML = '';
    if (ativos.length === 0) {
      checkList.innerHTML = '<span style="color: var(--danger); font-size: 0.8rem;">Nenhum refeitório ativo disponível.</span>';
    } else {
      ativos.forEach(r => {
        const itemLabel = document.createElement('label');
        itemLabel.className = 'user-refeitorio-item';
        const isChecked = selectedIds.includes(r.id);
        itemLabel.innerHTML = `
          <input type="checkbox" class="u-ref-chk" value="${r.id}" ${isChecked ? 'checked' : ''}>
          <span>${r.descricao}</span>
        `;
        checkList.appendChild(itemLabel);
      });
    }
  }
}

// Evento ao alterar perfil no formulário
const uPerfilSelect = document.getElementById('u-perfil');
if (uPerfilSelect) {
  uPerfilSelect.addEventListener('change', (e) => {
    updateUserModalRefeitorios(e.target.value);
  });
}

function openCreateUserModal() {
  document.getElementById('user-modal-title').innerText = 'Novo Usuário';
  document.getElementById('u-id').value = '';
  document.getElementById('u-nome').value = '';
  document.getElementById('u-email').value = '';
  document.getElementById('u-login').value = '';
  document.getElementById('u-cpf').value = '';
  const senhaInput = document.getElementById('u-senha');
  senhaInput.value = '';
  senhaInput.required = true;
  senhaInput.placeholder = 'Senha';
  document.getElementById('u-senha-hint').style.display = 'none';
  document.getElementById('u-perfil').value = 'MOBILE';
  updateUserModalRefeitorios('MOBILE');
  openModal('user-modal');
}

function openEditUserModal(id) {
  const user = allUsersList.find(u => u.id === id);
  if (!user) return;

  document.getElementById('user-modal-title').innerText = 'Editar Usuário';
  document.getElementById('u-id').value = user.id;
  document.getElementById('u-nome').value = user.nome || '';
  document.getElementById('u-email').value = user.email || '';
  document.getElementById('u-login').value = user.login || '';
  document.getElementById('u-cpf').value = user.cpf || '';
  
  const senhaInput = document.getElementById('u-senha');
  senhaInput.value = '';
  senhaInput.required = false;
  senhaInput.placeholder = 'Nova Senha (opcional)';
  document.getElementById('u-senha-hint').style.display = 'block';

  document.getElementById('u-perfil').value = user.perfil || 'MOBILE';
  const selectedIds = (user.refeitorios || []).map(r => r.id);
  updateUserModalRefeitorios(user.perfil || 'MOBILE', selectedIds);
  openModal('user-modal');
}

document.getElementById('create-user-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('u-id').value;
  const nome = document.getElementById('u-nome').value.trim();
  const email = document.getElementById('u-email').value.trim();
  const login = document.getElementById('u-login').value.trim();
  const cpf = document.getElementById('u-cpf').value.trim();
  const senha = document.getElementById('u-senha').value;
  const perfil = document.getElementById('u-perfil').value;

  // Validação e captura de refeitórios
  let refeitorios = [];
  if (perfil === 'REFEICAO') {
    const singleVal = document.getElementById('u-refeitorio-single')?.value;
    if (!singleVal) {
      alert('Para o perfil REFEICAO, você deve selecionar 1 refeitório autorizado.');
      return;
    }
    refeitorios = [parseInt(singleVal)];
  } else if (perfil === 'REFEICAO_MULTI') {
    const checkedBoxes = document.querySelectorAll('.u-ref-chk:checked');
    if (checkedBoxes.length === 0) {
      alert('Para o perfil REFEICAO MULTI, você deve selecionar pelo menos 1 refeitório autorizado.');
      return;
    }
    refeitorios = Array.from(checkedBoxes).map(cb => parseInt(cb.value));
  }

  const body = { nome, email, login, cpf, perfil, refeitorios };
  if (senha && senha.trim()) {
    body.senha = senha.trim();
  }

  try {
    let res;
    if (id) {
      res = await fetchAuth(`/users/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
    } else {
      if (!senha || !senha.trim()) {
        alert('A senha é obrigatória para novos usuários.');
        return;
      }
      res = await fetchAuth('/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
    }

    if (res.ok) {
      closeModal('user-modal');
      loadUsers();
      document.getElementById('create-user-form').reset();
    } else {
      const data = await res.json();
      alert(data.error || 'Erro ao salvar usuário.');
    }
  } catch (err) {
    console.error(err);
    alert('Erro de comunicação ao salvar usuário.');
  }
});

async function deleteUser(id) {
  if (!confirm('Deseja realmente excluir este usuário?')) return;
  try {
    const res = await fetchAuth(`/users/${id}`, { method: 'DELETE' });
    if (res.ok) {
      loadUsers();
    } else {
      const data = await res.json();
      alert(data.error || 'Erro ao excluir usuário.');
    }
  } catch (err) {
    console.error(err);
    alert('Erro de comunicação ao excluir usuário.');
  }
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

// ==================== REFEITÓRIOS ====================
async function loadRefeitorios() {
  const tbody = document.querySelector('#refeitorios-table tbody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 25px;"><i class="fa-solid fa-spinner fa-spin" style="font-size: 1.3rem; margin-right: 8px; color: var(--primary-color);"></i> Carregando refeitórios...</td></tr>';
  
  try {
    const res = await fetchAuth('/refeitorios');
    if (!res.ok) throw new Error('Erro ao buscar refeitórios');
    allRefeitorios = await res.json();

    if (allRefeitorios.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 20px;">Nenhum refeitório cadastrado. Clique em "+ Novo Refeitório" para cadastrar.</td></tr>';
      return;
    }

    tbody.innerHTML = allRefeitorios.map(r => `
      <tr>
        <td style="font-weight: 600;">#${r.id}</td>
        <td style="font-weight: 500;">${r.descricao}</td>
        <td><span class="badge ${r.ativo ? 'success' : 'danger'}">${r.ativo ? 'Ativo' : 'Inativo'}</span></td>
        <td>
          <button class="btn secondary-btn" onclick="openEditRefeitorioModal(${r.id})" title="Editar"><i class="fa-solid fa-pen"></i></button>
          <button class="btn secondary-btn" onclick="deleteRefeitorio(${r.id})" title="Excluir"><i class="fa-solid fa-trash"></i></button>
        </td>
      </tr>
    `).join('');

    populateRefeitoriosFilter(allRefeitorios);
  } catch (err) {
    console.error(err);
    tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--danger);">Erro ao carregar lista de refeitórios.</td></tr>';
  }
}

async function loadRefeitoriosOptions() {
  try {
    const res = await fetchAuth('/refeitorios');
    if (res.ok) {
      allRefeitorios = await res.json();
      populateRefeitoriosFilter(allRefeitorios);
    }
  } catch (e) {
    console.error('Erro ao carregar opções de refeitórios:', e);
  }
}

function populateRefeitoriosFilter(list) {
  const select = document.getElementById('refeicoes-refeitorio-filter');
  if (!select) return;
  const currentVal = select.value;
  select.innerHTML = '<option value="">Todos os Refeitórios</option>';
  (list || []).forEach(r => {
    const opt = document.createElement('option');
    opt.value = r.id;
    opt.innerText = r.descricao + (r.ativo ? '' : ' (Inativo)');
    select.appendChild(opt);
  });
  if (currentVal) select.value = currentVal;
}

function openCreateRefeitorioModal() {
  document.getElementById('refeitorio-modal-title').innerText = 'Novo Refeitório';
  document.getElementById('ref-id').value = '';
  document.getElementById('ref-descricao').value = '';
  document.getElementById('ref-status-group').style.display = 'none';
  document.getElementById('ref-ativo').checked = true;
  openModal('refeitorio-modal');
}

function openEditRefeitorioModal(id) {
  const ref = allRefeitorios.find(r => r.id === id);
  if (!ref) return;

  document.getElementById('refeitorio-modal-title').innerText = 'Editar Refeitório';
  document.getElementById('ref-id').value = ref.id;
  document.getElementById('ref-descricao').value = ref.descricao;
  document.getElementById('ref-status-group').style.display = 'block';
  document.getElementById('ref-ativo').checked = Boolean(ref.ativo);
  openModal('refeitorio-modal');
}

const refeitorioForm = document.getElementById('refeitorio-form');
if (refeitorioForm) {
  refeitorioForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('ref-id').value;
    const descricao = document.getElementById('ref-descricao').value.trim();
    const ativo = document.getElementById('ref-ativo').checked;

    if (!descricao) {
      alert('A descrição do refeitório é obrigatória.');
      return;
    }

    try {
      let res;
      if (id) {
        res = await fetchAuth(`/refeitorios/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ descricao, ativo })
        });
      } else {
        res = await fetchAuth('/refeitorios', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ descricao })
        });
      }

      if (res.ok) {
        closeModal('refeitorio-modal');
        loadRefeitorios();
      } else {
        const data = await res.json();
        alert(data.error || 'Erro ao salvar refeitório.');
      }
    } catch (err) {
      console.error(err);
      alert('Erro de comunicação ao salvar refeitório.');
    }
  });
}

async function deleteRefeitorio(id) {
  if (!confirm('Deseja realmente excluir ou inativar este refeitório?')) return;
  try {
    const res = await fetchAuth(`/refeitorios/${id}`, { method: 'DELETE' });
    if (res.ok) {
      if (res.status === 200) {
        const data = await res.json();
        alert(data.message || 'Refeitório inativado com sucesso.');
      }
      loadRefeitorios();
    } else {
      const data = await res.json();
      alert(data.error || 'Erro ao remover refeitório.');
    }
  } catch (err) {
    console.error(err);
    alert('Erro de comunicação ao remover refeitório.');
  }
}

// ==================== REFEIÇÕES (MARMITAS) ====================
let currentRefeicoesData = [];
let currentRefeicoesPage = 1;
const REFEICOES_PER_PAGE = 20;

async function loadLeiturasRefeicao() {
  const tbody = document.querySelector('#refeicoes-table tbody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 30px;"><i class="fa-solid fa-spinner fa-spin" style="font-size: 1.5rem; margin-right: 10px; color: var(--primary-color);"></i> Carregando leituras de refeições...</td></tr>';

  const dataInicial = document.getElementById('refeicoes-data-inicial')?.value;
  const dataFinal = document.getElementById('refeicoes-data-final')?.value;
  const horaInicial = document.getElementById('refeicoes-hora-inicial')?.value;
  const horaFinal = document.getElementById('refeicoes-hora-final')?.value;
  const idRefeitorio = document.getElementById('refeicoes-refeitorio-filter')?.value;
  const searchField = document.getElementById('refeicoes-search-field')?.value || 'matricula';
  const searchInput = document.getElementById('refeicoes-search-input')?.value.trim();

  const params = new URLSearchParams();
  if (dataInicial) params.append('dataInicial', dataInicial);
  if (dataFinal) params.append('dataFinal', dataFinal);
  if (horaInicial) params.append('horaInicial', horaInicial);
  if (horaFinal) params.append('horaFinal', horaFinal);
  if (idRefeitorio) params.append('id_refeitorio', idRefeitorio);
  if (searchInput) params.append(searchField, searchInput);

  try {
    const res = await fetchAuth(`/sync/leituras-refeicao?${params.toString()}`);
    if (!res.ok) throw new Error('Erro ao carregar leituras de refeições');
    let data = await res.json();

    // Se o usuário logou com perfil REFEICAO ou REFEICAO_MULTI e tem refeitórios selecionados
    const selecaoStr = localStorage.getItem('cprt_refeitorios_selecionados');
    if (selecaoStr && (userProfile === 'REFEICAO' || userProfile === 'REFEICAO_MULTI')) {
      try {
        const selecionados = JSON.parse(selecaoStr);
        const permitidosIds = selecionados.map(s => s.id);
        const permitidosDesc = selecionados.map(s => s.descricao.toLowerCase());
        
        // Se não filtrou por um refeitório específico, restringe aos refeitórios do login
        if (!idRefeitorio) {
          data = data.filter(item => {
            if (item.id_refeitorio && permitidosIds.includes(item.id_refeitorio)) return true;
            if (item.refeitorio && permitidosDesc.includes(String(item.refeitorio).toLowerCase())) return true;
            return false;
          });
        }
      } catch (e) {
        console.warn('Erro ao filtrar refeitórios da sessão:', e);
      }
    }

    currentRefeicoesData = data;
    currentRefeicoesPage = 1;
    renderRefeicoesPage();
  } catch (err) {
    console.error(err);
    tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: var(--danger);">Erro ao carregar dados de refeições.</td></tr>';
  }
}

function renderRefeicoesPage() {
  const tbody = document.querySelector('#refeicoes-table tbody');
  if (!tbody) return;
  const totalRecords = currentRefeicoesData.length;
  const totalPages = Math.ceil(totalRecords / REFEICOES_PER_PAGE) || 1;

  if (currentRefeicoesPage > totalPages) currentRefeicoesPage = totalPages;
  if (currentRefeicoesPage < 1) currentRefeicoesPage = 1;

  const totalCountEl = document.getElementById('refeicoes-total-count');
  if (totalCountEl) totalCountEl.innerText = `Total de registros: ${totalRecords}`;

  const pageInfoEl = document.getElementById('refeicoes-page-info');
  if (pageInfoEl) pageInfoEl.innerText = `Página ${currentRefeicoesPage} de ${totalPages}`;

  const prevBtn = document.getElementById('btn-refeicoes-prev');
  if (prevBtn) prevBtn.disabled = currentRefeicoesPage <= 1;

  const nextBtn = document.getElementById('btn-refeicoes-next');
  if (nextBtn) nextBtn.disabled = currentRefeicoesPage >= totalPages;

  if (!currentRefeicoesData || totalRecords === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 20px;">Nenhuma entrega de refeição encontrada para os filtros aplicados.</td></tr>';
    return;
  }

  const isHidden = (colIndex) => {
    const cb = document.querySelector(`#column-menu-refeicoes input[value="${colIndex}"]`);
    return cb && !cb.checked;
  };

  const startIndex = (currentRefeicoesPage - 1) * REFEICOES_PER_PAGE;
  const pageItems = currentRefeicoesData.slice(startIndex, startIndex + REFEICOES_PER_PAGE);

  tbody.innerHTML = pageItems.map(l => {
    const encarregadoNome = l.encarregado || l.nome_encarregado || 'Não Informado';
    const hasEncarregado = encarregadoNome && encarregadoNome !== 'Não Informado';
    return `
      <tr>
        <td data-col="0" class="${isHidden(0) ? 'hidden-col' : ''}">${l.matricula || '-'}</td>
        <td data-col="1" class="${isHidden(1) ? 'hidden-col' : ''}">${l.nome || 'N/A'}</td>
        <td data-col="2" class="${isHidden(2) ? 'hidden-col' : ''}">
          <span style="${hasEncarregado ? 'color: #93c5fd; font-weight: 500;' : 'color: var(--text-muted);'}">
            <i class="fa-solid fa-user-tie" style="font-size: 0.75rem; margin-right: 5px; opacity: 0.7;"></i>${encarregadoNome}
          </span>
        </td>
        <td data-col="3" class="${isHidden(3) ? 'hidden-col' : ''}">${l.credencial}</td>
        <td data-col="4" class="${isHidden(4) ? 'hidden-col' : ''}">${new Date(l.data_hora_leitura).toLocaleString()}</td>
        <td data-col="5" class="${isHidden(5) ? 'hidden-col' : ''}"><span style="font-weight: 600; color: #60a5fa;"><i class="fa-solid fa-utensils" style="font-size: 0.8rem; margin-right: 5px;"></i>${l.refeitorio || 'Não Informado'}</span></td>
        <td data-col="6" class="${isHidden(6) ? 'hidden-col' : ''}"><span class="badge ${l.situacao === 1 ? 'success' : 'danger'}">${l.situacao === 1 ? 'Permitido' : 'Bloqueado'}</span></td>
        <td data-col="7" class="${isHidden(7) ? 'hidden-col' : ''}">${l.id_celular}</td>
      </tr>
    `;
  }).join('');
}

function changeRefeicoesPage(delta) {
  currentRefeicoesPage += delta;
  renderRefeicoesPage();
}

function clearLeiturasRefeicaoFilters() {
  if (document.getElementById('refeicoes-data-inicial')) document.getElementById('refeicoes-data-inicial').value = '';
  if (document.getElementById('refeicoes-data-final')) document.getElementById('refeicoes-data-final').value = '';
  if (document.getElementById('refeicoes-hora-inicial')) document.getElementById('refeicoes-hora-inicial').value = '';
  if (document.getElementById('refeicoes-hora-final')) document.getElementById('refeicoes-hora-final').value = '';
  if (document.getElementById('refeicoes-refeitorio-filter')) document.getElementById('refeicoes-refeitorio-filter').value = '';
  if (document.getElementById('refeicoes-search-field')) document.getElementById('refeicoes-search-field').value = 'matricula';
  if (document.getElementById('refeicoes-search-input')) document.getElementById('refeicoes-search-input').value = '';
  loadLeiturasRefeicao();
}

function toggleColumnMenuRefeicoes() {
  const menu = document.getElementById('column-menu-refeicoes');
  if (menu) menu.classList.toggle('hidden');
}

function toggleColumnRefeicoes(colIndex) {
  const checkbox = document.querySelector(`#column-menu-refeicoes input[value="${colIndex}"]`);
  if (!checkbox) return;
  const isChecked = checkbox.checked;
  const th = document.querySelector(`#refeicoes-table th[data-col="${colIndex}"]`);
  const tds = document.querySelectorAll(`#refeicoes-table td[data-col="${colIndex}"]`);

  if (isChecked) {
    if (th) th.classList.remove('hidden-col');
    tds.forEach(td => td.classList.remove('hidden-col'));
  } else {
    if (th) th.classList.add('hidden-col');
    tds.forEach(td => td.classList.add('hidden-col'));
  }
}

document.addEventListener('click', (e) => {
  const menu = document.getElementById('column-menu-refeicoes');
  const btn = document.querySelector('button[onclick="toggleColumnMenuRefeicoes()"]');
  if (menu && btn && !menu.classList.contains('hidden') && !menu.contains(e.target) && !btn.contains(e.target)) {
    menu.classList.add('hidden');
  }
});

function exportLeiturasRefeicaoExcel() {
  if (!currentRefeicoesData || currentRefeicoesData.length === 0) return;

  const isHidden = (colIndex) => {
    const cb = document.querySelector(`#column-menu-refeicoes input[value="${colIndex}"]`);
    return cb && !cb.checked;
  };

  const columnsMap = [
    { index: 0, title: 'Matrícula', key: l => l.matricula || '-' },
    { index: 1, title: 'Nome', key: l => l.nome || 'N/A' },
    { index: 2, title: 'Encarregado', key: l => l.encarregado || l.nome_encarregado || 'Não Informado' },
    { index: 3, title: 'Credencial', key: l => l.credencial },
    { index: 4, title: 'Data/Hora Leitura', key: l => new Date(l.data_hora_leitura).toLocaleString() },
    { index: 5, title: 'Refeitório', key: l => l.refeitorio || 'Não Informado' },
    { index: 6, title: 'Situação', key: l => l.situacao === 1 ? 'Permitido' : 'Bloqueado' },
    { index: 7, title: 'ID Celular', key: l => l.id_celular }
  ];

  const activeColumns = columnsMap.filter(col => !isHidden(col.index));

  const exportData = currentRefeicoesData.map(l => {
    const row = {};
    activeColumns.forEach(col => {
      row[col.title] = col.key(l);
    });
    return row;
  });

  const ws = XLSX.utils.json_to_sheet(exportData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Refeições");
  XLSX.writeFile(wb, 'leituras_refeicoes.xlsx');
}

function exportLeiturasRefeicaoPDF() {
  if (!currentRefeicoesData || currentRefeicoesData.length === 0) return;
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF('l', 'pt', 'a4');

  const isHidden = (colIndex) => {
    const cb = document.querySelector(`#column-menu-refeicoes input[value="${colIndex}"]`);
    return cb && !cb.checked;
  };

  const columnsMap = [
    { index: 0, title: 'Matrícula', key: l => l.matricula || '-' },
    { index: 1, title: 'Nome', key: l => l.nome || 'N/A' },
    { index: 2, title: 'Encarregado', key: l => l.encarregado || l.nome_encarregado || 'Não Informado' },
    { index: 3, title: 'Credencial', key: l => l.credencial },
    { index: 4, title: 'Data/Hora Leitura', key: l => new Date(l.data_hora_leitura).toLocaleString() },
    { index: 5, title: 'Refeitório', key: l => l.refeitorio || 'Não Informado' },
    { index: 6, title: 'Situação', key: l => l.situacao === 1 ? 'Permitido' : 'Bloqueado' },
    { index: 7, title: 'ID Celular', key: l => l.id_celular }
  ];

  const activeColumns = columnsMap.filter(col => !isHidden(col.index));
  const headers = activeColumns.map(col => col.title);
  const data = currentRefeicoesData.map(l => activeColumns.map(col => col.key(l)));

  doc.text("Relatório de Entregas de Refeições (Marmitas)", 40, 40);

  doc.autoTable({
    head: [headers],
    body: data,
    startY: 50,
    theme: 'grid',
    styles: { fontSize: 8 },
    headStyles: { fillColor: [59, 130, 246] }
  });

  doc.save('leituras_refeicoes.pdf');
}

// ==================== IMPORTAÇÃO DE ENCARREGADOS (EXCEL) ====================
function openImportarEncarregadosModal() {
  const form = document.getElementById('importar-encarregados-form');
  if (form) form.reset();
  const statusDiv = document.getElementById('importar-encarregados-status');
  if (statusDiv) {
    statusDiv.style.display = 'none';
    statusDiv.innerHTML = '';
  }
  const btn = document.getElementById('btn-submit-encarregados');
  if (btn) btn.disabled = false;
  openModal('importar-encarregados-modal');
}

const encarregadosForm = document.getElementById('importar-encarregados-form');
if (encarregadosForm) {
  encarregadosForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fileInput = document.getElementById('encarregados-file-input');
    const statusDiv = document.getElementById('importar-encarregados-status');
    const btn = document.getElementById('btn-submit-encarregados');

    if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
      alert('Selecione um arquivo Excel para importar.');
      return;
    }

    const file = fileInput.files[0];
    const formData = new FormData();
    formData.append('file', file);

    btn.disabled = true;
    statusDiv.style.display = 'block';
    statusDiv.style.background = 'rgba(59, 130, 246, 0.15)';
    statusDiv.style.color = '#93c5fd';
    statusDiv.style.border = '1px solid rgba(59, 130, 246, 0.3)';
    statusDiv.innerHTML = '<i class="fa-solid fa-spinner fa-spin" style="margin-right: 8px;"></i> Processando planilha, comparando nomes e vinculando encarregados...';

    try {
      const res = await fetchAuth('/pessoas/importar-encarregados', {
        method: 'POST',
        body: formData,
        isFormData: true
      });

      const data = await res.json();

      if (res.ok) {
        statusDiv.style.background = 'rgba(16, 185, 129, 0.15)';
        statusDiv.style.color = '#34d399';
        statusDiv.style.border = '1px solid rgba(16, 185, 129, 0.3)';
        statusDiv.innerHTML = `
          <strong><i class="fa-solid fa-circle-check"></i> Sucesso!</strong><br>
          ${data.vinculadosPessoas} colaboradores vinculados aos seus encarregados.<br>
          ${data.leiturasAtualizadasCount} leituras no histórico atualizadas retroativamente.
        `;

        loadLeiturasRefeicao();

        setTimeout(() => {
          closeModal('importar-encarregados-modal');
        }, 2500);
      } else {
        statusDiv.style.background = 'rgba(239, 68, 68, 0.15)';
        statusDiv.style.color = '#f87171';
        statusDiv.style.border = '1px solid rgba(239, 68, 68, 0.3)';
        statusDiv.innerHTML = `<strong><i class="fa-solid fa-circle-xmark"></i> Erro:</strong> ${data.error || 'Falha ao processar arquivo.'}`;
        btn.disabled = false;
      }
    } catch (err) {
      console.error(err);
      statusDiv.style.background = 'rgba(239, 68, 68, 0.15)';
      statusDiv.style.color = '#f87171';
      statusDiv.style.border = '1px solid rgba(239, 68, 68, 0.3)';
      statusDiv.innerHTML = '<strong><i class="fa-solid fa-circle-xmark"></i> Erro:</strong> Falha de comunicação ao enviar arquivo.';
      btn.disabled = false;
    }
  });
}

// Expõe globalmente e anexa evento ao botão
window.openImportarEncarregadosModal = openImportarEncarregadosModal;

document.addEventListener('DOMContentLoaded', () => {
  const btnOpen = document.getElementById('btn-open-importar-encarregados');
  if (btnOpen) {
    btnOpen.addEventListener('click', (e) => {
      e.preventDefault();
      openImportarEncarregadosModal();
    });
  }
});




