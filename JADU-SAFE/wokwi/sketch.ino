/*
  JADU-SAFE Wokwi station
  Synthetic LOW -> MEDIUM -> HIGH data is sent to the FastAPI backend.
  Thresholds are demonstration values only.

  Set SERVER_URL to a public HTTPS tunnel that forwards to localhost:8000.
*/
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <RTClib.h>

const char* WIFI_SSID = "Wokwi-GUEST";
const char* WIFI_PASS = "";
const char* SERVER_URL = "https://YOUR-TUNNEL.trycloudflare.com";
const char* API_KEY = "jadu-demo-key";
const char* STATION_ID = "JADU-STATION-01";

LiquidCrystal_I2C lcd(0x27, 16, 2);
RTC_DS1307 rtc;

// These pins match diagram.json.
#define GREEN_LED 25
#define YELLOW_LED 26
#define RED_LED 27

float temperature = 0;
float humidity = 0;
float radiation = 0;
float pm25 = 0;
float pm10 = 0;
float pHValue = 0;
float tdsValue = 0;
float airflow = 0;

int riskLevel = 0;
int scenario = 0;
int screen = 0;
unsigned long startTime = 0;
unsigned long lastUpdate = 0;
unsigned long lastLCD = 0;
unsigned long lastSerial = 0;
unsigned long lastSend = 0;

float variation(float base, float amount) {
  return base + random(-100, 101) / 100.0 * amount;
}

void generateData() {
  scenario = ((millis() - startTime) / 15000) % 3;

  if (scenario == 0) {
    temperature = variation(28, 1);
    humidity = variation(55, 2);
    radiation = variation(0.12, 0.01);
    pm25 = variation(20, 2);
    pm10 = variation(35, 2);
    pHValue = variation(7.2, 0.1);
    tdsValue = variation(200, 10);
    airflow = variation(2.5, 0.15);
    riskLevel = 0;
  } else if (scenario == 1) {
    temperature = variation(33, 1);
    humidity = variation(70, 2);
    radiation = variation(0.22, 0.01);
    pm25 = variation(45, 2);
    pm10 = variation(80, 2);
    pHValue = variation(6.6, 0.05);
    tdsValue = variation(450, 10);
    airflow = variation(1.3, 0.1);
    riskLevel = 1;
  } else {
    temperature = variation(37, 1);
    humidity = variation(80, 2);
    radiation = variation(0.34, 0.01);
    pm25 = variation(85, 2);
    pm10 = variation(130, 2);
    pHValue = variation(5.9, 0.05);
    tdsValue = variation(750, 10);
    airflow = variation(0.4, 0.05);
    riskLevel = 2;
  }
}

void checkRisk() {
  digitalWrite(GREEN_LED, riskLevel == 0);
  digitalWrite(YELLOW_LED, riskLevel == 1);
  digitalWrite(RED_LED, riskLevel == 2);
}

void displayLCD() {
  lcd.clear();
  switch (screen) {
    case 0:
      lcd.setCursor(0, 0);
      lcd.print("Temperature:");
      lcd.print(temperature, 1);
      lcd.setCursor(0, 1);
      lcd.print("Humidity:");
      lcd.print(humidity, 1);
      lcd.print("%");
      break;
    case 1:
      lcd.setCursor(0, 0);
      lcd.print("Radiation:");
      lcd.setCursor(0, 1);
      lcd.print(radiation, 3);
      lcd.print(" uSv/h");
      break;
    case 2:
      lcd.setCursor(0, 0);
      lcd.print("PM2.5:");
      lcd.print(pm25, 1);
      lcd.setCursor(0, 1);
      lcd.print("PM10:");
      lcd.print(pm10, 1);
      break;
    case 3:
      lcd.setCursor(0, 0);
      lcd.print("Water pH:");
      lcd.print(pHValue, 2);
      lcd.setCursor(0, 1);
      lcd.print((pHValue < 6.5 || pHValue > 8.5) ? "NOT NORMAL" : "NORMAL");
      break;
    case 4:
      lcd.setCursor(0, 0);
      lcd.print("Water TDS:");
      lcd.setCursor(0, 1);
      lcd.print(tdsValue, 1);
      lcd.print(" ppm");
      break;
    case 5: {
      DateTime now = rtc.now();
      lcd.setCursor(0, 0);
      lcd.print("Date:");
      lcd.print(now.day());
      lcd.print("/");
      lcd.print(now.month());
      lcd.print("/");
      lcd.print(now.year());
      lcd.setCursor(0, 1);
      lcd.print("Time:");
      if (now.hour() < 10) lcd.print("0");
      lcd.print(now.hour());
      lcd.print(":");
      if (now.minute() < 10) lcd.print("0");
      lcd.print(now.minute());
      break;
    }
    default:
      lcd.setCursor(0, 0);
      lcd.print("JADU-SAFE STATUS");
      lcd.setCursor(0, 1);
      lcd.print(riskLevel == 0 ? "LOW RISK GREEN" :
                riskLevel == 1 ? "MEDIUM YELLOW" : "HIGH RISK RED");
      break;
  }
  screen = (screen + 1) % 7;
}

