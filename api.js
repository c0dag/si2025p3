// DOM Elements
const connectionAlert = document.getElementById("connection-alert")
const connectionStatus = document.getElementById("connection-status")
const parkingGrid = document.getElementById("parking-grid")
const lastUpdated = document.getElementById("last-updated")
const availableCount = document.getElementById("available-count")
const occupiedCount = document.getElementById("occupied-count")
const totalCount = document.getElementById("total-count")
const totalCount2 = document.getElementById("total-count-2")
const occupancyRate = document.getElementById("occupancy-rate")
const currentLotName = document.getElementById("current-lot-name")
const lotLocation = document.getElementById("lot-location")
const lotCapacity = document.getElementById("lot-capacity")

// User elements
const usernameSpan = document.getElementById("username")
const userRoleSpan = document.getElementById("user-role")
const logoutBtn = document.getElementById("logout-btn")

// Management elements
const addSpaceBtn = document.getElementById("add-space-btn")
const removeSpaceBtn = document.getElementById("remove-space-btn")
const selectionControls = document.getElementById("selection-controls")
const cancelSelectionBtn = document.getElementById("cancel-selection-btn")
const confirmSelectionBtn = document.getElementById("confirm-selection-btn")

// User management elements
const addUserBtn = document.getElementById("add-user-btn")
const listUsersBtn = document.getElementById("list-users-btn")

// Modal elements
const addSpaceModal = document.getElementById("add-space-modal")
const closeModalBtn = document.querySelector(".close-modal")
const cancelAddBtn = document.getElementById("cancel-add-btn")
const confirmAddBtn = document.getElementById("confirm-add-btn")
const spaceIdInput = document.getElementById("space-id")
const spacePriorityInput = document.getElementById("space-priority")

// User modal elements
const addUserModal = document.getElementById("add-user-modal")
const closeUserModalBtn = document.querySelector(".close-user-modal")
const cancelUserBtn = document.getElementById("cancel-user-btn")
const confirmUserBtn = document.getElementById("confirm-user-btn")
const newUsernameInput = document.getElementById("new-username")
const newPasswordInput = document.getElementById("new-password")
const newRoleSelect = document.getElementById("new-role")

// Users list modal elements
const usersListModal = document.getElementById("users-list-modal")
const closeUsersListModalBtn = document.querySelector(".close-users-list-modal")
const usersList = document.getElementById("users-list")

// State
const parkingLots = {}
let currentLot = 1
let isConnected = false
let isSelectionMode = false
let selectedSpaces = []
let pollingInterval = null
let currentUser = null

// Check authentication on page load
async function checkAuth() {
  try {
    const response = await fetch("/api/auth/check")
    if (response.ok) {
      const data = await response.json()
      currentUser = data.user
      updateUserInfo()
      return true
    } else {
      window.location.href = "/login"
      return false
    }
  } catch (error) {
    console.error("Erro ao verificar autenticação:", error)
    window.location.href = "/login"
    return false
  }
}

// Update user info in header
function updateUserInfo() {
  if (currentUser) {
    usernameSpan.textContent = currentUser.username
    userRoleSpan.textContent = currentUser.role === "admin" ? "Administrador" : "Usuário"

    // Show admin-only elements if user is admin
    if (currentUser.role === "admin") {
      document.body.classList.add("admin")
    }
  }
}

// Logout function
async function logout() {
  try {
    await fetch("/api/logout", { method: "POST" })
    window.location.href = "/login"
  } catch (error) {
    console.error("Erro no logout:", error)
    window.location.href = "/login"
  }
}

