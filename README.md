# Kilimo Fly

Kilimo Fly is a telemetry dashboard and backend service designed for agricultural environment monitoring. The system collects readings from hardware sensors connected to a microcontroller, ingests data through Adafruit IO over MQTT, broadcasts updates to web clients through WebSockets, and sends SMS notifications when monitored metrics cross defined limits.

---

## System Architecture

Data moves through four main stages:

1. **Edge Sensing**: A microcontroller (such as a Raspberry Pi Pico W) reads analog and digital sensors for soil moisture and temperature, then publishes values to Adafruit IO MQTT feeds.
2. **Backend Broker and Dispatcher**: The Python service in `api/main.py` subscribes to the MQTT topics, keeps the latest sensor states in memory, evaluates threshold-values, and manages WebSocket connections to web clients.
3. **Web Dashboard**: The browser interface in `index.html` connects to the `/ws` endpoint, receiving state updates and animating instrument dials in real time.
4. **SMS Dispatch**: When telemetry values exceed safety limits, the backend connects to the Africa's Talking API to deliver text alerts to configured phone-number-values.

---

## Repository Structure

```
kilimoFly/
├── api/
│   └── main.py          # Python aiohttp server, MQTT client, WebSocket handler
├── css/
│   └── style.css        # Dashboard stylesheet alias
├── scripts/
│   └── script.js        # Dashboard state management and animations
├── style/
│   └── style.css        # Dashboard layout, themes, and gauge styles
├── .env.example         # Template for environment variables
├── docker-compose.yml   # Multi-container orchestration (backend + nginx)
├── Dockerfile           # Backend container build definition
├── index.html           # Single-page web dashboard
├── nginx.conf           # Reverse proxy routing for HTTP and WebSockets
├── requirements.txt     # Python package dependencies
└── SPEC.md              # Technical specifications and design standards
```

---

## Configuration

Environment variables configure credentials and network settings. Start by creating a local `.env` file from `.env.example`:

```bash
cp .env.example .env
```

Set the configuration values inside `.env`:

```ini
AFRICASTALKING_API_KEY=api-key-value
AFRICASTALKING_USERNAME=username-value
AFRICASTALKING_PHONE=phone-number-value
AIO_USERNAME=aio-username-value
AIO_KEY=aio-key-value
PORT=8765
```

### Parameter Reference

- `AFRICASTALKING_API_KEY`: API key issued by Africa's Talking for SMS delivery.
- `AFRICASTALKING_USERNAME`: Account identifier on Africa's Talking (for example, `sandbox` or a production username-value).
- `AFRICASTALKING_PHONE`: Target phone-number-value in international format (e.g. `+254700000000`).
- `AIO_USERNAME`: Adafruit IO username-value associated with MQTT feeds. Defaults to `ironman_arcreactor` if omitted.
- `AIO_KEY`: Adafruit IO active key for MQTT authentication.
- `PORT`: TCP port-value for the Python backend. Defaults to `8765`.

### Alert Thresholds

Threshold-values are defined in `api/main.py`:

```python
MOISTURE_MIN = 60.0   # Percentage lower bound
MOISTURE_MAX = 70.0   # Percentage upper bound
TEMP_MIN = 27.0       # Temperature lower bound in Celsius
TEMP_MAX = 33.0       # Temperature upper bound in Celsius
```

When an incoming moisture-value or temperature-value leaves these ranges, the backend triggers alert dispatching.

---

## Getting Started

### Prerequisites

- Python 3.11 or newer
- Virtual environment tool (`venv` or `uv`)
- Docker and Docker Compose (optional, for containerized execution)

---

### Method 1: Local Execution

1. Create and activate a Python virtual environment:

```powershell
python -m venv .venv
# On Windows PowerShell:
.\.venv\Scripts\Activate.ps1
# On Linux/macOS:
source .venv/bin/activate
```

2. Install dependencies:

```powershell
pip install -r requirements.txt
```

3. Start the application backend:

```powershell
python api/main.py
```

The backend serves both the static dashboard and the WebSocket connection on the configured port-value (default `http://localhost:8765`).

4. Open `http://localhost:8765` in a web browser.

---

### Method 2: Docker Compose

Docker Compose runs the Python backend alongside an Nginx frontend reverse proxy.

1. Build and start containers:

```powershell
docker-compose up --build
```

2. Access the dashboard through Nginx on `http://localhost:8080`.

To stop services:

```powershell
docker-compose down
```

---

## MQTT Telemetry Specification

The backend listens to five feed channels on Adafruit IO:

| Feed Path | Metric | Expected Format | Nominal Range |
|---|---|---|---|
| `[username-value]/feeds/kilimofly-moisture` | Soil Moisture | Numeric float string | 0.0 to 100.0% |
| `[username-value]/feeds/home-temperature` | Ambient Temperature | Numeric float string | 20.0 to 40.0 °C |
| `[username-value]/feeds/space-state` | System Status | String | `OK`, `LOW MOISTURE`, `HIGH MOISTURE`, `LOW TEMP`, `HIGH TEMP` |
| `[username-value]/feeds/kilimofly-pump` | Irrigation Pump | String | `ON` or `OFF` |
| `[username-value]/feeds/kilimofly-heater` | Thermal Heater | String | `ON` or `OFF` |

---

## Dashboard Features

- **Circular Soil Dial**: 260-degree radial dial showing moisture percentage with designated dry, optimal, and wet segments.
- **Semicircular Temperature Dome**: 180-degree gauge marking cold, optimal, and heat zones in Celsius.
- **Actuator Monitors**: Real-time status badges for the water pump and canopy heater.
- **Status and Incident Banner**: Bottom strip indicating overall health status.
- **Theme Selection**: Switch between light and dark visual themes. Preference is stored in local storage.
- **Image Export**: HTML canvas capture button that downloads a PNG snapshot of current telemetry.

---

## License

This project is licensed under the MIT License. Details are available in the LICENSE file.