void displaySerial() {
  Serial.printf("scenario=%d temp=%.1f humidity=%.1f rad=%.3f pm25=%.1f pm10=%.1f pH=%.2f tds=%.1f airflow=%.2f risk=%d\n",
                scenario, temperature, humidity, radiation, pm25, pm10,
                pHValue, tdsValue, airflow, riskLevel);
}

void connectWifi() {
  if (WiFi.status() == WL_CONNECTED) return;
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  Serial.print("Connecting to Wi-Fi");
  unsigned long started = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - started < 10000) {
    delay(300);
    Serial.print(".");
  }
  Serial.println(WiFi.status() == WL_CONNECTED ? " connected" : " failed");
}

void sendReading() {
  if (WiFi.status() != WL_CONNECTED) return;

  DateTime now = rtc.now();
  char timestamp[25];
  snprintf(timestamp, sizeof(timestamp), "%04d-%02d-%02dT%02d:%02d:%02d",
           now.year(), now.month(), now.day(), now.hour(), now.minute(), now.second());

  char body[420];
  snprintf(body, sizeof(body),
    "{\"station_id\":\"%s\",\"radon_bqm3\":%.1f,\"gamma_usvh\":%.3f,"
    "\"pm25\":%.1f,\"pm10\":%.1f,\"ph\":%.2f,\"tds\":%.1f,"
    "\"airflow_ms\":%.2f,\"temperature\":%.1f,\"humidity\":%.1f,\"timestamp\":\"%s\"}",
    STATION_ID, radiation * 1000.0, radiation, pm25, pm10, pHValue,
    tdsValue, airflow, temperature, humidity, timestamp);

  String url = String(SERVER_URL) + "/api/sensors";
  HTTPClient http;
  WiFiClientSecure secure;
  secure.setInsecure();
  http.begin(secure, url);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-API-Key", API_KEY);
  http.setTimeout(8000);
  int code = http.POST(body);
  Serial.printf("Backend POST: HTTP %d\n", code);
  if (code > 0) Serial.println(http.getString());
  http.end();
}

void setup() {
  Serial.begin(115200);
  pinMode(GREEN_LED, OUTPUT);
  pinMode(YELLOW_LED, OUTPUT);
  pinMode(RED_LED, OUTPUT);
  Wire.begin(21, 22);
  lcd.init();
  lcd.backlight();
  if (!rtc.begin()) {
    Serial.println("RTC NOT FOUND");
  } else if (!rtc.isrunning()) {
    rtc.adjust(DateTime(F(__DATE__), F(__TIME__)));
  }
  randomSeed(micros());
  lcd.setCursor(0, 0);
  lcd.print("JADU-SAFE");
  lcd.setCursor(0, 1);
  lcd.print("Starting System");
  delay(2000);
  startTime = millis();
  generateData();
  checkRisk();
  connectWifi();
  lastUpdate = millis();
  lastLCD = millis();
  lastSerial = millis();
}

void loop() {
  unsigned long currentTime = millis();
  if (currentTime - lastUpdate >= 3000) {
    lastUpdate = currentTime;
    generateData();
    checkRisk();
  }
  if (currentTime - lastLCD >= 3000) {
    lastLCD = currentTime;
    displayLCD();
  }
  if (currentTime - lastSerial >= 3000) {
    lastSerial = currentTime;
    displaySerial();
  }
  if (currentTime - lastSend >= 3000) {
    lastSend = currentTime;
    connectWifi();
    sendReading();
  }
}
