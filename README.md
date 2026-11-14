# Kilimo Fly

Real-time agricultural monitoring for modern farming. Track soil moisture, temperature, and system status from anywhere in the world.

---

## What is Kilimo Fly?

Kilimo Fly is a monitoring dashboard that connects to your Raspberry Pi Pico W running Miagriculturalython. The hardware reads soil moisture sensors and temperature probes, then publishes the data to Adafruit IO over MQTT. This dashboard subscribes to those feeds and displays everything in a clean, responsive interface.

When sensor values fall outside safe ranges, you'll receive instant SMS alerts so you can take action before conditions deteriorate.

---

## Features

**Real-time Monitoring**
- Soil moisture levels displayed on a precision 260° circular instrument dial (0-100%) with radial perimeter scale numbers and pointer
- Temperature readings displayed on an arched 180° semicircle speedometer dome (20-40°C) with colored temperature zones
- Actuator status indicators (water pump and canopy heater) located at the top of the dashboard for immediate equipment awareness
- Live system alerts panel and telemetry indicators

**Smart Alerts**
- Automatic SMS notifications via Africa's Talking when thresholds are crossed
- Low moisture, high moisture, low temperature, and high temperature warnings
- Configurable threshold ranges

**Beautiful Interface**
- Light and dark theme toggle
- Smooth GSAP animations throughout
- Fully responsive design works on desktop, tablet, and mobile
- Export current dashboard view as PNG image

---

## Quick Start

### Prerequisites

- Python 3.11 or higher
- Docker (optional, for containerized deployment)

### Running Without Docker

1. Install the required Python packages:

```powershell
pip install -r requirements.txt
```

2. Create your environment file:

```powershell
copy .env.example .env
```

Edit `.env` and add your Africa Talking credentials:

```
AFRICASTALKING_API_KEY=your_api_key_here
AFRICASTALKING_USERNAME=your_username_here
AFRICASTALKING_PHONE=+254700000000
```

3. Start the backend service:

```powershell
python api/main.py
```

4. In a separate terminal, serve the frontend:

```powershell
python -m http.server 8080
```

5. Open your browser to `http://localhost:8080`

### Running With Docker

1. Configure your environment variables in `.env`

2. Build and start all services:

```powershell
docker-compose up --build
```

3. Access the dashboard at `http://localhost:8080`

---

## Hardware Setup

This dashboard expects data from a Raspberry Pi Pico W running the Miagriculturalython firmware. The device should publish to these Adafruit IO feeds:

| Feed | Topic | Description |
|------|-------|-------------|
| kilimofly-moisture | `ironman_arcreactor/feeds/kilimofly-moisture` | Soil moisture percentage (0-100) |
| home-temperature | `ironman_arcreactor/feeds/home-temperature` | Temperature in celsius |
| space-state | `ironman_arcreactor/feeds/space-state` | Alert status (OK, LOW MOISTURE, etc.) |
| kilimofly-pump | `ironman_arcreactor/feeds/kilimofly-pump` | Pump status (ON/OFF) |
| kilimofly-heater | `ironman_arcreactor/feeds/kilimofly-heater` | Heater status (ON/OFF) |

The moisture target range is 60-70% and temperature should stay between 27-33C. These thresholds trigger automatic alerts when crossed.

---

## Project Structure

```
kilimoFly/
├── api/
│   └── main.py          # Python backend (MQTT + WebSocket)
├── index.html           # Main dashboard frontend
├── docker-compose.yml   # Container orchestration
├── Dockerfile           # Backend container definition
├── nginx.conf           # WebSocket proxy configuration
├── requirements.txt     # Python dependencies
└── .env.example         # Environment template
```

---

## Configuration

### Threshold Adjustment

To modify alert thresholds, edit these values in `api/main.py`:

```python
MOISTURE_MIN = 60.0
MOISTURE_MAX = 70.0
TEMP_MIN = 27.0
TEMP_MAX = 33.0
```

### MQTT Credentials

The dashboard is pre-configured to connect to Adafruit IO with the username `ironman_arcreactor`. If you need to use different credentials, update these constants in `api/main.py`:

```python
AIO_USERNAME = 'your_username'
AIO_KEY = 'your_key'
```

---

## Screenshots

The dashboard features horizontal gauges with color gradients that show at-a-glance status. The moisture bar transitions from brown (dry) to blue (wet), while temperature moves from blue (cold) through green (optimal) to red (hot).

![Dashboard Light Theme](docs/dashboard-light.png)

Dark theme is also available for low-light environments:

![Dashboard Dark Theme](docs/dashboard-dark.png)

---

## Technology Stack

- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Animations**: GSAP 3.x
- **Icons**: Phosphor Icons
- **Fonts**: Sarabun, Kingred
- **Backend**: Python asyncio, paho-mqtt, websockets
- **SMS**: Africa's Talking API
- **Deployment**: Docker, nginx

---

## License

MIT License