// Initialize app with data from the server
async function initializeData() {
  try {
    // Fetch parking lots data from the server
    const lotsResponse = await fetch("/api/lots")

    if (!lotsResponse.ok) {
      throw new Error("Falha ao buscar dados dos estacionamentos")
    }

    const lotsData = await lotsResponse.json()

    if (!lotsData.data || !Array.isArray(lotsData.data)) {
      throw new Error("Formato de dados de estacionamentos inválido")
    }

    // Initialize parking lots from server data
    lotsData.data.forEach((lot) => {
      parkingLots[lot.id] = {
        name: lot.name,
        location: lot.location,
        capacity: lot.capacity,
        spaces: [],
      }
    })

    console.log("Dados de estacionamentos carregados:", parkingLots)

    // Fetch initial sensor data
    await fetchSensorData()

    // For each lot, initialize spaces that may not be in the sensor data
    Object.keys(parkingLots).forEach((lotId) => {
      const lot = parkingLots[lotId]
      const currentSpaces = lot.spaces.length

      // If we have fewer spaces than capacity, add more
      if (currentSpaces < lot.capacity) {
        // Find the highest space number currently used
        let maxSpaceNum = 0
        lot.spaces.forEach((space) => {
          const num = Number.parseInt(space.id.replace("P", ""))
          if (num > maxSpaceNum) maxSpaceNum = num
        })

        // Add spaces to reach capacity
        for (let i = 0; i < lot.capacity - currentSpaces; i++) {
          const newSpaceId = `P${maxSpaceNum + i + 1}`
          // Check if this ID already exists
          if (!lot.spaces.some((space) => space.id === newSpaceId)) {
            lot.spaces.push({
              id: newSpaceId,
              available: true,
              priority: false,
              lotId: lotId,
              timestamp: new Date().toISOString(),
            })
          }
        }
      }
    })

    updateUI()
  } catch (error) {
    console.error("Erro na inicialização:", error)
    if (error.message.includes("401") || error.message.includes("403")) {
      window.location.href = "/login"
    } else {
      alert("Falha ao carregar dados iniciais. Por favor, recarregue a página.")
    }
  }
}

// Start polling for sensor data
function startPolling() {
  // Set up polling interval (every 2 seconds)
  pollingInterval = setInterval(fetchSensorData, 2000)

  // Update connection status
  setConnectionStatus(true)
}

// Stop polling
function stopPolling() {
  if (pollingInterval) {
    clearInterval(pollingInterval)
    pollingInterval = null
  }

  setConnectionStatus(false)
}

// Fetch sensor data from server
async function fetchSensorData() {
  try {
    const response = await fetch("/api/sensors")

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        window.location.href = "/login"
        return
      }
      throw new Error("Falha na conexão com o servidor")
    }

    const responseJson = await response.json()

    // Check if response contains data property (as per api.js structure)
    if (!responseJson.data || !Array.isArray(responseJson.data)) {
      throw new Error("Formato de dados inválido")
    }

    const data = responseJson.data
    console.log("Dados recebidos:", data)

    // Process received data - map from database format to our application format
    if (data.length > 0) {
      data.forEach((sensorData) => {
        if (sensorData && sensorData.idSensor && sensorData.hasOwnProperty("available") && sensorData.lot) {
          const space = {
            id: `P${sensorData.idSensor}`, // Format ID as "P{number}"
            available: Boolean(sensorData.available), // Ensure boolean
            priority: Boolean(sensorData.priority || false), // Include priority
            lotId: sensorData.lot.toString(), // Convert to string to match our format
            timestamp: sensorData.last_changed || new Date().toISOString(), // Use last_changed from database
          }

          updateParkingSpace(space, space.lotId)
        }
      })

      updateLastUpdated()
      updateUI()

      // Set connected status to true if not already
      if (!isConnected) {
        setConnectionStatus(true)
      }
    }
  } catch (error) {
    console.error("Erro ao buscar dados:", error)
    setConnectionStatus(false)
  }
}

// Update connection status UI
function setConnectionStatus(connected) {
  isConnected = connected

  if (connected) {
    document.body.classList.add("connected")
    connectionStatus.classList.remove("offline")
    connectionStatus.classList.add("online")
    connectionStatus.innerHTML = '<i class="fas fa-wifi"></i><span>Online</span>'
    connectionAlert.classList.add("hidden")
  } else {
    document.body.classList.remove("connected")
    connectionStatus.classList.remove("online")
    connectionStatus.classList.add("offline")
    connectionStatus.innerHTML = '<i class="fas fa-wifi"></i><span>Offline</span>'
    connectionAlert.classList.remove("hidden")
  }
}

