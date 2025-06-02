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

// Lot management elements
const addLotBtn = document.getElementById("add-lot-btn")
const removeLotBtn = document.getElementById("remove-lot-btn")

// Add lot modal elements
const addLotModal = document.getElementById("add-lot-modal")
const closeLotModalBtn = document.querySelector(".close-lot-modal")

// Remove lot modal elements
const removeLotModal = document.getElementById("remove-lot-modal")
const closeRemoveLotModalBtn = document.querySelector(".close-remove-lot-modal")
const cancelRemoveLotBtn = document.getElementById("cancel-remove-lot-btn")
const confirmRemoveLotBtn = document.getElementById("confirm-remove-lot-btn")
const lotSelect = document.getElementById("lot-select")

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
      showToast("Falha ao carregar dados iniciais. Por favor, recarregue a página.", "error")
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

    // Convert UTC timestamp from database to local time
    let localTimestamp = updatedSpace.timestamp
    if (updatedSpace.timestamp) {
      const utcDate = new Date(updatedSpace.timestamp)
      localTimestamp = new Date(utcDate.getTime() - utcDate.getTimezoneOffset() * 60000).toISOString()
    }

    parkingLots[lotId].spaces[index] = {
      ...parkingLots[lotId].spaces[index],
      ...updatedSpace,
      // Only update timestamp if status actually changed or if it's a new timestamp from server
      timestamp: statusChanged || localTimestamp !== existingSpace.timestamp ? localTimestamp : existingSpace.timestamp,
    }

    if (statusChanged) {
      console.log(
        `Vaga ${updatedSpace.id} no estacionamento ${lotId} mudou para ${updatedSpace.available ? "disponível" : "ocupada"} às ${new Date(localTimestamp).toLocaleTimeString()}`,
      )
    }
  } else {
    // If the space doesn't exist yet, add it
    let localTimestamp = updatedSpace.timestamp || new Date().toISOString()
    if (updatedSpace.timestamp) {
      const utcDate = new Date(updatedSpace.timestamp)
      localTimestamp = new Date(utcDate.getTime() - utcDate.getTimezoneOffset() * 60000).toISOString()
    }

    parkingLots[lotId].spaces.push({
      id: updatedSpace.id,
      available: updatedSpace.available,
      priority: updatedSpace.priority || false,
      lotId: lotId,
      timestamp: localTimestamp,
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
    showToast("Apenas administradores podem alterar prioridades", "error")
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
        showToast(`Prioridade da vaga ${spaceId} ${priority ? "adicionada" : "removida"}`, "success")
      }
    } else {
      const error = await response.json()
      showToast(error.message || "Erro ao alterar prioridade da vaga", "error")
    }
  } catch (error) {
    console.error("Erro ao alterar prioridade:", error)
    showToast("Erro ao alterar prioridade da vaga", "error")
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
    showToast("Apenas administradores podem remover vagas", "error")
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

  confirmAction(
    `Tem certeza que deseja remover ${selectedSpaces.length} vaga(s) selecionada(s)?<br><br>Esta ação não pode ser desfeita.`,
    async () => {
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

        showToast(`${selectedSpaces.length} vaga(s) removida(s) com sucesso!`, "success")
      } catch (error) {
        console.error("Erro ao remover vagas:", error)
        showToast(`Falha ao remover vagas: ${error.message}`, "error")
      }
    },
  )
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
    showToast("Apenas administradores podem adicionar vagas", "error")
    return false
  }

  try {
    // Validate space ID format
    if (!spaceId.match(/^P\d+$/i)) {
      showToast("ID da vaga deve estar no formato P1, P2, P3, etc.", "error")
      return false
    }

    // Check if space ID already exists
    const exists = parkingLots[currentLot].spaces.some((space) => space.id.toLowerCase() === spaceId.toLowerCase())
    if (exists) {
      showToast(`Vaga com ID ${spaceId} já existe no estacionamento atual`, "error")
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
    showToast(`Vaga ${spaceId} adicionada com sucesso!`, "success")
    return true
  } catch (error) {
    console.error("Erro ao adicionar vaga:", error)
    showToast("Falha ao adicionar vaga. Tente novamente.", "error")
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
    showToast("Apenas administradores podem adicionar vagas", "error")
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
    showToast("Apenas administradores podem adicionar usuários", "error")
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
    showToast("Por favor, preencha todos os campos", "error")
    return
  }

  if (password.length < 6) {
    showToast("A senha deve ter pelo menos 6 caracteres", "error")
    newPasswordInput.focus()
    return
  }

  try {
    const confirmBtn = document.getElementById("confirm-user-btn")
    confirmBtn.disabled = true
    confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Criando...'

    const response = await fetch("/api/users", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username, password, role }),
    })

    const data = await response.json()

    if (response.ok) {
      showToast(`Usuário "${username}" criado com sucesso!`, "success")
      hideAddUserModal()
    } else {
      showToast(data.message || "Erro ao criar usuário", "error")
    }
  } catch (error) {
    console.error("Erro ao criar usuário:", error)
    showToast("Erro de conexão ao criar usuário", "error")
  } finally {
    const confirmBtn = document.getElementById("confirm-user-btn")
    confirmBtn.disabled = false
    confirmBtn.innerHTML = "Adicionar"
  }
}

