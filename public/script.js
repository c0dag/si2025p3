// DOM Elements
const connectionAlert = document.getElementById('connection-alert');
const connectionStatus = document.getElementById('connection-status');
const parkingGrid = document.getElementById('parking-grid');
const lastUpdated = document.getElementById('last-updated');
const availableCount = document.getElementById('available-count');
const occupiedCount = document.getElementById('occupied-count');
const totalCount = document.getElementById('total-count');
const totalCount2 = document.getElementById('total-count-2');
const occupancyRate = document.getElementById('occupancy-rate');
const currentLotName = document.getElementById('current-lot-name');
const lotLocation = document.getElementById('lot-location');
const lotCapacity = document.getElementById('lot-capacity');

// Management elements
const addSpaceBtn = document.getElementById('add-space-btn');
const removeSpaceBtn = document.getElementById('remove-space-btn');
const selectionControls = document.getElementById('selection-controls');
const cancelSelectionBtn = document.getElementById('cancel-selection-btn');
const confirmSelectionBtn = document.getElementById('confirm-selection-btn');

// Modal elements
const addSpaceModal = document.getElementById('add-space-modal');
const closeModalBtn = document.querySelector('.close-modal');
const cancelAddBtn = document.getElementById('cancel-add-btn');
const confirmAddBtn = document.getElementById('confirm-add-btn');
const spaceIdInput = document.getElementById('space-id');

// State
let parkingLots = {
    1: {
        name: 'Estacionamento A',
        location: 'Prédio Principal',
        capacity: 20,
        spaces: []
    },
    2: {
        name: 'Estacionamento B',
        location: 'Centro Comercial',
        capacity: 30,
        spaces: []
    },
    3: {
        name: 'Estacionamento C',
        location: 'Complexo de Escritórios',
        capacity: 15,
        spaces: []
    }
};

let currentLot = 1;
let isConnected = false;
let isSelectionMode = false;
let selectedSpaces = [];

// Initialize with all spaces unavailable
function initializeData() {
    // Generate data for each lot with all spaces unavailable (false)
    Object.keys(parkingLots).forEach(lotId => {
        const lot = parkingLots[lotId];
        lot.spaces = Array.from({ length: lot.capacity }, (_, i) => ({
            id: `P${i + 1}`,
            available: true, // All spaces start as unavailable
            lotId: lotId
        }));
    });
    
    updateUI();
}

// Connect to WebSocket server
function connectWebSocket() {
    // Connect to the WebSocket server
    const socket = new WebSocket('ws://0.tcp.sa.ngrok.io:11378');
    
    socket.onopen = () => {
        console.log('Conectado ao servidor WebSocket');
        setConnectionStatus(true);
    };
    
    socket.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            console.log('Dados recebidos:', data);
            
            // Check if we received an array of parking spaces
            if (Array.isArray(data) && data.length > 0) {
                // Update spaces based on received data
                data.forEach(space => {
                    if (space && space.id && space.hasOwnProperty('available') && space.lotId) {
                        const lotId = space.lotId;
                        if (parkingLots[lotId]) {
                            updateParkingSpace(space, lotId);
                        }
                    }
                });
                
                updateLastUpdated();
                updateUI();
            } 
            // Handle individual space update
            else if (data.id && data.hasOwnProperty('available') && data.lotId) {
                const lotId = data.lotId;
                if (parkingLots[lotId]) {
                    updateParkingSpace(data, lotId);
                    updateLastUpdated();
                    updateUI();
                }
            }
        } catch (error) {
            console.error('Erro ao analisar dados do WebSocket:', error);
        }
    };
    
    socket.onclose = () => {
        console.log('Desconectado do servidor WebSocket');
        setConnectionStatus(false);
    };
    
    socket.onerror = (error) => {
        console.error('Erro no WebSocket:', error);
        setConnectionStatus(false);
    };
    
    return socket;
}

// Update connection status UI
function setConnectionStatus(connected) {
    isConnected = connected;
    
    if (connected) {
        document.body.classList.add('connected');
        connectionStatus.classList.remove('offline');
        connectionStatus.classList.add('online');
        connectionStatus.innerHTML = '<i class="fas fa-wifi"></i><span>Online</span>';
    } else {
        document.body.classList.remove('connected');
        connectionStatus.classList.remove('online');
        connectionStatus.classList.add('offline');
        connectionStatus.innerHTML = '<i class="fas fa-wifi"></i><span>Offline</span>';
    }
}