// Update a single parking space
function updateParkingSpace(updatedSpace, lotId) {
  // Check if this lot exists
  if (!parkingLots[lotId]) {
    console.error(`Estacionamento ${lotId} não encontrado`)
    return
  }

  const index = parkingLots[lotId].spaces.findIndex((space) => space.id === updatedSpace.id)

  if (index !== -1) {
    // Preserve the existing timestamp if the status hasn't changed
    const existingSpace = parkingLots[lotId].spaces[index]
    const statusChanged = existingSpace.available !== updatedSpace.available

    parkingLots[lotId].spaces[index] = {
      ...parkingLots[lotId].spaces[index],
      ...updatedSpace,
      // Only update timestamp if status actually changed or if it's a new timestamp from server
      timestamp:
        statusChanged || updatedSpace.timestamp !== existingSpace.timestamp
          ? updatedSpace.timestamp
          : existingSpace.timestamp,
    }

    if (statusChanged) {
      console.log(
        `Vaga ${updatedSpace.id} no estacionamento ${lotId} mudou para ${updatedSpace.available ? "disponível" : "ocupada"} às ${new Date(updatedSpace.timestamp).toLocaleTimeString()}`,
      )
    }
  } else {
    // If the space doesn't exist yet, add it
    parkingLots[lotId].spaces.push({
      id: updatedSpace.id,
      available: updatedSpace.available,
      priority: updatedSpace.priority || false,
      lotId: lotId,
      timestamp: updatedSpace.timestamp || new Date().toISOString(),
    })
    console.log(`Nova vaga ${updatedSpace.id} adicionada ao estacionamento ${lotId}`)
  }
}

// Update the last updated timestamp
function updateLastUpdated() {
  const now = new Date()
  lastUpdated.textContent = now.toLocaleTimeString()
}

// Render the parking grid for the current lot
function renderParkingGrid() {
  parkingGrid.innerHTML = ""

  // Check if current lot exists
  if (!parkingLots[currentLot]) {
    console.error(`Estacionamento ${currentLot} não encontrado`)
    return
  }

  const currentLotSpaces = parkingLots[currentLot].spaces

  currentLotSpaces.forEach((space) => {
    const spaceElement = document.createElement("div")
    let spaceClasses = `parking-space ${space.available ? "available" : "occupied"}`

    if (space.priority) {
      spaceClasses += " priority"
    }

    // Add selectable class if in selection mode
    if (isSelectionMode) {
      spaceClasses += " selectable"

      // Add selected class if this space is selected
      if (selectedSpaces.includes(space.id)) {
        spaceClasses += " selected"
      }
    }

    spaceElement.className = spaceClasses
    spaceElement.id = `space-${space.id}`
    spaceElement.dataset.id = space.id

    const statusClass = space.available ? "available" : "occupied"
    const statusText = space.available ? "Disponível" : "Ocupada"
    const iconClass = space.priority ? "priority" : statusClass

    let spaceHTML = `
            <div class="space-status ${statusClass}">${statusText}</div>
            <div class="space-icon ${iconClass}">
                <i class="fas fa-car"></i>
            </div>
            <div class="space-id">${space.id}</div>
            ${space.timestamp ? `<div class="space-time">${new Date(space.timestamp).toLocaleTimeString()}</div>` : ""}
        `

    // Add priority badge if it's a priority space
    if (space.priority) {
      spaceHTML = `<div class="priority-badge">P</div>` + spaceHTML
    }

    // Add admin controls if user is admin and not in selection mode
    if (currentUser && currentUser.role === "admin" && !isSelectionMode) {
      spaceHTML += `
                <div class="space-controls">
                    <button class="space-control-btn priority-btn" onclick="toggleSpacePriority('${space.id}', ${!space.priority})" title="${space.priority ? "Remover" : "Adicionar"} Prioridade">
                        <i class="fas fa-star${space.priority ? "" : "-o"}"></i>
                    </button>
                </div>
            `
    }

    spaceElement.innerHTML = spaceHTML

    // Add click event for selection mode
    if (isSelectionMode) {
      spaceElement.addEventListener("click", () => toggleSpaceSelection(space.id))
    }

    parkingGrid.appendChild(spaceElement)
  })
}

// Toggle priority of a parking space
async function toggleSpacePriority(spaceId, priority) {
  if (!currentUser || currentUser.role !== "admin") {
    alert("Apenas administradores podem alterar prioridades.")
    return
  }

  try {
    const sensorId = extractSensorId(spaceId)
    const response = await fetch(`/api/sensors/${sensorId}/${currentLot}/priority`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ priority }),
    })

    if (response.ok) {
      // Update local data
      const space = parkingLots[currentLot].spaces.find((s) => s.id === spaceId)
      if (space) {
        space.priority = priority
        updateUI()
      }
    } else {
      const error = await response.json()
      alert(error.message || "Erro ao alterar prioridade da vaga")
    }
  } catch (error) {
    console.error("Erro ao alterar prioridade:", error)
    alert("Erro ao alterar prioridade da vaga")
  }
}

