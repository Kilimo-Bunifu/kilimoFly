# Kilimo Fly - Real-time Monitoring Dashboard

## Project Overview

**Project Name:** Kilimo Fly Dashboard  
**Type:** Real-time IoT Monitoring Web Application  
**Core Functionality:** Display real-time sensor data from hardware via MQTT with alerts via SMS  
**Target Users:** Farm operators monitoring soil moisture and temperature

---

## Data Sources (MQTT Topics)

| Topic | Format | Range | Description |
|-------|--------|-------|-------------|
| `ironman_arcreactor/feeds/kilimofly-moisture` | String (float) | 0-100% | Soil moisture percentage |
| `ironman_arcreactor/feeds/home-temperature` | String (float) | ~20-40°C | Temperature in Celsius |
| `ironman_arcreactor/feeds/space-state` | String | 'LOW MOISTURE', 'HIGH MOISTURE', 'LOW TEMP', 'HIGH TEMP', 'OK' | Alert status |
| `ironman_arcreactor/feeds/kilimofly-pump` | String | 'ON', 'OFF' | Pump actuator status |
| `ironman_arcreactor/feeds/kilimofly-heater` | String | 'ON', 'OFF' | Heater actuator status |

---

## UI/UX Specification

### Layout Structure

```
┌─────────────────────────────────────────────────────────┐
│  HEADER: Logo + Live Telemetry + Theme + Export         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────────────────┐  ┌─────────────────────┐     │
│  │   WATER PUMP        │  │   THERMAL HEATER    │     │
│  │   [ON / OFF Status] │  │   [ON / OFF Status] │     │
│  └─────────────────────┘  └─────────────────────┘     │
│                                                         │
│  ┌─────────────────────┐  ┌─────────────────────┐     │
│  │   SOIL MOISTURE     │  │  AMBIENT TEMPERATURE│     │
│  │   (Circular Dial)   │  │  (Semicircle Dome)  │     │
│  │   Radial 0 - 100%   │  │   Radial 20 - 40°C  │     │
│  └─────────────────────┘  └─────────────────────┘     │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │              SYSTEM ALERTS PANEL                │   │
│  │  Shows current alert status from space-state    │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Responsive Breakpoints
- Desktop: > 900px (side-by-side gauges)
- Tablet: 600-900px (stacked in pairs)
- Mobile: < 600px (single column)

### Visual Design

#### Color Palette
**Light Theme:**
- Background: `#F7F5F2` (warm off-white)
- Card Background: `#FFFFFF`
- Primary Text: `#1A1A1A`
- Secondary Text: `#5C5C5C`
- Accent: `#2D5A27` (forest green - agriculture theme)
- Accent Secondary: `#8B4513` (saddle brown - earth)
- Success: `#2D8A3C`
- Warning: `#D4A017`
- Danger: `#B33A3A`
- Border: `#E5E2DE`

**Dark Theme:**
- Background: `#121212`
- Card Background: `#1E1E1E`
- Primary Text: `#E8E6E3`
- Secondary Text: `#9E9E9E`
- Accent: `#4CAF50`
- Accent Secondary: `#CD853F`
- Success: `#4CAF50`
- Warning: `#FFC107`
- Danger: `#EF5350`
- Border: `#333333`

#### Typography
- **Headings:** Kingred (serif, distinctive)
- **Body/UI:** Sarabun (clean, modern)
- Font sizes:
  - Logo: 28px bold
  - Section headers: 18px semibold
  - Body: 16px regular
  - Small/labels: 13px

#### Spacing System
- Base unit: 8px
- Card padding: 24px
- Gap between cards: 20px
- Section margins: 32px

### Components