// Show users list modal
async function showUsersListModal() {
  if (!currentUser || currentUser.role !== "admin") {
    showToast("Apenas administradores podem visualizar usuários", "error")
    return
  }

  try {
    const response = await fetch("/api/users")
    const data = await response.json()

    if (response.ok) {
      renderUsersList(data.data)
      usersListModal.classList.add("active")
    } else {
      showToast(data.message || "Erro ao carregar usuários", "error")
    }
  } catch (error) {
    console.error("Erro ao carregar usuários:", error)
    showToast("Erro ao carregar usuários", "error")
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

    const isCurrentUser = currentUser && currentUser.id === user.id

    userItem.innerHTML = `
            <div class="user-info-item">
                <div class="user-name">${user.username}</div>
                <div class="user-role-badge ${user.role}">${user.role === "admin" ? "Administrador" : "Usuário"}</div>
            </div>
            <div class="user-created">
                ${new Date(user.created_at).toLocaleDateString()}
            </div>
            <div class="user-actions">
                ${
                  !isCurrentUser
                    ? `
                    <button class="delete-user-btn" onclick="deleteUser(${user.id}, '${user.username}')" title="Excluir usuário">
                        <i class="fas fa-trash"></i>
                    </button>
                `
                    : '<span class="current-user-label">Você</span>'
                }
            </div>
        `

    usersList.appendChild(userItem)
  })
}

