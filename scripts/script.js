const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const wsHost = (window.location.protocol === 'file:' || !window.location.host)
    ? 'localhost:8765'
    : window.location.host;
const WS_URL = `${wsProtocol}//${wsHost}/ws`;
let ws = null;
        let reconnectAttempts = 0;
        const maxReconnectAttempts = 20;

        // Current needle angles (Moisture starts at -130 deg = 0%, Temp starts at -90 deg = 20°C)
        let currentMoistureAngle = -130;
        let currentTempAngle = -90;

        const elements = {
            moistureValue: document.getElementById('moistureValue'),
            moisturePointer: document.getElementById('moisturePointer'),
            moistureZonePill: document.getElementById('moistureZonePill'),

            temperatureValue: document.getElementById('temperatureValue'),
            temperaturePointer: document.getElementById('temperaturePointer'),
            tempZonePill: document.getElementById('tempZonePill'),

            pumpCard: document.getElementById('pumpCard'),
            pumpBadge: document.getElementById('pumpBadge'),
            heaterCard: document.getElementById('heaterCard'),
            heaterBadge: document.getElementById('heaterBadge'),

            alertBadge: document.getElementById('alertBadge'),
            alertText: document.getElementById('alertText'),
            alertsIcon: document.getElementById('alertsIcon'),

            connectionDot: document.getElementById('connectionDot'),
            connectionText: document.getElementById('connectionText'),

            themeToggle: document.getElementById('themeToggle'),
            themeIcon: document.getElementById('themeIcon'),
            exportBtn: document.getElementById('exportBtn'),
            loadingOverlay: document.getElementById('loadingOverlay'),
            dashboard: document.getElementById('dashboard')
        };

        // Theme management
        function initTheme() {
            const savedTheme = localStorage.getItem('kilimofly-theme') || 'light';
            document.documentElement.setAttribute('data-theme', savedTheme);
            updateThemeIcon(savedTheme);
        }

        function updateThemeIcon(theme) {
            elements.themeIcon.className = theme === 'dark' ? 'ph-bold ph-moon' : 'ph-bold ph-sun';
        }

        elements.themeToggle.addEventListener('click', () => {
            const currentTheme = document.documentElement.getAttribute('data-theme');
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', newTheme);
            localStorage.setItem('kilimofly-theme', newTheme);
            updateThemeIcon(newTheme);
        });

        // Export Viewport as PNG
        elements.exportBtn.addEventListener('click', async () => {
            const originalHtml = elements.exportBtn.innerHTML;
            elements.exportBtn.innerHTML = '<i class="ph-bold ph-spinner ph-spin"></i><span>Exporting...</span>';
            elements.exportBtn.disabled = true;

            try {
                const canvas = await html2canvas(elements.dashboard, {
                    backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--bg-page').trim(),
                    scale: 2,
                    useCORS: true,
                    logging: false
                });

                const link = document.createElement('a');
                const ts = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '').replace('T', '_');
                link.download = `KilimoFly-Telemetry-${ts}.png`;
                link.href = canvas.toDataURL('image/png');
                link.click();
            } catch (err) {
                console.error('Export error:', err);
            } finally {
                elements.exportBtn.innerHTML = originalHtml;
                elements.exportBtn.disabled = false;
            }
        });

        // Moisture update
        function updateMoisture(value) {
            const val = parseFloat(value);
            if (isNaN(val)) return;
            const clamped = Math.max(0, Math.min(100, val));

            elements.moistureValue.textContent = clamped.toFixed(1);
            const targetAngle = -130 + (clamped / 100) * 260;

            const animObj = { angle: currentMoistureAngle };
            gsap.to(animObj, {
                angle: targetAngle,
                duration: 0.9,
                ease: 'power2.out',
                onUpdate: () => {
                    elements.moisturePointer.setAttribute('transform', `rotate(${animObj.angle})`);
                },
                onComplete: () => {
                    currentMoistureAngle = targetAngle;
                }
            });

            if (clamped < 60) {
                elements.moistureZonePill.className = 'status-pill warn';
                elements.moistureZonePill.textContent = 'Low Moisture';
            } else if (clamped <= 70) {
                elements.moistureZonePill.className = 'status-pill optimal';
                elements.moistureZonePill.textContent = 'Optimal Range';
            } else {
                elements.moistureZonePill.className = 'status-pill alert';
                elements.moistureZonePill.textContent = 'High Moisture';
            }
        }

        // Temperature update
        function updateTemperature(value) {
            const val = parseFloat(value);
            if (isNaN(val)) return;
            const clamped = Math.max(20, Math.min(40, val));

            elements.temperatureValue.textContent = clamped.toFixed(1);
            const targetAngle = -90 + ((clamped - 20) / 20) * 180;

            const animObj = { angle: currentTempAngle };
            gsap.to(animObj, {
                angle: targetAngle,
                duration: 0.9,
                ease: 'power2.out',
                onUpdate: () => {
                    elements.temperaturePointer.setAttribute('transform', `rotate(${animObj.angle})`);
                },
                onComplete: () => {
                    currentTempAngle = targetAngle;
                }
            });

            if (clamped < 27) {
                elements.tempZonePill.className = 'status-pill cold';
                elements.tempZonePill.textContent = 'Cool';
            } else if (clamped <= 33) {
                elements.tempZonePill.className = 'status-pill optimal';
                elements.tempZonePill.textContent = 'Optimal Range';
            } else {
                elements.tempZonePill.className = 'status-pill alert';
                elements.tempZonePill.textContent = 'High Heat';
            }
        }

        // Pump update
        function updatePumpStatus(status) {
            const isOn = String(status).trim().toUpperCase() === 'ON';
            if (isOn) {
                elements.pumpCard.classList.add('active');
                elements.pumpBadge.className = 'switch-pill on';
                elements.pumpBadge.querySelector('.badge-text').textContent = 'Running';
            } else {
                elements.pumpCard.classList.remove('active');
                elements.pumpBadge.className = 'switch-pill';
                elements.pumpBadge.querySelector('.badge-text').textContent = 'Off';
            }
        }

        // Heater update
        function updateHeaterStatus(status) {
            const isOn = String(status).trim().toUpperCase() === 'ON';
            if (isOn) {
                elements.heaterCard.classList.add('active');
                elements.heaterBadge.className = 'switch-pill on';
                elements.heaterBadge.querySelector('.badge-text').textContent = 'Active';
            } else {
                elements.heaterCard.classList.remove('active');
                elements.heaterBadge.className = 'switch-pill';
                elements.heaterBadge.querySelector('.badge-text').textContent = 'Off';
            }
        }

        // Alerts update
        function updateAlerts(status) {
            const s = (status || '').trim().toUpperCase();
            let pillClass = '';
            let message = 'All systems normal';

            if (s === 'OK' || !s) {
                pillClass = '';
                message = 'All systems normal';
            } else if (s.includes('LOW MOISTURE')) {
                pillClass = 'warn';
                message = 'Notice: Soil moisture is low';
            } else if (s.includes('HIGH MOISTURE')) {
                pillClass = 'alert';
                message = 'Alert: Soil moisture is high';
            } else if (s.includes('LOW TEMP')) {
                pillClass = 'warn';
                message = 'Notice: Temperature is below target';
            } else if (s.includes('HIGH TEMP')) {
                pillClass = 'alert';
                message = 'Alert: Temperature is above target';
            }

            elements.alertBadge.className = `system-badge ${pillClass}`.trim();
            elements.alertText.textContent = message;
        }

        // Connection
        function setConnectionStatus(connected) {
            if (connected) {
                elements.connectionDot.classList.add('connected');
                elements.connectionText.textContent = 'Connected';
                reconnectAttempts = 0;
            } else {
                elements.connectionDot.classList.remove('connected');
                elements.connectionText.textContent = 'Disconnected';
            }
        }

        function connectWebSocket() {
            try {
                ws = new WebSocket(WS_URL);

                ws.onopen = () => {
                    setConnectionStatus(true);
                };

                ws.onclose = () => {
                    setConnectionStatus(false);
                    if (reconnectAttempts < maxReconnectAttempts) {
                        reconnectAttempts++;
                        const delay = Math.min(1000 * Math.pow(1.5, reconnectAttempts), 20000);
                        setTimeout(connectWebSocket, delay);
                    }
                };

                ws.onerror = () => {
                    setConnectionStatus(false);
                };

                ws.onmessage = (event) => {
                    try {
                        const payload = JSON.parse(event.data);
                        handleIncomingData(payload);
                    } catch (e) {
                        console.error('Payload parse error:', e);
                    }
                };
            } catch (err) {
                setConnectionStatus(false);
            }
        }

        function handleIncomingData(data) {
            switch (data.topic) {
                case 'moisture':
                    updateMoisture(data.value);
                    break;
                case 'temperature':
                    updateTemperature(data.value);
                    break;
                case 'pump':
                    updatePumpStatus(data.value);
                    break;
                case 'heater':
                    updateHeaterStatus(data.value);
                    break;
                case 'alerts':
                    updateAlerts(data.value);
                    break;
            }
        }

        document.addEventListener('DOMContentLoaded', () => {
            initTheme();
            setTimeout(() => {
                elements.loadingOverlay.classList.add('hidden');
            }, 300);
            connectWebSocket();
        });