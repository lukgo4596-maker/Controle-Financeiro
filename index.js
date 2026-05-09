import { initializeApp } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js";
import { getFirestore, collection, getDocs } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js";

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

// DOM elements
const totalToReceiveSpan = document.getElementById("totalToReceive");
const activeClientsCountSpan = document.getElementById("activeClientsCount");
const nextDueClientSpan = document.querySelector(".next-due-client");
const nextDueValueSpan = document.querySelector(".next-due-value");
const pendingListDiv = document.getElementById("pendingList");
const menuButton = document.getElementById("menuButton");
const dropdownMenu = document.getElementById("dropdownMenu");

// Data stores
let clientes = [];
let dividas = [];

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

// Get cliente by ID
function getClienteById(clienteId) {
  return clientes.find(c => c.id === clienteId);
}

// Get active clients (with pending debts)
function getActiveClientsCount() {
  const clientesComDividas = new Set();
  dividas.forEach(d => {
    if (d.status === "pendente") {
      clientesComDividas.add(d.clienteId);
    }
  });
  return clientesComDividas.size;
}

// Get total to receive (sum of all pending debts)
function getTotalToReceive() {
  let total = 0;
  dividas.forEach(d => {
    if (d.status === "pendente") {
      const valorRestante = d.valorParcela * (d.parcelasRestantes || d.parcelas);
      total += valorRestante;
    }
  });
  return total;
}

// Get next due date (closest date from pending debts)
function getNextDueInfo() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const pendingDebts = dividas.filter(d => d.status === "pendente");
  
  if (pendingDebts.length === 0) {
    return { cliente: "Nenhum cliente com pendência", valor: null, data: null };
  }
  
  // Find the closest dataPagamento
  let closestDebt = null;
  let closestDate = null;
  
  pendingDebts.forEach(debt => {
    const debtDate = new Date(debt.dataPagamento);
    if (!closestDate || (debtDate >= today && debtDate < closestDate)) {
      closestDate = debtDate;
      closestDebt = debt;
    }
  });
  
  if (!closestDebt) {
    return { cliente: "Nenhum vencimento futuro", valor: null, data: null };
  }
  
  const cliente = getClienteById(closestDebt.clienteId);
  const valorRestante = closestDebt.valorParcela * (closestDebt.parcelasRestantes || closestDebt.parcelas);
  
  return {
    cliente: cliente ? cliente.nome : "Cliente desconhecido",
    valor: valorRestante,
    data: closestDebt.dataPagamento
  };
}

// Get recent pending debts (last 5 by date)
function getRecentPendingDebts() {
  const pendingDebts = dividas.filter(d => d.status === "pendente");
  
  // Sort by dataPagamento (oldest first for priority)
  pendingDebts.sort((a, b) => new Date(a.dataPagamento) - new Date(b.dataPagamento));
  
  // Return first 5
  return pendingDebts.slice(0, 5);
}

// Update dashboard
function updateDashboard() {
  const total = getTotalToReceive();
  totalToReceiveSpan.innerText = formatCurrency(total);
  
  const activeCount = getActiveClientsCount();
  activeClientsCountSpan.innerText = activeCount;
  
  const nextInfo = getNextDueInfo();
  if (nextInfo.cliente === "Nenhum cliente com pendência") {
    nextDueClientSpan.innerText = nextInfo.cliente;
    nextDueValueSpan.innerText = "—";
  } else {
    nextDueClientSpan.innerText = nextInfo.cliente;
    nextDueValueSpan.innerText = formatCurrency(nextInfo.valor);
  }
}

// Render pending list
function renderPendingList() {
  const recentDebts = getRecentPendingDebts();
  
  if (recentDebts.length === 0) {
    pendingListDiv.innerHTML = '<div class="empty-state">Nenhuma pendência no momento ✨</div>';
    return;
  }
  
  pendingListDiv.innerHTML = "";
  recentDebts.forEach(debt => {
    const cliente = getClienteById(debt.clienteId);
    const valorRestante = debt.valorParcela * (debt.parcelasRestantes || debt.parcelas);
    const parcelasInfo = `${debt.parcelas}x de ${formatCurrency(debt.valorParcela)}`;
    
    const debtEl = document.createElement("div");
    debtEl.className = "debt-item";
    debtEl.innerHTML = `
      <div class="debt-info">
        <div class="debt-client">
          <span>${escapeHtml(cliente ? cliente.nome : "Cliente desconhecido")}</span>
          <span class="status-badge status-pending">Pendente</span>
        </div>
        <div class="debt-produto">${escapeHtml(debt.produto)}</div>
        <div class="debt-details">
          <span class="debt-amount">${formatCurrency(valorRestante)}</span>
          <span class="debt-date">Início: ${formatDate(debt.dataPagamento)}</span>
        </div>
        <div class="debt-parcelas">${parcelasInfo}</div>
      </div>
    `;
    pendingListDiv.appendChild(debtEl);
  });
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

// Set current date
function setCurrentDate() {
  const today = new Date();
  const options = { day: '2-digit', month: '2-digit', year: 'numeric' };
  const dateElement = document.getElementById("currentDate");
  if (dateElement) {
    dateElement.innerText = today.toLocaleDateString('pt-BR');
  }
}

// Menu toggle
function setupMenu() {
  if (!menuButton || !dropdownMenu) return;
  
  menuButton.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdownMenu.classList.toggle('hidden');
  });
  
  document.addEventListener('click', (e) => {
    if (!menuButton.contains(e.target) && !dropdownMenu.contains(e.target)) {
      dropdownMenu.classList.add('hidden');
    }
  });
}

// Load data from Firebase
async function loadData() {
  pendingListDiv.innerHTML = '<div class="loading-placeholder">Carregando dados...</div>';
  
  try {
    // Load clientes
    const clientesSnapshot = await getDocs(collection(db, "clientes"));
    clientes = [];
    clientesSnapshot.forEach(doc => {
      clientes.push({ id: doc.id, ...doc.data() });
    });
    
    // Load dividas
    const dividasSnapshot = await getDocs(collection(db, "dividas"));
    dividas = [];
    dividasSnapshot.forEach(doc => {
      dividas.push({ id: doc.id, ...doc.data() });
    });
    
    // Update UI
    updateDashboard();
    renderPendingList();
    
  } catch (error) {
    console.error("Erro ao carregar dados:", error);
    pendingListDiv.innerHTML = '<div class="empty-state">⚠️ Erro ao carregar dados do Firebase</div>';
    
    // Dados de exemplo para teste
    const exampleClientes = [
      { id: "1", nome: "Maria Silva", telefone: "(11) 99999-9999" },
      { id: "2", nome: "João Santos", telefone: "(11) 98888-8888" }
    ];
    
    const exampleDividas = [
      {
        id: "d1",
        clienteId: "1",
        produto: "Perfume Importado",
        valorTotal: 250,
        parcelas: 2,
        valorParcela: 125,
        parcelasRestantes: 2,
        dataPagamento: "2026-05-20",
        status: "pendente",
        observacoes: "",
        criadoEm: new Date().toISOString()
      },
      {
        id: "d2",
        clienteId: "2",
        produto: "Bolo de Chocolate",
        valorTotal: 150,
        parcelas: 3,
        valorParcela: 50,
        parcelasRestantes: 3,
        dataPagamento: "2026-05-15",
        status: "pendente",
        observacoes: "",
        criadoEm: new Date().toISOString()
      }
    ];
    
    clientes = exampleClientes;
    dividas = exampleDividas;
    updateDashboard();
    renderPendingList();
  }
}

// Initialize
setCurrentDate();
setupMenu();
loadData();