// Delete user function
async function deleteUser(userId, username) {
  if (!currentUser || currentUser.role !== "admin") {
    showToast("Apenas administradores podem excluir usuários", "error")
    return
  }

  if (currentUser.id === userId) {
    showToast("Você não pode excluir sua própria conta", "error")
    return
  }

  confirmAction(
    `Tem certeza que deseja excluir o usuário "<strong>${username}</strong>"?<br><br>Esta ação não pode ser desfeita.`,
    async () => {
      try {
        const response = await fetch(`/api/users/${userId}`, {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
        })

        const data = await response.json()

        if (response.ok) {
          showToast(`Usuário "${username}" excluído com sucesso!`, "success")
          // Refresh the users list
          showUsersListModal()
        } else {
          showToast(data.message || "Erro ao excluir usuário", "error")
        }
      } catch (error) {
        console.error("Erro ao excluir usuário:", error)
        showToast("Erro de conexão ao excluir usuário", "error")
      }
    },
  )
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

// Show add lot modal - NOVA IMPLEMENTAÇÃO
function showAddLotModal() {
  if (!currentUser || currentUser.role !== "admin") {
    showToast("Apenas administradores podem adicionar estacionamentos", "error")
    return
  }

  const modal = document.getElementById("add-lot-modal")
  const form = document.getElementById("add-lot-form")
  const nameInput = document.getElementById("new-lot-name")
  const locationInput = document.getElementById("new-lot-location")
  const capacityInput = document.getElementById("new-lot-capacity")
  const submitBtn = document.getElementById("submit-new-lot-btn")

  // Resetar formulário
  form.reset()
  capacityInput.value = "0"

  // Limpar validações
  clearValidation(nameInput)
  clearValidation(locationInput)

  // Desabilitar botão submit
  submitBtn.disabled = true

  // Mostrar modal
  modal.classList.add("active")

  // Focar no primeiro campo
  setTimeout(() => nameInput.focus(), 100)

  // Configurar validação em tempo real
  setupRealTimeValidation()
}

// Hide add lot modal
function hideAddLotModal() {
  const modal = document.getElementById("add-lot-modal")
  modal.classList.remove("active")

  // Remover event listeners
  removeValidationListeners()
}

function setupRealTimeValidation() {
  const nameInput = document.getElementById("new-lot-name")
  const locationInput = document.getElementById("new-lot-location")

  // Remover listeners existentes
  removeValidationListeners()

  // Adicionar novos listeners
  nameInput.addEventListener("input", validateLotFormNew)
  nameInput.addEventListener("blur", validateLotFormNew)
  locationInput.addEventListener("input", validateLotFormNew)
  locationInput.addEventListener("blur", validateLotFormNew)
}

function removeValidationListeners() {
  const nameInput = document.getElementById("new-lot-name")
  const locationInput = document.getElementById("new-lot-location")

  if (nameInput) {
    nameInput.removeEventListener("input", validateLotFormNew)
    nameInput.removeEventListener("blur", validateLotFormNew)
  }

  if (locationInput) {
    locationInput.removeEventListener("input", validateLotFormNew)
    locationInput.removeEventListener("blur", validateLotFormNew)
  }
}

function validateLotFormNew() {
  const nameInput = document.getElementById("new-lot-name")
  const locationInput = document.getElementById("new-lot-location")
  const submitBtn = document.getElementById("submit-new-lot-btn")

  let isNameValid = false
  let isLocationValid = false

  // Validar nome
  const nameValue = nameInput.value.trim()
  if (nameValue.length === 0) {
    setValidationState(nameInput, "error", "Nome é obrigatório")
  } else if (nameValue.length < 3) {
    setValidationState(nameInput, "error", "Nome deve ter pelo menos 3 caracteres")
  } else {
    // Verificar duplicatas
    const isDuplicate = Object.values(parkingLots).some((lot) => lot.name.toLowerCase() === nameValue.toLowerCase())

    if (isDuplicate) {
      setValidationState(nameInput, "error", "Já existe um estacionamento com este nome")
    } else {
      setValidationState(nameInput, "success", "Nome válido")
      isNameValid = true
    }
  }

  // Validar localização
  const locationValue = locationInput.value.trim()
  if (locationValue.length === 0) {
    setValidationState(locationInput, "error", "Localização é obrigatória")
  } else if (locationValue.length < 3) {
    setValidationState(locationInput, "error", "Localização deve ter pelo menos 3 caracteres")
  } else {
    setValidationState(locationInput, "success", "Localização válida")
    isLocationValid = true
  }

  // Habilitar/desabilitar botão
  submitBtn.disabled = !(isNameValid && isLocationValid)

  return isNameValid && isLocationValid
}

function setValidationState(input, state, message) {
  const validationDiv = input.parentElement.querySelector(".validation-message")

  // Limpar classes anteriores
  input.classList.remove("valid", "invalid")
  validationDiv.classList.remove("success", "error")

  if (state === "success") {
    input.classList.add("valid")
    validationDiv.classList.add("success")
    validationDiv.innerHTML = `<i class="fas fa-check"></i> ${message}`
  } else if (state === "error") {
    input.classList.add("invalid")
    validationDiv.classList.add("error")
    validationDiv.innerHTML = `<i class="fas fa-times"></i> ${message}`
  }
}

function clearValidation(input) {
  input.classList.remove("valid", "invalid")
  const validationDiv = input.parentElement.querySelector(".validation-message")
  validationDiv.classList.remove("success", "error")
  validationDiv.innerHTML = ""
}

async function handleAddLotSubmit(event) {
  event.preventDefault()

  console.log("=== NOVA IMPLEMENTAÇÃO: Iniciando criação de estacionamento ===")

  // Validar formulário uma última vez
  if (!validateLotFormNew()) {
    showToast("Por favor, corrija os erros no formulário", "error")
    return
  }

  const nameInput = document.getElementById("new-lot-name")
  const locationInput = document.getElementById("new-lot-location")
  const capacityInput = document.getElementById("new-lot-capacity")
  const submitBtn = document.getElementById("submit-new-lot-btn")
  const buttonText = submitBtn.querySelector(".button-text")
  const buttonSpinner = submitBtn.querySelector(".button-spinner")

  // Capturar valores
  const name = nameInput.value.trim()
  const location = locationInput.value.trim()
  const capacity = Number.parseInt(capacityInput.value) || 0

  console.log("Dados capturados:", { name, location, capacity })

  try {
    // Mostrar loading
    submitBtn.disabled = true
    buttonText.style.display = "none"
    buttonSpinner.classList.remove("hidden")

    const requestData = { name, location, capacity }
    console.log("Enviando requisição:", requestData)

    const response = await fetch("/api/lots", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestData),
    })

    const data = await response.json()
    console.log("Resposta recebida:", data)

    if (response.ok) {
      showToast(`Estacionamento "${name}" criado com sucesso!`, "success")

      // Adicionar aos dados locais
      parkingLots[data.id] = {
        name,
        location,
        capacity,
        spaces: [],
      }

      // Atualizar interface
      updateParkingButtons()
      hideAddLotModal()

      // Mudar para o novo estacionamento se for o primeiro
      if (Object.keys(parkingLots).length === 1) {
        switchParkingLot(data.id)
      }

      console.log("Estacionamento criado com sucesso!")
    } else {
      console.error("Erro do servidor:", data)
      showToast(data.message || "Erro ao criar estacionamento", "error")
    }
  } catch (error) {
    console.error("Erro na requisição:", error)
    showToast("Erro de conexão ao criar estacionamento", "error")
  } finally {
    // Restaurar botão
    buttonText.style.display = "inline"
    buttonSpinner.classList.add("hidden")
    submitBtn.disabled = false
  }
}

