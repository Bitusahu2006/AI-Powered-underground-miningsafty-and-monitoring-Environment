Wokwi setup
1. Open https://wokwi.com -> New Project -> ESP32.
2. Replace sketch.ino with this sketch.ino, diagram.json with this diagram.json,
   and add libraries.txt (or install "DHT sensor library" and "RTClib" in Library Manager).
3. Edit SERVER_URL in sketch.ino with your public tunnel URL (see ../README.md).
4. Start the backend and expose it with a tunnel:
   `cloudflared tunnel --url http://localhost:8000`
5. Copy the tunnel URL into `SERVER_URL` in sketch.ino. Wokwi cannot reach
   `localhost` directly.
6. Start the simulation. The sketch cycles LOW, MEDIUM and HIGH data every
   15 seconds and posts Station 01 readings to `/api/sensors` every 3 seconds.
