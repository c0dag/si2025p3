#include <WiFi.h>
#include <HTTPClient.h>

#define TRIG_PIN 13
int echoPins[] = {14, 27, 26, 25};

// Wi-Fi credentials
const char* ssid = "teste";
const char* password = "12345678";

// sensor config: {idSensor, lot}
struct SensorConfig {
  int idSensor;
  int lot;
};

SensorConfig sensors[] = {
  {1, 1},
  {2, 1},
  {1, 2},
  {1, 3}
};

void setup() {
  Serial.begin(115200);
  pinMode(TRIG_PIN, OUTPUT);
  digitalWrite(TRIG_PIN, LOW);
  for (int i = 0; i < 4; i++) {
    pinMode(echoPins[i], INPUT);
  }

  // connect to Wi-Fi
  WiFi.begin(ssid, password);
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi connected.");
}

float readSensor(int echoPin) {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);

  long duration = pulseIn(echoPin, HIGH, 30000);
  if (duration == 0) return -1;
  return duration * 0.0343 / 2;
}

void loop() {
  String payload = "";

  for (int i = 0; i < 4; i++) {
    float distance = readSensor(echoPins[i]);
    bool available = distance > 10;

    payload += "{";
    payload += "\"idSensor\":" + String(sensors[i].idSensor) + ",";
    payload += "\"lot\":" + String(sensors[i].lot) + ",";
    payload += "\"available\":" + String(available ? "true" : "false");
    payload += "}";

    if (i < 3) payload += ",";
    delay(100);
  }

  payload = "[" + payload + "]";

  Serial.println("Sending JSON:");
  Serial.println(payload);

  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin("http://192.168.100.18:8080/api/sensors");  
    http.addHeader("Content-Type", "application/json");

    int httpResponseCode = http.POST(payload);
    Serial.print("Response code: ");
    Serial.println(httpResponseCode);

    String response = http.getString();
    Serial.println("Server response:");
    Serial.println(response);

    http.end();
  } else {
    Serial.println("WiFi not connected.");
  }

  Serial.println("----");
  delay(5000); // every 5 seconds
}