// Update a single parking space
function updateParkingSpace(updatedSpace, lotId) {
    const index = parkingLots[lotId].spaces.findIndex(space => space.id === updatedSpace.id);
    
    if (index !== -1) {
        parkingLots[lotId].spaces[index] = { 
            ...parkingLots[lotId].spaces[index], 
            ...updatedSpace,
            timestamp: updatedSpace.timestamp || new Date().toISOString()
        };
        console.log(`Vaga ${updatedSpace.id} no estacionamento ${lotId} atualizada para ${updatedSpace.available ? 'disponível' : 'ocupada'}`);
    } else {
        // If the space doesn't exist yet, add it
        parkingLots[lotId].spaces.push({
            id: updatedSpace.id,
            available: updatedSpace.available,
            lotId: lotId,
            timestamp: updatedSpace.timestamp || new Date().toISOString()
        });
        console.log(`Nova vaga ${updatedSpace.id} adicionada ao estacionamento ${lotId}`);
    }
}

// Update the last updated timestamp
function updateLastUpdated() {
    const now = new Date();
    lastUpdated.textContent = now.toLocaleTimeString();
}

// Render the parking grid for the current lot
function renderParkingGrid() {
    parkingGrid.innerHTML = '';
    
    const currentLotSpaces = parkingLots[currentLot].spaces;
    
    currentLotSpaces.forEach(space => {
        const spaceElement = document.createElement('div');
        spaceElement.className = `parking-space ${space.available ? 'available' : 'occupied'}`;
        
        // Add selectable class if in selection mode
        if (isSelectionMode) {
            spaceElement.classList.add('selectable');
            
            // Add selected class if this space is selected
            if (selectedSpaces.includes(space.id)) {
                spaceElement.classList.add('selected');
            }
        }
        
        spaceElement.id = `space-${space.id}`;
        spaceElement.dataset.id = space.id;
        
        const statusClass = space.available ? 'available' : 'occupied';
        const statusText = space.available ? 'Disponível' : 'Ocupada';
        
        spaceElement.innerHTML = `
            <div class="space-status ${statusClass}">${statusText}</div>
            <div class="space-icon ${statusClass}">
                <i class="fas fa-car"></i>
            </div>
            <div class="space-id">${space.id}</div>
            ${space.timestamp ? `<div class="space-time">${new Date(space.timestamp).toLocaleTimeString()}</div>` : ''}
        `;
        
        // Add click event for selection mode
        if (isSelectionMode) {
            spaceElement.addEventListener('click', () => toggleSpaceSelection(space.id));
        }
        
        parkingGrid.appendChild(spaceElement);
    });
}

// Toggle selection of a parking space
function toggleSpaceSelection(spaceId) {
    const index = selectedSpaces.indexOf(spaceId);
    
    if (index === -1) {
        // Add to selected spaces
        selectedSpaces.push(spaceId);
    } else {
        // Remove from selected spaces
        selectedSpaces.splice(index, 1);
    }
    
    // Update UI to reflect selection
    const spaceElement = document.getElementById(`space-${spaceId}`);
    if (spaceElement) {
        spaceElement.classList.toggle('selected', selectedSpaces.includes(spaceId));
    }
    
    // Update confirm button state
    confirmSelectionBtn.disabled = selectedSpaces.length === 0;
}

// Enter selection mode for removing spaces
function enterSelectionMode() {
    isSelectionMode = true;
    selectedSpaces = [];
    selectionControls.classList.remove('hidden');
    removeSpaceBtn.disabled = true;
    addSpaceBtn.disabled = true;
    
    // Update UI to make spaces selectable
    updateUI();
}

// Exit selection mode
function exitSelectionMode() {
    isSelectionMode = false;
    selectedSpaces = [];
    selectionControls.classList.add('hidden');
    removeSpaceBtn.disabled = false;
    addSpaceBtn.disabled = false;
    
    // Update UI to remove selectable state
    updateUI();
}

