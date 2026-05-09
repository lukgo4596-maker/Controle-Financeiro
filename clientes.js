import { initializeApp } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js";
import { 
  getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, getDocs, 
  query, where, orderBy 
} from "https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBLIDFDlZ4kjpHkjtg-3zsXrsWMvdbZ8Yc",
  authDomain: "cida-53b7d.firebaseapp.com",
  projectId: "cida-53b7d",
  storageBucket: "cida-53b7d.firebasestorage.app",
  messagingSenderId: "406187781864",
  appId: "1:406187781864:web:efdefa741bc5afceee235d"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// References
const clientesRef = collection(db, "clientes");
const dividasRef = collection(db, "dividas");

// State
let clientes = [];
let dividas = [];
let currentClienteId = null;
let currentFilter = "all";
let currentSort = "nome";

// DOM Elements
const clientesListDiv = document.getElementById("clientesList");
const searchInput = document.getElementById("searchInput");
const filterChips = document.querySelectorAll(".filter-chip");
const sortSelect = document.getElementById("sortSelect");
const fabAddBtn = document.getElementById("fabAddBtn");
const menuButton = document.getElementById("menuButton");
const dropdownMenu = document.getElementById("dropdownMenu");
const backButton = document.getElementById("backButton");

// Modals
const clienteModal = document.getElementById("clienteModal");
const detalhesModal = document.getElementById("detalhesModal");
const dividaModal = document.getElementById("dividaModal");
const clienteForm = document.getElementById("clienteForm");
const dividaForm = document.getElementById("dividaForm");

// Helper: format currency
function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

// Helper: format date
function formatDate(dateString) {
  if (!dateString) return "—";
  const [year, month, day] = dateString.split("-");
  return `${day}/${month}/${year}`;
}

// Helper: format phone
function formatPhone(value) {
  let numbers = value.replace(/\D/g, '');
  if (numbers.length <= 2) return numbers;
  if (numbers.length <= 6) return numbers.replace(/(\d{2})(\d{0,4})/, '($1) $2');
  if (numbers.length <= 10) return numbers.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3');
  return numbers.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3');
}

// Apply money mask
function setupMoneyMask() {
  const moneyInput = document.getElementById("dividaValorTotal");
  if (moneyInput) {
    moneyInput.addEventListener("input", function(e) {
      let value = e.target.value.replace(/\D/g, '');
      value = (parseInt(value) / 100).toFixed(2);
      if (isNaN(parseFloat(value))) value = "0.00";
      e.target.value = `R$ ${formatNumberWithDots(parseFloat(value))}`;
      updateParcelaDisplay();
    });
  }
}