// Show remove lot modal
function showRemoveLotModal() {
  if (!currentUser || currentUser.role !== "admin") {
    showToast("Apenas administradores podem remover estacionamentos", "error")
    return
  }

  // Populate lot selector
  populateLotSelector()
  removeLotModal.classList.add("active")
}

// Hide remove lot modal
function hideRemoveLotModal() {
  removeLotModal.classList.remove("active")
}

// Populate lot selector with available lots
function populateLotSelector() {
  lotSelect.innerHTML = '<option value="">Selecione um estacionamento</option>'

  Object.keys(parkingLots).forEach((lotId) => {
    const lot = parkingLots[lotId]
    const option = document.createElement("option")
    option.value = lotId
    option.textContent = `${lot.name} (${lot.location})`
    lotSelect.appendChild(option)
  })
}

// Remove parking lot
async function removeParkingLot() {
  const lotId = lotSelect.value

  if (!lotId) {
    showToast("Por favor, selecione um estacionamento para remover", "error")
    return
  }

  const lot = parkingLots[lotId]

  confirmAction(
    `Tem certeza que deseja remover o estacionamento "<strong>${lot.name}</strong>"?<br><br>Esta ação não pode ser desfeita.`,
    async () => {
      try {
        const response = await fetch(`/api/lots/${lotId}`, {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
        })

        const data = await response.json()

        if (response.ok) {
          showToast(`Estacionamento "${lot.name}" removido com sucesso!`, "success")

          // Remove from local data
          delete parkingLots[lotId]

          // If current lot was removed, switch to first available lot
          if (currentLot.toString() === lotId) {
            const availableLots = Object.keys(parkingLots)
            if (availableLots.length > 0) {
              switchParkingLot(Number.parseInt(availableLots[0]))
            } else {
              currentLot = null
              updateUI()
            }
          }

          // Update parking buttons
          updateParkingButtons()
          hideRemoveLotModal()
        } else {
          showToast(data.message || "Erro ao remover estacionamento", "error")
        }
      } catch (error) {
        console.error("Erro ao remover estacionamento:", error)
        showToast("Erro de conexão ao remover estacionamento", "error")
      }
    },
  )
}