// Toggle selection of a parking space
function toggleSpaceSelection(spaceId) {
  const index = selectedSpaces.indexOf(spaceId)

  if (index === -1) {
    // Add to selected spaces
    selectedSpaces.push(spaceId)
  } else {
    // Remove from selected spaces
    selectedSpaces.splice(index, 1)
  }

  // Update UI to reflect selection
  const spaceElement = document.getElementById(`space-${spaceId}`)
  if (spaceElement) {
    spaceElement.classList.toggle("selected", selectedSpaces.includes(spaceId))
  }

  // Update confirm button state
  confirmSelectionBtn.disabled = selectedSpaces.length === 0
}

// Enter selection mode for removing spaces
function enterSelectionMode() {
  if (!currentUser || currentUser.role !== "admin") {
    alert("Apenas administradores podem remover vagas.")
    return
  }

  isSelectionMode = true
  selectedSpaces = []
  selectionControls.classList.remove("hidden")
  removeSpaceBtn.disabled = true
  addSpaceBtn.disabled = true

  // Update UI to make spaces selectable
  updateUI()
}

// Exit selection mode
function exitSelectionMode() {
  isSelectionMode = false
  selectedSpaces = []
  selectionControls.classList.add("hidden")
  removeSpaceBtn.disabled = false
  addSpaceBtn.disabled = false

  // Update UI to remove selectable state
  updateUI()
}

// Remove selected spaces
async function removeSelectedSpaces() {
  if (selectedSpaces.length === 0) return

  try {
    // Get the current lot data
    const lot = parkingLots[currentLot]

    // Remove each selected space from the database and local storage
    const deletePromises = selectedSpaces.map(async (spaceId) => {
      const sensorId = extractSensorId(spaceId)

      // Delete from database
      const response = await fetch(`/api/sensors/${sensorId}/${currentLot}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || `Erro ao deletar vaga ${spaceId}`)
      }

      // Remove from local storage
      const index = lot.spaces.findIndex((space) => space.id === spaceId)
      if (index !== -1) {
        lot.spaces.splice(index, 1)
      }

      console.log(`Vaga ${spaceId} removida com sucesso`)
    })

    await Promise.all(deletePromises)

    // Update capacity in database
    const newCapacity = lot.spaces.length
    lot.capacity = newCapacity

    await updateLotCapacity(currentLot, lot.name, lot.location, newCapacity)

    // Exit selection mode and update UI
    exitSelectionMode()
    updateUI()

    alert(`${selectedSpaces} vaga(s) removida(s) com sucesso!`)
  } catch (error) {
    console.error("Erro ao remover vagas:", error)
    alert(`Falha ao remover vagas: ${error.message}`)
  }
}

// Convert our UI space ID format (P1, P2, etc.) to database format (1, 2, etc.)
function extractSensorId(spaceId) {
  // Extract numeric part from "P1", "P2", etc.
  return Number.parseInt(spaceId.replace(/P/i, ""))
}

// Add a new parking space
async function addNewSpace(spaceId, priority = false) {
  if (!spaceId) return

  if (!currentUser || currentUser.role !== "admin") {
    alert("Apenas administradores podem adicionar vagas.")
    return false
  }

  try {
    // Validate space ID format
    if (!spaceId.match(/^P\d+$/i)) {
      alert("ID da vaga deve estar no formato P1, P2, P3, etc.")
      return false
    }

    // Check if space ID already exists
    const exists = parkingLots[currentLot].spaces.some((space) => space.id.toLowerCase() === spaceId.toLowerCase())
    if (exists) {
      alert(`Vaga com ID ${spaceId} já existe no estacionamento atual.`)
      return false
    }

    // Send new space to server first
    const sensorId = extractSensorId(spaceId)
    await sendSpaceToServer(sensorId, currentLot, true, priority)

    // Add new space to the current lot
    const newSpace = {
      id: spaceId.toUpperCase(),
      available: true,
      priority: priority,
      lotId: currentLot.toString(),
      timestamp: new Date().toISOString(),
    }

    parkingLots[currentLot].spaces.push(newSpace)

    // Update capacity in memory and database
    const newCapacity = parkingLots[currentLot].spaces.length
    parkingLots[currentLot].capacity = newCapacity

    // Update lot capacity in database
    await updateLotCapacity(currentLot, parkingLots[currentLot].name, parkingLots[currentLot].location, newCapacity)

    // Update UI
    updateUI()
    return true
  } catch (error) {
    console.error("Erro ao adicionar vaga:", error)
    alert("Falha ao adicionar vaga. Por favor, tente novamente.")
    return false
  }
}

// Update lot capacity in database
async function updateLotCapacity(lotId, name, location, capacity) {
  try {
    const response = await fetch(`/api/lots/${lotId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name,
        location,
        capacity,
      }),
    })

    if (!response.ok) {
      throw new Error("Falha ao atualizar capacidade do estacionamento")
    }

    console.log(`Capacidade do estacionamento ${lotId} atualizada para ${capacity}`)
    return true
  } catch (error) {
    console.error("Erro ao atualizar capacidade:", error)
    throw error
  }
}

