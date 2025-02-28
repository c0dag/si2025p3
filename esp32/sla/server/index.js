const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 8080 });

wss.on('connection', (ws, req) => {
    console.log('ESP32 connected');

    // Broadcast message to all connected clients
    const sendToClients = (message) => {
        wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(message);
            }
        });
    };

    ws.on('message', (message) => {
        console.log(`Received: ${message}`);
        
        // Parse the incoming JSON message
        try {
            const data = JSON.parse(message);
            if (data.state === "pressed") {
                console.log("Button was pressed!");
                sendToClients(JSON.stringify({ state: "pressed" })); // Broadcast pressed state
            } else if (data.state === "released") {
                console.log("Button was released!");
                sendToClients(JSON.stringify({ state: "released" })); // Broadcast released state
            }
        } catch (e) {
            console.log("Invalid JSON received");
        }
    });

    ws.on('close', () => {
        console.log('ESP32 disconnected');
    });

    ws.send('Hello ESP32, WebSocket Server is live!');
});

console.log('WebSocket server running on ws://localhost:8080');
