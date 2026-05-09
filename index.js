import { initializeApp } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBLIDFDlZ4kjpHkjtg-3zsXrsWMvdbZ8Yc",
  authDomain: "cida-53b7d.firebaseapp.com",
  projectId: "cida-53b7d",
  storageBucket: "cida-53b7d.firebasestorage.app",
  messagingSenderId: "406187781864",
  appId: "1:406187781864:web:efdefa741bc5afceee235d"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// DOM Elements
const loginForm = document.getElementById("loginForm");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const loginBtn = document.getElementById("loginBtn");
const togglePasswordBtn = document.getElementById("togglePassword");
const errorMessageDiv = document.getElementById("errorMessage");

// Toggle password visibility
togglePasswordBtn.addEventListener("click", () => {
  const type = passwordInput.type === "password" ? "text" : "password";
  passwordInput.type = type;
  
  // Change icon
  const icon = togglePasswordBtn.querySelector("svg");
  if (type === "text") {
    icon.innerHTML = `
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    `;
  } else {
    icon.innerHTML = `
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    `;
  }
});

// Show error message
function showError(message) {
  errorMessageDiv.textContent = message;
  errorMessageDiv.classList.remove("hidden");
  
  // Auto hide after 3 seconds
  setTimeout(() => {
    errorMessageDiv.classList.add("hidden");
  }, 3000);
}

// Login function
async function login(email, password) {
  // Disable button while loading
  loginBtn.disabled = true;
  loginBtn.style.opacity = "0.7";
  const originalText = loginBtn.innerHTML;
  loginBtn.innerHTML = `
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation: spin 1s linear infinite;">
      <circle cx="12" cy="12" r="10"/>
      <path d="M12 2a10 10 0 0 1 10 10"/>
    </svg>
    <span>Entrando...</span>
  `;
  
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // Login successful - redirect to dashboard
    window.location.href = "dashboard.html";
    
  } catch (error) {
    console.error("Erro no login:", error);
    
    let errorMessage = "Erro ao fazer login. ";
    switch (error.code) {
      case "auth/invalid-email":
        errorMessage = "E-mail inválido. Verifique o formato do e-mail.";
        break;
      case "auth/user-not-found":
        errorMessage = "Usuário não encontrado. Verifique o e-mail.";
        break;
      case "auth/wrong-password":
        errorMessage = "Senha incorreta. Tente novamente.";
        break;
      case "auth/too-many-requests":
        errorMessage = "Muitas tentativas. Tente novamente mais tarde.";
        break;
      default:
        errorMessage = "Erro ao fazer login. Verifique suas credenciais.";
    }
    showError(errorMessage);
  } finally {
    // Re-enable button
    loginBtn.disabled = false;
    loginBtn.style.opacity = "1";
    loginBtn.innerHTML = originalText;
  }
}

// Handle form submit
loginForm.addEventListener("submit", (e) => {
  e.preventDefault();
  
  const email = emailInput.value.trim();
  const password = passwordInput.value;
  
  if (!email || !password) {
    showError("Preencha todos os campos.");
    return;
  }
  
  login(email, password);
});

// Check if user is already logged in
auth.onAuthStateChanged((user) => {
  if (user) {
    // User is already logged in, redirect to dashboard
    window.location.href = "dashboard.html";
  }
});

// Add spin animation to style
const style = document.createElement('style');
style.textContent = `
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
`;
document.head.appendChild(style);