// Send space data to server
async function sendSpaceToServer(idSensor, lot, available, priority = false) {
  try {
    const response = await fetch("/api/sensors", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        idSensor,
        lot,
        available,
        priority,
      }),
    })

    if (!response.ok) {
      throw new Error("Falha ao enviar dados para o servidor")
    }

    console.log(`Dados da vaga ${idSensor} enviados com sucesso para o servidor`)
  } catch (error) {
    console.error("Erro ao enviar dados:", error)
    throw error
  }
}

// Show add space modal
function showAddSpaceModal() {
  if (!currentUser || currentUser.role !== "admin") {
    alert("Apenas administradores podem adicionar vagas.")
    return
  }

  // Find the next available space ID
  const currentSpaces = parkingLots[currentLot].spaces
  let maxId = 0

  currentSpaces.forEach((space) => {
    const num = Number.parseInt(space.id.replace(/P/i, ""))
    if (num > maxId) maxId = num
  })

  const suggestedId = `P${maxId + 1}`

  addSpaceModal.classList.add("active")
  spaceIdInput.value = suggestedId
  spacePriorityInput.checked = false
  spaceIdInput.focus()
  spaceIdInput.select()
}

// Hide add space modal
function hideAddSpaceModal() {
  addSpaceModal.classList.remove("active")
}

// Show add user modal
function showAddUserModal() {
  if (!currentUser || currentUser.role !== "admin") {
    alert("Apenas administradores podem adicionar usuários.")
    return
  }

  addUserModal.classList.add("active")
  newUsernameInput.value = ""
  newPasswordInput.value = ""
  newRoleSelect.value = "user"
  newUsernameInput.focus()
}

// Hide add user modal
function hideAddUserModal() {
  addUserModal.classList.remove("active")
}

// Add new user
async function addNewUser() {
  const username = newUsernameInput.value.trim()
  const password = newPasswordInput.value.trim()
  const role = newRoleSelect.value

  if (!username || !password) {
    alert("Por favor, preencha todos os campos.")
    return
  }

  try {
    const response = await fetch("/api/users", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username, password, role }),
    })

    const data = await response.json()

    if (response.ok) {
      alert("Usuário criado com sucesso!")
      hideAddUserModal()
    } else {
      alert(data.message || "Erro ao criar usuário")
    }
  } catch (error) {
    console.error("Erro ao criar usuário:", error)
    alert("Erro ao criar usuário")
  }
}

// Show users list modal
async function showUsersListModal() {
  if (!currentUser || currentUser.role !== "admin") {
    alert("Apenas administradores podem visualizar usuários.")
    return
  }

  try {
    const response = await fetch("/api/users")
    const data = await response.json()

    if (response.ok) {
      renderUsersList(data.data)
      usersListModal.classList.add("active")
    } else {
      alert(data.message || "Erro ao carregar usuários")
    }
  } catch (error) {
    console.error("Erro ao carregar usuários:", error)
    alert("Erro ao carregar usuários")
  }
}

// Hide users list modal
function hideUsersListModal() {
  usersListModal.classList.remove("active")
}

// Render users list
function renderUsersList(users) {
  usersList.innerHTML = ""

  users.forEach((user) => {
    const userItem = document.createElement("div")
    userItem.className = "user-item"

    userItem.innerHTML = `
            <div class="user-info-item">
                <div class="user-name">${user.username}</div>
                <div class="user-role-badge ${user.role}">${user.role === "admin" ? "Administrador" : "Usuário"}</div>
            </div>
            <div class="user-created">
                ${new Date(user.created_at).toLocaleDateString()}
            </div>
        `

    usersList.appendChild(userItem)
  })
}

