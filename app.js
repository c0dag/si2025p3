const express = require("express");
const path = require("path");
const WebSocket = require("ws");

const app = express();
const PORT = process.env.PORT || 8080;

// Serve arquivos estáticos da pasta 'public'
app.use(express.static(path.join(__dirname, "public")));

// Cria o servidor HTTP e anexa o WebSocket
const server = app.listen(PORT, () => {
  console.log(`Servidor HTTP rodando em localhost:${PORT}`);
});

// Cria o servidor WebSocket utilizando o mesmo servidor HTTP
const wss = new WebSocket.Server({ server });

wss.on("connection", (ws, req) => {
    console.log("ESP32 conectado");

    // Função para enviar mensagem para todos os clientes conectados
    const sendToClients = (message) => {
        wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(message);
            }
        });
    };

    ws.on("message", (message) => {
        console.log(`Recebido: ${message}`);
        
        try {
            const data = JSON.parse(message);

            // Verifica se o dado é um array e valida cada objeto recebido
            if (Array.isArray(data)) {
                const validSensors = data.every(sensor =>
                    sensor &&
                    typeof sensor.id === "string" &&
                    typeof sensor.available === "boolean" &&
                    typeof sensor.lotId === "string" &&
                    typeof sensor.timestamp === "string"
                );

                if (validSensors) {
                    console.log("Dados de sensores recebidos e validados:");
                    data.forEach(sensor => {
                        console.log(`Sensor ${sensor.id} - Lot: ${sensor.lotId}, Disponível: ${sensor.available}, Timestamp: ${sensor.timestamp}`);
                    });

                    // Envia os dados para todos os clientes (por exemplo, para atualizar em tempo real via script no HTML)
                    sendToClients(JSON.stringify(data));
                } else {
                    console.log("Estrutura de dados de sensores inválida");
                }
            } else {
                console.log("Os dados recebidos não são um array");
            }
        } catch (e) {
            console.log("JSON inválido recebido");
        }
    });

    ws.on("close", () => {
        console.log("ESP32 desconectado");
    });

    ws.send("Olá ESP32, servidor WebSocket está ativo!");
});

console.log(`Servidor WebSocket rodando em ws://localhost:${PORT}`);
