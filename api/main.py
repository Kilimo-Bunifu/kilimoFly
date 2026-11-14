import asyncio
import json
import logging
import os
from datetime import datetime
from typing import Dict, Set

import websockets
from paho.mqtt import client as mqtt_client
import africastalking

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

AIO_USERNAME = 'ironman_arcreactor'
AIO_KEY = 'aio_hbXi45gFx1q4kuIGBOQUhMdn4k6k'
MQTT_SERVER = 'io.adafruit.com'
MQTT_PORT = 1883
MQTT_CLIENT_ID = f'kilimofly_{id(object())}'

AFRICASTALKING_API_KEY = os.environ.get('AFRICASTALKING_API_KEY', '')
AFRICASTALKING_USERNAME = os.environ.get('AFRICASTALKING_USERNAME', '')
AFRICASTALKING_PHONE = os.environ.get('AFRICASTALKING_PHONE', '')

if AFRICASTALKING_API_KEY and AFRICASTALKING_USERNAME:
    try:
        africastalking.initialize(AFRICASTALKING_USERNAME, AFRICASTALKING_API_KEY)
        logger.info('Africa Talking initialized')
    except Exception as e:
        logger.warning(f'Failed to initialize Africa Talking: {e}')

MQTT_TOPICS = {
    f'{AIO_USERNAME}/feeds/kilimofly-moisture': 'moisture',
    f'{AIO_USERNAME}/feeds/home-temperature': 'temperature',
    f'{AIO_USERNAME}/feeds/space-state': 'alerts',
    f'{AIO_USERNAME}/feeds/kilimofly-pump': 'pump',
    f'{AIO_USERNAME}/feeds/kilimofly-heater': 'heater',
}

MOISTURE_MIN = 60.0
MOISTURE_MAX = 70.0
TEMP_MIN = 27.0
TEMP_MAX = 33.0

current_values: Dict[str, str] = {
    'moisture': '--',
    'temperature': '--',
    'alerts': 'OK',
    'pump': 'OFF',
    'heater': 'OFF',
}

last_alert_sent: str = ''
websocket_connections: Set[websockets.WebSocketServerProtocol] = set()
mqtt_client_instance = None


def get_mqtt_client() -> mqtt_client.Client:
    client = mqtt_client.Client(MQTT_CLIENT_ID)
    client.username_pw_set(AIO_USERNAME, AIO_KEY)
    client.on_connect = on_mqtt_connect
    client.on_message = on_mqtt_message
    return client


def on_mqtt_connect(client, userdata, flags, rc):
    if rc == 0:
        logger.info('Connected to MQTT broker')
        for topic in MQTT_TOPICS.keys():
            client.subscribe(topic)
            logger.info(f'Subscribed to {topic}')
    else:
        logger.error(f'MQTT connection failed with code {rc}')


def on_mqtt_message(client, userdata, msg):
    try:
        topic = msg.topic
        value = msg.payload.decode('utf-8').strip()
        
        if topic in MQTT_TOPICS:
            feed_name = MQTT_TOPICS[topic]
            current_values[feed_name] = value
            
            message = json.dumps({
                'topic': feed_name,
                'value': value,
                'timestamp': datetime.now().isoformat()
            })
            
            broadcast_to_websockets(message)
            
            if feed_name == 'alerts':
                handle_alert_change(value)
                
    except Exception as e:
        logger.error(f'Error processing MQTT message: {e}')


def handle_alert_change(new_alert: str):
    global last_alert_sent
    
    if new_alert != last_alert_sent and new_alert != 'OK':
        send_sms_alert(new_alert)
        last_alert_sent = new_alert
    elif new_alert == 'OK':
        last_alert_sent = ''


def send_sms_alert(alert_message: str):
    if not AFRICASTALKING_API_KEY or not AFRICASTALKING_USERNAME:
        logger.warning('Africa Talking not configured - SMS alerts disabled')
        return
    
    try:
        sms = africastalking.SMS
        
        message = f'Kilimo Fly Alert: {alert_message}'
        
        result = sms.send(message, [AFRICASTALKING_PHONE])
        
        if result.get('SMSMessageData', {}).get('Recipients'):
            logger.info(f'SMS alert sent: {alert_message}')
        else:
            logger.error(f'SMS send failed: {result}')
            
    except Exception as e:
        logger.error(f'Error sending SMS: {e}')


async def websocket_handler(websocket: websockets.WebSocketServerProtocol, path: str):
    logger.info(f'WebSocket client connected from {websocket.remote_address}')
    websocket_connections.add(websocket)
    
    try:
        await websocket.send(json.dumps({
            'type': 'init',
            'data': current_values
        }))
        
        await websocket.wait_closed()
        
    except websockets.exceptions.ConnectionClosed:
        pass
    finally:
        websocket_connections.discard(websocket)
        logger.info('WebSocket client disconnected')


def broadcast_to_websockets(message: str):
    for ws in list(websocket_connections):
        try:
            asyncio.get_event_loop().run_until_complete(ws.send(message))
        except Exception as e:
            logger.error(f'Error broadcasting to WebSocket: {e}')


async def start_websocket_server():
    logger.info('Starting WebSocket server on port 8765')
    async with websockets.serve(websocket_handler, '0.0.0.0', 8765):
        await asyncio.Future()


def main():
    global mqtt_client_instance
    mqtt_client_instance = get_mqtt_client()
    
    try:
        logger.info('Connecting to MQTT broker...')
        mqtt_client_instance.connect(MQTT_SERVER, MQTT_PORT, 60)
        mqtt_client_instance.loop_start()
        
        logger.info('Starting WebSocket server...')
        asyncio.run(start_websocket_server())
        
    except KeyboardInterrupt:
        logger.info('Shutting down...')
        mqtt_client_instance.loop_stop()
        mqtt_client_instance.disconnect()
    except Exception as e:
        logger.error(f'Error: {e}')


if __name__ == '__main__':
    main()