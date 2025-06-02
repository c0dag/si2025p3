// DOM Elements
const loginForm = document.getElementById("login-form")
const loginButton = document.getElementById("login-button")
const buttonText = document.querySelector(".button-text")
const loadingIcon = document.querySelector(".loading-icon")
const errorMessage = document.getElementById("error-message")
const usernameInput = document.getElementById("username")
const passwordInput = document.getElementById("password")

// Show error message
function showError(message) {
  errorMessage.querySelector("span").textContent = message
  errorMessage.classList.remove("hidden")
}

// Hide error message
function hideError() {
  errorMessage.classList.add("hidden")
}

// Set loading state
function setLoading(loading) {
  if (loading) {
    loginButton.disabled = true
    buttonText.textContent = "Entrando..."
    loadingIcon.classList.remove("hidden")
  } else {
    loginButton.disabled = false
    buttonText.textContent = "Entrar"
    loadingIcon.classList.add("hidden")
  }
}

// Handle form submission
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault()

  const username = usernameInput.value.trim()
  const password = passwordInput.value.trim()

  if (!username || !password) {
    showError("Por favor, preencha todos os campos.")
    return
  }

  hideError()
  setLoading(true)

  try {
    const response = await fetch("/api/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username, password }),
    })

    const data = await response.json()

    if (response.ok) {
      // Login successful - redirect to main page
      window.location.href = "/"
    } else {
      showError(data.message || "Erro ao fazer login")
    }
  } catch (error) {
    console.error("Erro no login:", error)
    showError("Erro de conexão. Tente novamente.")
  } finally {
    setLoading(false)
  }
})

// Check if already authenticated
async function checkAuth() {
  try {
    const response = await fetch("/api/auth/check")
    if (response.ok) {
      // Already authenticated - redirect to main page
      window.location.href = "/"
    }
  } catch (error) {
    // Not authenticated - stay on login page
    console.log("Usuário não autenticado")
  }
}

// Initialize
document.addEventListener("DOMContentLoaded", () => {
  checkAuth()
  usernameInput.focus()
})
