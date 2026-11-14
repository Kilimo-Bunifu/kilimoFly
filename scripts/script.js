const WS_URL = `ws://${window.location.hostname}:8765`;
        let ws = null;
        let reconnectAttempts = 0;
        const maxReconnectAttempts = 20;

        // Current needle angles (Moisture starts at -130 deg = 0%, Temp starts at -90 deg = 20C)
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
            const savedTheme = localStorage.getItem('kilimofly-theme') || 'dark';
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

        // GAUGE 1: Moisture update
        // Scale: 0 to 100%. Angle: -130 deg (0%) to +130 deg (100%)
        function updateMoisture(value) {
            const val = parseFloat(value);
            if (isNaN(val)) return;
            const clamped = Math.max(0, Math.min(100, val));

            elements.moistureValue.textContent = clamped.toFixed(1);
            const targetAngle = -130 + (clamped / 100) * 260;

            // Animate angle directly on SVG element transform
            const animObj = { angle: currentMoistureAngle };
            gsap.to(animObj, {
                angle: targetAngle,
                duration: 0.8,
                ease: 'power2.out',
                onUpdate: () => {
                    elements.moisturePointer.setAttribute('transform', `rotate(${animObj.angle})`);
                },
                onComplete: () => {
                    currentMoistureAngle = targetAngle;
                }
            });

            // Update status chip
            if (clamped < 60) {
                elements.moistureZonePill.className = 'state-chip warn';
                elements.moistureZonePill.textContent = 'DRY (<60%)';
            } else if (clamped <= 70) {
                elements.moistureZonePill.className = 'state-chip optimal';
                elements.moistureZonePill.textContent = 'OPTIMAL';
            } else {
                elements.moistureZonePill.className = 'state-chip alert';
                elements.moistureZonePill.textContent = 'WET (>70%)';
            }
        }

        // GAUGE 2: Temperature update
        // Scale: 20 to 40°C. Angle: -90 deg (20°C) to +90 deg (40°C)
        function updateTemperature(value) {
            const val = parseFloat(value);
            if (isNaN(val)) return;
            const clamped = Math.max(20, Math.min(40, val));

            elements.temperatureValue.textContent = clamped.toFixed(1);
            const targetAngle = -90 + ((clamped - 20) / 20) * 180;

            const animObj = { angle: currentTempAngle };
            gsap.to(animObj, {
                angle: targetAngle,
                duration: 0.8,
                ease: 'power2.out',
                onUpdate: () => {
                    elements.temperaturePointer.setAttribute('transform', `rotate(${animObj.angle})`);
                },
                onComplete: () => {
                    currentTempAngle = targetAngle;
                }
            });

            // Update status chip
            if (clamped < 27) {
                elements.tempZonePill.className = 'state-chip cold';
                elements.tempZonePill.textContent = 'COLD (<27°C)';
            } else if (clamped <= 33) {
                elements.tempZonePill.className = 'state-chip optimal';
                elements.tempZonePill.textContent = 'OPTIMAL';
            } else {
                elements.tempZonePill.className = 'state-chip alert';
                elements.tempZonePill.textContent = 'HOT (>33°C)';
            }
        }

        // Actuator: Water Pump
        function updatePumpStatus(status) {
            const isOn = String(status).trim().toUpperCase() === 'ON';
            if (isOn) {
                elements.pumpCard.classList.add('active');
                elements.pumpBadge.className = 'switch-badge on';
                elements.pumpBadge.querySelector('.state-text').textContent = 'ON';
            } else {
                elements.pumpCard.classList.remove('active');
                elements.pumpBadge.className = 'switch-badge';
                elements.pumpBadge.querySelector('.state-text').textContent = 'OFF';
            }
        }

        // Actuator: Heater
        function updateHeaterStatus(status) {
            const isOn = String(status).trim().toUpperCase() === 'ON';
            if (isOn) {
                elements.heaterCard.classList.add('active');
                elements.heaterBadge.className = 'switch-badge on';
                elements.heaterBadge.querySelector('.state-text').textContent = 'ON';
            } else {
                elements.heaterCard.classList.remove('active');
                elements.heaterBadge.className = 'switch-badge';
                elements.heaterBadge.querySelector('.state-text').textContent = 'OFF';
            }
        }

        // Space State / Alerts
        function updateAlerts(status) {
            const s = (status || '').trim().toUpperCase();
            let badgeClass = '';
            let text = s || 'NORMAL';

            if (s === 'OK') {
                text = 'ALL SYSTEMS NORMAL';
            } else if (s.includes('LOW MOISTURE')) {
                badgeClass = 'warn';
                text = 'ALERT: LOW MOISTURE';
            } else if (s.includes('HIGH MOISTURE')) {
                badgeClass = 'alert';
                text = 'ALERT: HIGH MOISTURE';
            } else if (s.includes('LOW TEMP')) {
                badgeClass = 'warn';
                text = 'ALERT: LOW TEMPERATURE';
            } else if (s.includes('HIGH TEMP')) {
                badgeClass = 'alert';
                text = 'ALERT: HIGH TEMPERATURE';
            }

            elements.alertBadge.className = `status-badge ${badgeClass}`;
            elements.alertText.textContent = text;
        }

        // Connection Handling
        function setConnectionStatus(connected) {
            if (connected) {
                elements.connectionDot.classList.add('connected');
                elements.connectionText.textContent = 'LIVE // CONNECTED';
                reconnectAttempts = 0;
            } else {
                elements.connectionDot.classList.remove('connected');
                elements.connectionText.textContent = 'DISCONNECTED';
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
            // Hide loading overlay without injecting any mock values
            setTimeout(() => {
                elements.loadingOverlay.classList.add('hidden');
            }, 300);
            connectWebSocket();
        });