// Update parking buttons dynamically
function updateParkingButtons() {
  const parkingButtonsContainer = document.querySelector(".parking-buttons")
  parkingButtonsContainer.innerHTML = ""

  Object.keys(parkingLots).forEach((lotId) => {
    const lot = parkingLots[lotId]
    const button = document.createElement("button")
    button.id = `parking-lot-${lotId}`
    button.className = `parking-button ${currentLot && currentLot.toString() === lotId ? "active" : ""}`
    button.dataset.lot = lotId
    button.innerHTML = `
      <i class="fas fa-parking"></i>
      <span>${lot.name}</span>
    `

    button.addEventListener("click", function () {
      const lotId = Number.parseInt(this.dataset.lot)
      switchParkingLot(lotId)
    })

    parkingButtonsContainer.appendChild(button)
  })
}

// Função para mostrar notificações toast
function showToast(message, type = "info") {
  // Remover toast existente se houver
  const existingToast = document.querySelector(".toast")
  if (existingToast) {
    existingToast.remove()
  }

  const toast = document.createElement("div")
  toast.className = `toast toast-${type}`
  toast.innerHTML = `
    <div class="toast-content">
      <i class="fas fa-${type === "success" ? "check-circle" : type === "error" ? "exclamation-circle" : "info-circle"}"></i>
      <span>${message}</span>
    </div>
    <button class="toast-close" onclick="this.parentElement.remove()">
      <i class="fas fa-times"></i>
    </button>
  `

  document.body.appendChild(toast)

  // Auto-remover após 5 segundos
  setTimeout(() => {
    if (toast.parentElement) {
      toast.remove()
    }
  }, 5000)
}

// Função para confirmar ações destrutivas
function confirmAction(message, onConfirm) {
  const modal = document.createElement("div")
  modal.className = "modal active"
  modal.innerHTML = `
    <div class="modal-content confirm-modal">
      <div class="modal-header">
        <h3>Confirmar Ação</h3>
      </div>
      <div class="modal-body">
        <div class="confirm-icon">
          <i class="fas fa-exclamation-triangle"></i>
        </div>
        <p>${message}</p>
        <div class="form-actions">
          <button class="modal-button cancel" onclick="this.closest('.modal').remove()">Cancelar</button>
          <button class="modal-button confirm" onclick="confirmActionExecute()">Confirmar</button>
        </div>
      </div>
    </div>
  `

  document.body.appendChild(modal)

  window.confirmActionExecute = () => {
    modal.remove()
    onConfirm()
    delete window.confirmActionExecute
  }
}