#### 1. Moisture Gauge (260° Circular Instrument Dial)
- 260° circular sweep dial (from 140° to 400°)
- Segmented color bands: Dry (Amber: 0-60%), Optimal (Emerald Green: 60-70%), Wet (Ocean Blue: 70-100%)
- Radial scale numbers (0, 20, 40, 60, 80, 100) mathematically positioned around the perimeter of the circle
- Internal radial major and minor tick marks
- Tapered instrument needle pointer with central circular pivot hub
- Large digital readout (% VWC) centered inside lower aperture
- Smooth needle and value transitions powered by GSAP

#### 2. Temperature Gauge (180° Semicircle Speedometer Dome)
- 180° arched dome speedometer layout (from 180° flat-left to 360° flat-right)
- Distinct multi-color segmented arch: Cold (Sky Blue: 20-27°C), Optimal (Emerald Green: 27-33°C), Hot (Crimson Red: 33-40°C)
- Radial scale numbers (20°, 25°, 30°, 35°, 40°) surrounding the outer arch
- Internal radial tick marks along the arch
- High-visibility automotive/speedometer needle pointer with counterweight base and center cap
- Large digital readout (°C) centered beneath horizontal baseline
- Smooth needle transitions with elastic easing via GSAP

#### 3. Status Indicators (Pump & Heater)
- Pill-shaped indicator
- "ON" state: glowing accent color with pulse animation
- "OFF" state: muted gray
- Icon + text layout
- GSAP scale animation on state change

#### 4. Alerts Panel
- Full-width card at bottom
- Status badge with icon
- Color-coded based on alert type:
  - OK: green background
  - LOW MOISTURE: orange warning
  - HIGH MOISTURE: red danger
  - LOW TEMP: blue warning
  - HIGH TEMP: red danger
- Smooth transition between states

#### 5. Header Controls
- Logo (text-based, Kingred font)
- Theme toggle: sun/moon icons
- Export button: downloads current dashboard as PNG

---

## Functionality Specification

### Core Features

1. **Real-time MQTT Subscription**
   - Connect to Adafruit IO MQTT broker
   - Subscribe to all 5 topics
   - Update UI instantly on new data
   - Reconnect automatically on disconnect

2. **Theme Toggle**
   - Persist preference in localStorage
   - Smooth transition animation (GSAP)
   - Affects all dashboard elements

3. **Export Feature**
   - Capture current dashboard state as PNG
   - Uses html2canvas library
   - Filename: `kilimo-fly-export-{timestamp}.png`

4. **Alert System**
   - Parse space-state feed
   - Display appropriate badge/color
   - Visual emphasis for active alerts

5. **Backend (Python)**
   - MQTT client subscribing to topics
   - WebSocket server pushing updates to frontend
   - Africa's Talking SMS integration for alerts

### User Interactions
- Click theme toggle → switch between light/dark
- Click export → download PNG image
- View real-time updates automatically

### Edge Cases
- MQTT disconnection: show "Connecting..." status
- No data yet: show "--" or "Waiting for data"
- Invalid values: graceful fallback

---

## Acceptance Criteria

1. ✓ Dashboard loads and connects to MQTT
2. ✓ Moisture gauge displays 0-100% with horizontal bar
3. ✓ Temperature gauge displays 20-40°C range
4. ✓ Pump and Heater status indicators update in real-time
5. ✓ Alerts panel shows current space-state
6. ✓ Theme toggle switches between light and dark
7. ✓ Export button downloads PNG of dashboard
8. ✓ All animations use GSAP
9. ✓ No mock/simulated data - real MQTT values
10. ✓ Responsive on mobile/tablet/desktop
11. ✓ Uses Sarabun and Kingred fonts
12. ✓ Docker deployment possible

---

## Technology Stack

- **Frontend:** HTML5, CSS3, Vanilla JavaScript
- **Animations:** GSAP 3.x
- **Icons:** Phosphor Icons (WebFont)
- **Export:** html2canvas
- **Backend:** Python with asyncio, paho-mqtt, websockets
- **SMS:** Africa's Talking API
- **Deployment:** Docker (nginx for frontend, Python for backend)