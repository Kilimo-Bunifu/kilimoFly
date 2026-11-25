import asyncio
import json
import logging
import os
from datetime import datetime
from pathlib import Path
from typing import Dict, Set

from aiohttp import web
from paho.mqtt import client as mqtt_client
import africastalking

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

PORT = int(os.environ.get('PORT', 8765))
BASE_DIR = Path(__file__).resolve().parent.parent

AIO_USERNAME = os.environ.get('AIO_USERNAME', 'ironman_arcreactor')
AIO_KEY = os.environ.get('AIO_KEY', 'aio_hbXi45gFx1q4kuIGBOQUhMdn4k6k')
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
websocket_connections: Set[web.WebSocketResponse] = set()
mqtt_client_instance = None
main_loop: asyncio.AbstractEventLoop = None


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


async def _safe_send(ws: web.WebSocketResponse, message: str):
    try:
        if not ws.closed:
            await ws.send_str(message)
    except Exception as e:
        logger.error(f'Error broadcasting to WebSocket client: {e}')


def broadcast_to_websockets(message: str):
    global main_loop
    if main_loop and not main_loop.is_closed():
        for ws in list(websocket_connections):
            asyncio.run_coroutine_threadsafe(_safe_send(ws, message), main_loop)


async def health_handler(request: web.Request) -> web.Response:
    return web.Response(text='OK', content_type='text/plain')


async def index_handler(request: web.Request) -> web.Response:
    index_path = BASE_DIR / 'index.html'
    if not index_path.exists():
        index_path = Path.cwd() / 'index.html'
    if index_path.exists():
        return web.FileResponse(index_path)
    return web.Response(text='KilimoFly Dashboard backend is running.', content_type='text/plain')


async def websocket_handler(request: web.Request) -> web.WebSocketResponse:
    ws = web.WebSocketResponse()
    await ws.prepare(request)

    websocket_connections.add(ws)
    logger.info(f'WebSocket client connected from {request.remote}')

    try:
        await ws.send_str(json.dumps({
            'type': 'init',
            'data': current_values
        }))

        async for _ in ws:
            pass
    except Exception as e:
        logger.debug(f'WebSocket client error: {e}')
    finally:
        websocket_connections.discard(ws)
        logger.info('WebSocket client disconnected')

    return ws


async def on_startup(app: web.Application):
    global main_loop, mqtt_client_instance
    main_loop = asyncio.get_running_loop()

    mqtt_client_instance = get_mqtt_client()
    try:
        logger.info('Connecting to MQTT broker...')
        mqtt_client_instance.connect(MQTT_SERVER, MQTT_PORT, 60)
        mqtt_client_instance.loop_start()
    except Exception as e:
        logger.error(f'Failed to connect to MQTT broker: {e}')


async def on_cleanup(app: web.Application):
    global mqtt_client_instance
    if mqtt_client_instance:
        logger.info('Disconnecting from MQTT broker...')
        try:
            mqtt_client_instance.loop_stop()
            mqtt_client_instance.disconnect()
        except Exception as e:
            logger.error(f'Error disconnecting MQTT client: {e}')

    for ws in list(websocket_connections):
        try:
            await ws.close()
        except Exception:
            pass


def create_app() -> web.Application:
    app = web.Application()
    app.router.add_get('/', index_handler)
    app.router.add_get('/index.html', index_handler)
    app.router.add_get('/health', health_handler)
    app.router.add_get('/ws', websocket_handler)

    scripts_dir = BASE_DIR / 'scripts'
    if scripts_dir.exists():
        app.router.add_static('/scripts', scripts_dir)

    style_dir = BASE_DIR / 'style'
    if style_dir.exists():
        app.router.add_static('/style', style_dir)

    assets_dir = BASE_DIR / 'assets'
    if assets_dir.exists():
        app.router.add_static('/assets', assets_dir)

    css_dir = BASE_DIR / 'css'
    if css_dir.exists():
        app.router.add_static('/css', css_dir)
    elif style_dir.exists():
        app.router.add_static('/css', style_dir)

    app.on_startup.append(on_startup)
    app.on_cleanup.append(on_cleanup)
    return app


def main():
    app = create_app()
    logger.info(f'Starting KilimoFly server on 0.0.0.0:{PORT}')
    web.run_app(app, host='0.0.0.0', port=PORT)


if __name__ == '__main__':
    main()