function formatNumberWithDots(number) {
  return number.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parseMoneyValue(moneyString) {
  if (!moneyString) return 0;
  const cleanValue = moneyString.replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.');
  return parseFloat(cleanValue) || 0;
}

function updateParcelaDisplay() {
  const valorTotalStr = document.getElementById("dividaValorTotal").value;
  const valorTotal = parseMoneyValue(valorTotalStr);
  const parcelas = parseInt(document.getElementById("dividaParcelas").value);
  const valorParcela = valorTotal / parcelas;
  document.getElementById("valorParcelaDisplay").innerHTML = formatCurrency(valorParcela);
}

// Setup phone mask
function setupPhoneMask() {
  const phoneInput = document.getElementById("clienteTelefone");
  if (phoneInput) {
    phoneInput.addEventListener("input", function(e) {
      e.target.value = formatPhone(e.target.value);
    });
  }
}

// Load all data
async function loadData() {
  await loadClientes();
  await loadDividas();
  renderClientes();
}

// Load clientes from Firebase
async function loadClientes() {
  try {
    const snapshot = await getDocs(clientesRef);
    clientes = [];
    snapshot.forEach(doc => {
      clientes.push({ id: doc.id, ...doc.data() });
    });
  } catch (error) {
    console.error("Erro ao carregar clientes:", error);
  }
}

// Load dividas from Firebase
async function loadDividas() {
  try {
    const snapshot = await getDocs(dividasRef);
    dividas = [];
    snapshot.forEach(doc => {
      dividas.push({ id: doc.id, ...doc.data() });
    });
  } catch (error) {
    console.error("Erro ao carregar dívidas:", error);
  }
}

// Get dividas by cliente
function getDividasByCliente(clienteId) {
  return dividas.filter(d => d.clienteId === clienteId);
}

// Calculate total pendente for a cliente
function getTotalPendente(clienteId) {
  const dividasCliente = getDividasByCliente(clienteId);
  return dividasCliente
    .filter(d => d.status === "pendente")
    .reduce((sum, d) => sum + (d.valorParcela * (d.parcelasRestantes || d.parcelas)), 0);
}

// Get oldest pending debt date
function getOldestDebtDate(clienteId) {
  const dividasCliente = getDividasByCliente(clienteId).filter(d => d.status === "pendente");
  if (dividasCliente.length === 0) return null;
  const dates = dividasCliente.map(d => new Date(d.dataPagamento));
  return new Date(Math.min(...dates));
}

// Sort clientes
function sortClientes(clientesArray) {
  const sorted = [...clientesArray];
  
  switch (currentSort) {
    case "nome":
      sorted.sort((a, b) => a.nome.localeCompare(b.nome));
      break;
    case "valor":
      sorted.sort((a, b) => {
        const totalA = getTotalPendente(a.id);
        const totalB = getTotalPendente(b.id);
        return totalB - totalA;
      });
      break;
    case "tempo":
      sorted.sort((a, b) => {
        const dateA = getOldestDebtDate(a.id);
        const dateB = getOldestDebtDate(b.id);
        if (!dateA && !dateB) return 0;
        if (!dateA) return 1;
        if (!dateB) return -1;
        return dateA - dateB;
      });
      break;
  }
  return sorted;
}

// Filter clientes
function filterClientes(clientesArray) {
  if (currentFilter === "all") return clientesArray;
  if (currentFilter === "active") {
    return clientesArray.filter(c => getTotalPendente(c.id) > 0);
  }
  if (currentFilter === "paid") {
    return clientesArray.filter(c => getTotalPendente(c.id) === 0 && getDividasByCliente(c.id).length > 0);
  }
  return clientesArray;
}

// Search clientes
function searchClientes(clientesArray, searchTerm) {
  if (!searchTerm) return clientesArray;
  const term = searchTerm.toLowerCase();
  return clientesArray.filter(c => c.nome.toLowerCase().includes(term));
}

// Render clientes list
function renderClientes() {
  let filtered = filterClientes(clientes);
  filtered = searchClientes(filtered, searchInput.value);
  const sorted = sortClientes(filtered);
  
  if (sorted.length === 0) {
    clientesListDiv.innerHTML = '<div class="empty-state">Nenhum cliente encontrado</div>';
    return;
  }
  
  clientesListDiv.innerHTML = "";
  sorted.forEach(cliente => {
    const totalPendente = getTotalPendente(cliente.id);
    const hasDebts = getDividasByCliente(cliente.id).length > 0;
    const status = totalPendente > 0 ? "pendente" : (hasDebts ? "pago" : "sem dividas");
    
    const card = document.createElement("div");
    card.className = "cliente-card";
    card.innerHTML = `
      <div class="cliente-header">
        <span class="cliente-nome">${escapeHtml(cliente.nome)}</span>
        <span class="cliente-status ${status === "pendente" ? "status-pendente" : "status-pago"}">
          ${status === "pendente" ? "Com pendências" : (status === "pago" ? "Pago" : "Sem dívidas")}
        </span>
      </div>
      <div class="cliente-detalhes">
        <span class="cliente-total">${formatCurrency(totalPendente)}</span>
        <span class="cliente-data">${cliente.telefone || "Sem telefone"}</span>
      </div>
    `;
    card.addEventListener("click", () => openDetalhesModal(cliente.id));
    clientesListDiv.appendChild(card);
  });
}

// Open detalhes modal
async function openDetalhesModal(clienteId) {
  currentClienteId = clienteId;
  const cliente = clientes.find(c => c.id === clienteId);
  
  document.getElementById("detalhesClienteNome").innerText = cliente.nome;
  document.getElementById("detalhesTelefone").innerText = cliente.telefone || "Não informado";
  
  const totalPendente = getTotalPendente(clienteId);
  document.getElementById("detalhesTotalPendente").innerHTML = formatCurrency(totalPendente);
  document.getElementById("detalhesCriadoEm").innerText = cliente.criadoEm ? formatDate(cliente.criadoEm.split('T')[0]) : "—";
  
  await renderDividas(clienteId);
  detalhesModal.classList.remove("hidden");
}

// Render dividas for a cliente
async function renderDividas(clienteId) {
  const dividasCliente = getDividasByCliente(clienteId);
  const dividasListDiv = document.getElementById("dividasList");
  
  if (dividasCliente.length === 0) {
    dividasListDiv.innerHTML = '<div class="empty-state">Nenhuma dívida cadastrada</div>';
    return;
  }
  
  dividasListDiv.innerHTML = "";
  dividasCliente.forEach(divida => {
    const valorTotalRestante = divida.valorParcela * (divida.parcelasRestantes || divida.parcelas);
    const parcelasInfo = `${divida.parcelas}x de ${formatCurrency(divida.valorParcela)}`;
    
    const item = document.createElement("div");
    item.className = "divida-item";
    item.innerHTML = `
      <div class="divida-header">
        <span class="divida-produto">${escapeHtml(divida.produto)}</span>
        <span class="divida-status ${divida.status === "pendente" ? "status-pendente" : "status-pago"}">
          ${divida.status === "pendente" ? "Pendente" : "Pago"}
        </span>
      </div>
      <div class="divida-detalhes">
        <span class="divida-valor">${formatCurrency(valorTotalRestante)}</span>
        <span class="divida-data">${parcelasInfo}</span>
      </div>
      <div class="divida-detalhes">
        <span class="divida-data">📅 Início: ${formatDate(divida.dataPagamento)}</span>
        <span class="divida-data">📆 Criada: ${formatDate(divida.criadoEm ? divida.criadoEm.split('T')[0] : new Date().toISOString().split('T')[0])}</span>
      </div>
      ${divida.observacoes ? `<div class="divida-obs">📝 ${escapeHtml(divida.observacoes)}</div>` : ""}
      <div class="divida-actions">
        ${divida.status === "pendente" ? `<button class="btn-pagar" data-id="${divida.id}">✓ Marcar pago</button>` : ""}
        <button class="btn-editar" data-id="${divida.id}">✎ Editar</button>
      </div>
    `;
    
    const pagarBtn = item.querySelector(".btn-pagar");
    const editarBtn = item.querySelector(".btn-editar");
    
    if (pagarBtn) pagarBtn.addEventListener("click", () => marcarPago(divida.id));
    editarBtn.addEventListener("click", () => openDividaModal(divida));
    
    dividasListDiv.appendChild(item);
  });
}

// Marcar divida como paga
async function marcarPago(dividaId) {
  const divida = dividas.find(d => d.id === dividaId);
  if (!divida) return;
  
  try {
    await updateDoc(doc(db, "dividas", dividaId), {
      status: "pago",
      dataPagamentoReal: new Date().toISOString().split("T")[0]
    });
    await loadDividas();
    await renderDividas(currentClienteId);
    renderClientes();
  } catch (error) {
    console.error("Erro ao marcar como pago:", error);
    alert("Erro ao atualizar status");
  }
}

// Open cliente modal
function openClienteModal(cliente = null) {
  if (cliente) {
    document.getElementById("clienteModalTitle").innerText = "Editar Cliente";
    document.getElementById("clienteId").value = cliente.id;
    document.getElementById("clienteNome").value = cliente.nome;
    document.getElementById("clienteTelefone").value = cliente.telefone || "";
  } else {
    document.getElementById("clienteModalTitle").innerText = "Novo Cliente";
    document.getElementById("clienteId").value = "";
    clienteForm.reset();
  }
  clienteModal.classList.remove("hidden");
}

// Open divida modal
function openDividaModal(divida = null) {
  if (divida) {
    document.getElementById("dividaModalTitle").innerText = "Editar Dívida";
    document.getElementById("dividaId").value = divida.id;
    document.getElementById("dividaProduto").value = divida.produto;
    document.getElementById("dividaValorTotal").value = `R$ ${divida.valorTotal.toFixed(2).replace('.', ',')}`;
    document.getElementById("dividaParcelas").value = divida.parcelas;
    document.getElementById("dividaDataPagamento").value = divida.dataPagamento;
    document.getElementById("dividaStatus").value = divida.status;
    document.getElementById("dividaObservacoes").value = divida.observacoes || "";
    updateParcelaDisplay();
  } else {
    document.getElementById("dividaModalTitle").innerText = "Nova Dívida";
    document.getElementById("dividaId").value = "";
    dividaForm.reset();
    document.getElementById("dividaParcelas").value = "1";
    document.getElementById("dividaStatus").value = "pendente";
    document.getElementById("dividaDataPagamento").value = new Date().toISOString().split("T")[0];
    updateParcelaDisplay();
  }
  document.getElementById("dividaClienteId").value = currentClienteId;
  dividaModal.classList.remove("hidden");
}

// Save cliente
async function saveCliente(e) {
  e.preventDefault();
  const id = document.getElementById("clienteId").value;
  const data = {
    nome: document.getElementById("clienteNome").value.trim(),
    telefone: document.getElementById("clienteTelefone").value,
    atualizadoEm: new Date().toISOString()
  };
  
  try {
    if (id) {
      await updateDoc(doc(db, "clientes", id), data);
    } else {
      data.criadoEm = new Date().toISOString();
      await addDoc(clientesRef, data);
    }
    await loadClientes();
    renderClientes();
    clienteModal.classList.add("hidden");
  } catch (error) {
    console.error("Erro ao salvar cliente:", error);
    alert("Erro ao salvar cliente");
  }
}

// Save divida
async function saveDivida(e) {
  e.preventDefault();
  const id = document.getElementById("dividaId").value;
  const clienteId = document.getElementById("dividaClienteId").value;
  const valorTotal = parseMoneyValue(document.getElementById("dividaValorTotal").value);
  const parcelas = parseInt(document.getElementById("dividaParcelas").value);
  const valorParcela = valorTotal / parcelas;
  
  if (isNaN(valorTotal) || valorTotal <= 0) {
    alert("Valor inválido");
    return;
  }
  
  const data = {
    clienteId: clienteId,
    produto: document.getElementById("dividaProduto").value.trim(),
    valorTotal: valorTotal,
    parcelas: parcelas,
    valorParcela: valorParcela,
    parcelasRestantes: parcelas,
    dataPagamento: document.getElementById("dividaDataPagamento").value,
    status: document.getElementById("dividaStatus").value,
    observacoes: document.getElementById("dividaObservacoes").value,
    atualizadoEm: new Date().toISOString()
  };
  
  try {
    if (id) {
      await updateDoc(doc(db, "dividas", id), data);
    } else {
      data.criadoEm = new Date().toISOString();
      await addDoc(dividasRef, data);
    }
    await loadDividas();
    await renderDividas(clienteId);
    renderClientes();
    dividaModal.classList.add("hidden");
  } catch (error) {
    console.error("Erro ao salvar dívida:", error);
    alert("Erro ao salvar dívida");
  }
}

// Escape HTML
function escapeHtml(str) {
  if (!str) return "";
  return str.replace(/[&<>]/g, function(m) {
    if (m === "&") return "&amp;";
    if (m === "<") return "&lt;";
    if (m === ">") return "&gt;";
    return m;
  });
}

// Event listeners
function setupEventListeners() {
  searchInput.addEventListener("input", () => renderClientes());
  
  filterChips.forEach(chip => {
    chip.addEventListener("click", () => {
      filterChips.forEach(c => c.classList.remove("active"));
      chip.classList.add("active");
      currentFilter = chip.dataset.filter;
      renderClientes();
    });
  });
  
  sortSelect.addEventListener("change", (e) => {
    currentSort = e.target.value;
    renderClientes();
  });
  
  fabAddBtn.addEventListener("click", () => openClienteModal());
  
  menuButton.addEventListener("click", (e) => {
    e.stopPropagation();
    dropdownMenu.classList.toggle("hidden");
  });
  
  document.addEventListener("click", (e) => {
    if (!menuButton.contains(e.target) && !dropdownMenu.contains(e.target)) {
      dropdownMenu.classList.add("hidden");
    }
  });
  
  backButton.addEventListener("click", () => {
    window.location.href = "index.html";
  });
  
  // Close modals
  document.getElementById("closeClienteModal").addEventListener("click", () => clienteModal.classList.add("hidden"));
  document.getElementById("cancelClienteBtn").addEventListener("click", () => clienteModal.classList.add("hidden"));
  document.getElementById("closeDetalhesModal").addEventListener("click", () => detalhesModal.classList.add("hidden"));
  document.getElementById("closeDividaModal").addEventListener("click", () => dividaModal.classList.add("hidden"));
  document.getElementById("cancelDividaBtn").addEventListener("click", () => dividaModal.classList.add("hidden"));
  document.getElementById("editarClienteBtn").addEventListener("click", () => {
    const cliente = clientes.find(c => c.id === currentClienteId);
    detalhesModal.classList.add("hidden");
    openClienteModal(cliente);
  });
  document.getElementById("btnNovaDivida").addEventListener("click", () => openDividaModal());
  
  document.getElementById("dividaParcelas").addEventListener("change", updateParcelaDisplay);
  
  clienteForm.addEventListener("submit", saveCliente);
  dividaForm.addEventListener("submit", saveDivida);
  
  // Close modals on overlay click
  [clienteModal, detalhesModal, dividaModal].forEach(modal => {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) modal.classList.add("hidden");
    });
  });
}

// Initialize
setupEventListeners();
setupMoneyMask();
setupPhoneMask();
loadData();