// Update statistics for the current lot
function updateStats() {
  // Check if current lot exists
  if (!parkingLots[currentLot]) {
    console.error(`Estacionamento ${currentLot} não encontrado`)
    return
  }

  const currentLotSpaces = parkingLots[currentLot].spaces
  const total = currentLotSpaces.length
  const available = currentLotSpaces.filter((space) => space.available).length
  const occupied = total - available
  const rate = total > 0 ? Math.round((occupied / total) * 100) : 0

  availableCount.textContent = available
  occupiedCount.textContent = occupied
  totalCount.textContent = total
  totalCount2.textContent = total
  occupancyRate.textContent = `${rate}%`
}

// Update lot information
function updateLotInfo() {
  // Check if current lot exists
  if (!parkingLots[currentLot]) {
    console.error(`Estacionamento ${currentLot} não encontrado`)
    return
  }

  const lot = parkingLots[currentLot]
  currentLotName.textContent = lot.name
  lotLocation.textContent = lot.location
  lotCapacity.textContent = `${lot.capacity} Vagas`
}

// Update the entire UI
function updateUI() {
  renderParkingGrid()
  updateStats()
  updateLotInfo()
}

// Switch to a different parking lot
function switchParkingLot(lotId) {
  // Exit selection mode if active
  if (isSelectionMode) {
    exitSelectionMode()
  }

  currentLot = lotId

  // Update active button
  document.querySelectorAll(".parking-button").forEach((button) => {
    if (button.dataset.lot === lotId.toString()) {
      button.classList.add("active")
    } else {
      button.classList.remove("active")
    }
  })

  updateUI()
}

// Initialize the application
async function init() {
  // Check authentication first
  const isAuthenticated = await checkAuth()
  if (!isAuthenticated) return

  await initializeData()
  startPolling() // Start fetching data periodically

  // Add event listeners to parking lot buttons
  document.querySelectorAll(".parking-button").forEach((button) => {
    button.addEventListener("click", function () {
      const lotId = Number.parseInt(this.dataset.lot)
      console.log("Botão clicado para estacionamento:", lotId)
      switchParkingLot(lotId)
    })
  })

  // Add event listeners for management buttons
  addSpaceBtn.addEventListener("click", showAddSpaceModal)
  removeSpaceBtn.addEventListener("click", enterSelectionMode)
  cancelSelectionBtn.addEventListener("click", exitSelectionMode)
  confirmSelectionBtn.addEventListener("click", removeSelectedSpaces)

  // Add event listeners for user management
  addUserBtn.addEventListener("click", showAddUserModal)
  listUsersBtn.addEventListener("click", showUsersListModal)

  // Add logout event listener
  logoutBtn.addEventListener("click", logout)

  // Modal event listeners
  closeModalBtn.addEventListener("click", hideAddSpaceModal)
  cancelAddBtn.addEventListener("click", hideAddSpaceModal)
  confirmAddBtn.addEventListener("click", () => {
    const spaceId = spaceIdInput.value.trim()
    const priority = spacePriorityInput.checked
    if (spaceId && addNewSpace(spaceId, priority)) {
      hideAddSpaceModal()
    }
  })

  // User modal event listeners
  closeUserModalBtn.addEventListener("click", hideAddUserModal)
  cancelUserBtn.addEventListener("click", hideAddUserModal)
  confirmUserBtn.addEventListener("click", addNewUser)

  // Users list modal event listeners
  closeUsersListModalBtn.addEventListener("click", hideUsersListModal)

  // Close modals when clicking outside
  window.addEventListener("click", (event) => {
    if (event.target === addSpaceModal) {
      hideAddSpaceModal()
    }
    if (event.target === addUserModal) {
      hideAddUserModal()
    }
    if (event.target === usersListModal) {
      hideUsersListModal()
    }
  })

  // Clean up on page unload
  window.addEventListener("beforeunload", () => {
    stopPolling()
  })
}

// Make toggleSpacePriority available globally
window.toggleSpacePriority = toggleSpacePriority

// Start the application when the DOM is fully loaded
document.addEventListener("DOMContentLoaded", init)
