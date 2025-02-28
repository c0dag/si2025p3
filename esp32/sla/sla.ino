#include <WiFi.h>
#include <ArduinoWebsockets.h>

#define BUTTON_PIN 21

// Configurações WiFi
const char* ssid = "teste";
const char* password = "12345678";
const char* websockets_server = "ws://192.168.100.165:8080";

using namespace websockets;
WebsocketsClient client;

int lastState = HIGH;
int currentState;

void setup() {
  Serial.begin(9600);
  delay(1000);

  WiFi.begin(ssid, password);
  Serial.printf("Conectando a: %s\n", ssid);
  while (WiFi.status() != WL_CONNECTED) {
    Serial.print(".");
    delay(1000);
  }
  Serial.print("\nConectado com IP: ");
  Serial.println(WiFi.localIP());

  pinMode(BUTTON_PIN, INPUT_PULLUP);

  // Tenta conectar ao WebSocket até ser bem-sucedido
  while (!client.connect(websockets_server)) {
    Serial.println("\nFalha ao conectar no WebSocket Server, tentando novamente...");
    delay(2000); // Espera 2s antes de tentar de novo
  }
  
  Serial.println("\nConectado ao WebSocket Server");
  client.send("ESP32 conectado");
}

void sendWebSocketMessage(const char* state) {
  if (client.available()) {
    client.send(String("{\"state\":\"") + state + "\"}");
  } else {
    Serial.println("WebSocket não está conectado!");
  }
}

void loop() {
  // Verifica a conexão do WebSocket e tenta reconectar, se necessário
  if (!client.available()) {
    Serial.println("Desconectado do WebSocket. Tentando reconectar...");
    while (!client.connect(websockets_server)) {
      delay(2000); // Espera 2s antes de tentar reconectar
      Serial.print(".");
    }
    Serial.println("\nReconectado ao WebSocket Server");
  }

  // Leitura do estado do botão
  currentState = digitalRead(BUTTON_PIN);
  if (lastState == HIGH && currentState == LOW) {
    Serial.println("O botão foi pressionado");
    sendWebSocketMessage("pressed");
  } else if (lastState == LOW && currentState == HIGH) {
    Serial.println("O botão foi liberado");
    sendWebSocketMessage("released");
  }

  lastState = currentState;

  client.poll(); // Permite o processamento de mensagens WebSocket
  delay(50);
}