// Remove selected spaces
function removeSelectedSpaces() {
    if (selectedSpaces.length === 0) return;
    
    // Remove each selected space from the current lot
    selectedSpaces.forEach(spaceId => {
        const index = parkingLots[currentLot].spaces.findIndex(space => space.id === spaceId);
        if (index !== -1) {
            parkingLots[currentLot].spaces.splice(index, 1);
        }
    });
    
    // Update capacity
    parkingLots[currentLot].capacity = parkingLots[currentLot].spaces.length;
    
    // Exit selection mode and update UI
    exitSelectionMode();
    updateUI();
}

// Add a new parking space
function addNewSpace(spaceId) {
    if (!spaceId) return;
    
    // Check if space ID already exists
    const exists = parkingLots[currentLot].spaces.some(space => space.id === spaceId);
    if (exists) {
        alert(`Vaga com ID ${spaceId} já existe no estacionamento atual.`);
        return false;
    }
    
    // Add new space
    parkingLots[currentLot].spaces.push({
        id: spaceId,
        available: true,
        lotId: currentLot.toString(),
        timestamp: new Date().toISOString()
    });
    
    // Update capacity
    parkingLots[currentLot].capacity = parkingLots[currentLot].spaces.length;
    
    // Update UI
    updateUI();
    return true;
}

// Show add space modal
function showAddSpaceModal() {
    addSpaceModal.classList.add('active');
    spaceIdInput.value = '';
    spaceIdInput.focus();
}

// Hide add space modal
function hideAddSpaceModal() {
    addSpaceModal.classList.remove('active');
}

// Update statistics for the current lot
function updateStats() {
    const currentLotSpaces = parkingLots[currentLot].spaces;
    const total = currentLotSpaces.length;
    const available = currentLotSpaces.filter(space => space.available).length;
    const occupied = total - available;
    const rate = total > 0 ? Math.round((occupied / total) * 100) : 0;
    
    availableCount.textContent = available;
    occupiedCount.textContent = occupied;
    totalCount.textContent = total;
    totalCount2.textContent = total;
    occupancyRate.textContent = `${rate}%`;
}

// Update lot information
function updateLotInfo() {
    const lot = parkingLots[currentLot];
    currentLotName.textContent = lot.name;
    lotLocation.textContent = lot.location;
    lotCapacity.textContent = `${lot.capacity} Vagas`;
}

// Update the entire UI
function updateUI() {
    renderParkingGrid();
    updateStats();
    updateLotInfo();
}

// Switch to a different parking lot
function switchParkingLot(lotId) {
    // Exit selection mode if active
    if (isSelectionMode) {
        exitSelectionMode();
    }
    
    currentLot = lotId;
    
    // Update active button
    document.querySelectorAll('.parking-button').forEach(button => {
        if (button.dataset.lot === lotId.toString()) {
            button.classList.add('active');
        } else {
            button.classList.remove('active');
        }
    });
    
    updateUI();
}

// Initialize the application
function init() {
    initializeData(); // Initialize with all spaces unavailable
    const socket = connectWebSocket();
    
    // Add event listeners to parking lot buttons
    document.querySelectorAll('.parking-button').forEach(button => {
        button.addEventListener('click', function() {
            const lotId = parseInt(this.dataset.lot);
            console.log('Botão clicado para estacionamento:', lotId);
            switchParkingLot(lotId);
        });
    });
    
    // Add event listeners for management buttons
    addSpaceBtn.addEventListener('click', showAddSpaceModal);
    removeSpaceBtn.addEventListener('click', enterSelectionMode);
    cancelSelectionBtn.addEventListener('click', exitSelectionMode);
    confirmSelectionBtn.addEventListener('click', removeSelectedSpaces);
    
    // Modal event listeners
    closeModalBtn.addEventListener('click', hideAddSpaceModal);
    cancelAddBtn.addEventListener('click', hideAddSpaceModal);
    confirmAddBtn.addEventListener('click', () => {
        const spaceId = spaceIdInput.value.trim();
        if (spaceId && addNewSpace(spaceId)) {
            hideAddSpaceModal();
        }
    });
    
    // Close modal when clicking outside
    window.addEventListener('click', (event) => {
        if (event.target === addSpaceModal) {
            hideAddSpaceModal();
        }
    });
    
    // Clean up on page unload
    window.addEventListener('beforeunload', () => {
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.close();
        }
    });
}

// Start the application when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', init);