// Adicionar função para exportar dados
function exportParkingData() {
  const data = {
    timestamp: new Date().toISOString(),
    lots: parkingLots,
    currentUser: currentUser.username,
    summary: {
      totalLots: Object.keys(parkingLots).length,
      totalSpaces: Object.values(parkingLots).reduce((total, lot) => total + lot.spaces.length, 0),
      availableSpaces: Object.values(parkingLots).reduce(
        (total, lot) => total + lot.spaces.filter((space) => space.available).length,
        0,
      ),
    },
  }

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `unipark-data-${new Date().toISOString().split("T")[0]}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)

  showToast("Dados exportados com sucesso!", "success")
}

// Adicionar função para buscar estacionamentos
function searchLots(query) {
  const buttons = document.querySelectorAll(".parking-button")
  buttons.forEach((button) => {
    const lotName = button.querySelector("span").textContent.toLowerCase()
    const lotId = button.dataset.lot
    const lot = parkingLots[lotId]

    if (lot) {
      const lotLocation = lot.location.toLowerCase()

      if (lotName.includes(query.toLowerCase()) || lotLocation.includes(query.toLowerCase())) {
        button.style.display = "flex"
      } else {
        button.style.display = "none"
      }
    }
  })
}

// Função para testar dados do ESP32
async function testESP32Data() {
  if (!currentUser || currentUser.role !== "admin") {
    showToast("Apenas administradores podem testar ESP32", "error")
    return
  }

  // Pegar uma vaga aleatória do estacionamento atual
  const currentSpaces = parkingLots[currentLot].spaces
  if (currentSpaces.length === 0) {
    showToast("Adicione algumas vagas primeiro para testar", "warning")
    return
  }

  const randomSpace = currentSpaces[Math.floor(Math.random() * currentSpaces.length)]
  const sensorId = extractSensorId(randomSpace.id)

  // Simular mudança de status (inverter o status atual)
  const newStatus = !randomSpace.available

  console.log(`=== TESTE ESP32 ===`)
  console.log(`Testando sensor ${sensorId} no lot ${currentLot}`)
  console.log(`Status atual: ${randomSpace.available}, Novo status: ${newStatus}`)
  console.log(`Priority atual: ${randomSpace.priority} (deve ser preservada)`)

  try {
    const response = await fetch("/api/sensors/esp32-test", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        idSensor: sensorId,
        lot: currentLot,
        available: newStatus,
        // Nota: priority NÃO é enviada, simulando o ESP32
      }),
    })

    const data = await response.json()

    if (response.ok) {
      showToast(
        `✅ ESP32 Test: Sensor ${randomSpace.id} → ${newStatus ? "Disponível" : "Ocupado"}. Priority preservada: ${data.preservedPriority}`,
        "success",
      )

      // Atualizar dados locais
      randomSpace.available = newStatus
      randomSpace.timestamp = new Date().toISOString()
      // Nota: priority é preservada automaticamente

      updateUI()
    } else {
      showToast(`Erro no teste ESP32: ${data.message}`, "error")
    }
  } catch (error) {
    console.error("Erro no teste ESP32:", error)
    showToast("Erro de conexão no teste ESP32", "error")
  }
}

// Função para demonstrar o problema e solução
async function demonstratePriorityPersistence() {
  if (!currentUser || currentUser.role !== "admin") {
    showToast("Apenas administradores podem executar demonstração", "error")
    return
  }

  const currentSpaces = parkingLots[currentLot].spaces
  if (currentSpaces.length === 0) {
    showToast("Adicione algumas vagas primeiro", "warning")
    return
  }

  try {
    // Passo 1: Definir uma vaga como prioritária
    const testSpace = currentSpaces[0]
    const sensorId = extractSensorId(testSpace.id)

    showToast("🔄 Demonstração iniciada: Definindo vaga como prioritária...", "info")

    await toggleSpacePriority(testSpace.id, true)
    await new Promise((resolve) => setTimeout(resolve, 1000))

    // Passo 2: Simular dados do ESP32 (sem priority)
    showToast("📡 Simulando dados do ESP32 (sem campo priority)...", "info")

    const response = await fetch("/api/sensors/esp32-test", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        idSensor: sensorId,
        lot: currentLot,
        available: !testSpace.available,
      }),
    })

    const data = await response.json()

    if (response.ok) {
      await new Promise((resolve) => setTimeout(resolve, 1000))

      // Atualizar UI
      testSpace.available = !testSpace.available
      updateUI()

      showToast(
        `✅ Demonstração concluída! Priority foi preservada: ${data.preservedPriority}. A vaga ${testSpace.id} continua prioritária mesmo após receber dados do ESP32!`,
        "success",
      )
    }
  } catch (error) {
    console.error("Erro na demonstração:", error)
    showToast("Erro na demonstração", "error")
  }
}

// Funções para o modal de demonstração
function showDemoModal() {
  const modal = document.getElementById("demo-modal")
  modal.classList.add("active")
}

function hideDemoModal() {
  const modal = document.getElementById("demo-modal")
  modal.classList.remove("active")
}

// Initialize the application
async function init() {
  // Check authentication first
  const isAuthenticated = await checkAuth()
  if (!isAuthenticated) return

  await initializeData()
  startPolling() // Start fetching data periodically

  // Update parking buttons
  updateParkingButtons()

  // Add event listeners for management buttons
  addSpaceBtn.addEventListener("click", showAddSpaceModal)
  removeSpaceBtn.addEventListener("click", enterSelectionMode)
  cancelSelectionBtn.addEventListener("click", exitSelectionMode)
  confirmSelectionBtn.addEventListener("click", removeSelectedSpaces)

  // Adicionar event listener para teste ESP32
  const testESP32Btn = document.getElementById("test-esp32-btn")
  if (testESP32Btn) {
    testESP32Btn.addEventListener("click", testESP32Data)
  }

  // Add event listeners for user management
  addUserBtn.addEventListener("click", showAddUserModal)
  listUsersBtn.addEventListener("click", showUsersListModal)

  // Add event listeners for lot management
  addLotBtn.addEventListener("click", showAddLotModal)
  removeLotBtn.addEventListener("click", showRemoveLotModal)

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

  // Lot modal event listeners - NOVA IMPLEMENTAÇÃO
  closeLotModalBtn.addEventListener("click", hideAddLotModal)
  const cancelNewLotBtn = document.getElementById("cancel-new-lot-btn")
  const addLotForm = document.getElementById("add-lot-form")

  if (cancelNewLotBtn) cancelNewLotBtn.addEventListener("click", hideAddLotModal)
  if (addLotForm) addLotForm.addEventListener("submit", handleAddLotSubmit)

  // Remove lot modal event listeners
  closeRemoveLotModalBtn.addEventListener("click", hideRemoveLotModal)
  cancelRemoveLotBtn.addEventListener("click", hideRemoveLotModal)
  confirmRemoveLotBtn.addEventListener("click", removeParkingLot)

  // Users list modal event listeners
  closeUsersListModalBtn.addEventListener("click", hideUsersListModal)

  // Event listeners para modal de demonstração
  const closeDemoModalBtn = document.querySelector(".close-demo-modal")
  const cancelDemoBtn = document.getElementById("cancel-demo-btn")
  const runDemoBtn = document.getElementById("run-demo-btn")

  if (closeDemoModalBtn) closeDemoModalBtn.addEventListener("click", hideDemoModal)
  if (cancelDemoBtn) cancelDemoBtn.addEventListener("click", hideDemoModal)
  if (runDemoBtn)
    runDemoBtn.addEventListener("click", () => {
      hideDemoModal()
      demonstratePriorityPersistence()
    })

  // Adicionar duplo clique no botão ESP32 para abrir demonstração
  if (testESP32Btn) {
    testESP32Btn.addEventListener("dblclick", showDemoModal)
  }

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
    if (event.target === addLotModal) {
      hideAddLotModal()
    }
    if (event.target === removeLotModal) {
      hideRemoveLotModal()
    }
    const demoModal = document.getElementById("demo-modal")
    if (event.target === demoModal) {
      hideDemoModal()
    }
  })

  // Clean up on page unload
  window.addEventListener("beforeunload", () => {
    stopPolling()
  })
}

// Make functions available globally
window.toggleSpacePriority = toggleSpacePriority
window.deleteUser = deleteUser
window.exportParkingData = exportParkingData
window.searchLots = searchLots
window.testESP32Data = testESP32Data
window.demonstratePriorityPersistence = demonstratePriorityPersistence

// Start the application when the DOM is fully loaded
document.addEventListener("DOMContentLoaded", init)
