import asyncio
import base64
import datetime
import inspect
import json
import pathlib
import random
import time
import traceback
import uuid

from fastapi import FastAPI, WebSocket
import uvicorn
from starlette.responses import FileResponse
from starlette.staticfiles import StaticFiles
from starlette.websockets import WebSocketDisconnect

import run

app = FastAPI()

DATA_PTH = pathlib.Path(__file__).resolve().parent / 'data.json'
DATA_PTH.touch()

with DATA_PTH.open() as fl:
    try:
        data = json.load(fl)
    except json.JSONDecodeError:
        data = {'users': {}}

data_users = data['users']


class ResponseError(Exception):
    def __init__(self, desc):
        super().__init__(desc)

    def json(self):
        return {'desc': self.args[0]}


class IncompleteRequestError(ResponseError):
    def __init__(self, r_type, params_missed):
        self.missed = params_missed
        super().__init__(f'Error processing {r_type!r}, missing {', '.join(params_missed)}')


class InvalidFormatError(ResponseError):
    def __init__(self, *args):
        super().__init__(*args)


class IncompleteParamsError(Exception):
    def __init__(self, *params_missed):
        super().__init__(f'missing keyword params {', '.join(params_missed)}')


def require_keywords(fnc):
    sig = inspect.signature(fnc)

    required = {
        param.name for param in sig.parameters.values()
        if param.default == inspect.Parameter.empty
        and param.kind != inspect.Parameter.VAR_KEYWORD
        and param.name != 'self'  # Игнорируем self в списке обязательных аргументов
    }

    setattr(fnc, '__required_keywords__', required)

    # Добавляем *args, чтобы принимать self!
    def wrapper(*args, **kwargs):
        missing = required - kwargs.keys()
        if missing:
            raise IncompleteParamsError(missing)
        return fnc(*args, **kwargs)

    return wrapper


class Resolver:
    def __init__(self, name):
        self.name = name
        self.data = {}

    def resolve(self, request):
        req_id = None
        try:
            if 'action' not in request:
                raise InvalidFormatError('No action')
            request_type = request['action']
            if 'rid' not in request:
                return None
            req_id = request['rid']
            fnc = getattr(self, f'do_{request_type}', None)
            if fnc is None:
                raise InvalidFormatError('No such method')
            try:
                result = {'payload': fnc(**request['payload']), 'rid': req_id, 'status': 'ok'}
                return result
            except IncompleteParamsError as _ex:
                raise IncompleteRequestError(request_type, _ex.missed)
            except ResponseError as _ex:
                raise _ex
            except Exception as _ex:
                _ex.add_note(f'Rq info: rid: {req_id}, {request_type}, Invoked with {', '.join(f'{k} ({type(v).__name__}): {v}' for k, v in request['payload'].items())}\nRequest: {request}')
                traceback.print_exception(_ex)
                raise ResponseError('Internal server error')
        except ResponseError as _ex:
            if req_id is not None:
                return {'status': 'error', 'payload': _ex.json(), 'rid': req_id}

    def do_un_auth(self):
        self.data.pop('auth', None)
        return {}

    @require_keywords
    def do_auth(self, *, username, password=None, token=None):
        user = None

        if username not in data_users:
            raise ResponseError('Firstly register')

        if token:
            if username in data_users:
                if data_users[username].get('token') == token:
                    user = data_users[username]
            if not user:
                print(f'invalid token for {username} {token}')
                raise ResponseError('Invalid token')

        elif username:
            if username in data_users:
                if data_users[username]['password'] != password:
                    raise ResponseError('Invalid password')
                user = data_users[username]
                if 'token' not in user:
                    user['token'] = uuid.uuid4().hex
        else:
            raise ResponseError(f'{username} {password} {token} Incomplete')

        self.data['auth'] = user

        return {
            'username': user['username'],
            'token': user['token']
        }

    @require_keywords
    def do_register(self, *, username, password, weight):
        if username in data_users:
            raise ResponseError('Invalid data')

        token_new = uuid.uuid4().hex
        user = {
            'username': username,
            'password': password,
            'schedule': {},
            'settings': {
                'weight': weight
            },
            'token': token_new
        }
        data_users[username] = user
        return {'status': 'ok'}

    def do_get_schedule(self):
        username = self.data['auth']['username']

        s = data_users[username]['schedule']
        if s is None:
            plan = None
        else:
            plan = s.get('plan', None)
        if plan is not None:
            return plan
        else:
            raise ResponseError('Need to create')

    @require_keywords
    def do_new_schedule(self, now, final, interval, start_date=None):
        if start_date is not None:
            start_date = datetime.datetime.fromtimestamp(start_date)
        username = self.data['auth']['username']
        schedule = run.generate_schedule(now, final, interval, start_date=start_date)
        data_users[username]['schedule'] = {'plan': schedule, 'from': now, 'to': final}
        return schedule

    def do_get_settings(self):
        username = self.data['auth']['username']
        return data_users[username]['settings']

    def do_update_settings(self, **kw):
        username = self.data['auth']['username']
        data_users[username]['settings'].update(kw)

    @require_keywords
    def do_complete_workout(self, *, idx, result, pulse=0):
        username = self.data['auth']['username']
        data_users[username]['schedule']['plan'][idx]['status'] = 'completed'
        data_users[username]['schedule']['plan'][idx]['result'] = result
        data_users[username]['schedule']['plan'][idx]['result_pulse'] = pulse

    @require_keywords
    def do_upload_schedule(self, *, plan):
        username = self.data['auth']['username']
        data_users[username]['schedule']['plan'] = plan

    @require_keywords
    def do_encrypt(self, *, string):
        return {'string': base64.b64encode(string.encode('utf-8')).decode('utf-8')}

    @require_keywords
    def do_decrypt(self, *, string):
        return {'string': base64.b64decode(string.encode('utf-8')).decode('utf-8')}

    @require_keywords
    def do_update_schedule(self, idx, new_date_str=None, new_target=None):
        if new_date_str is None and new_target is None:
            return {}
        c = time.time() - (24 * 60 * 60)
        if new_date_str < c:
            raise ResponseError(f'Invalid timestamp ({new_date_str} < {c})')
        username = self.data['auth']['username']
        sc = data_users[username]['schedule']
        plan = data_users[username]['schedule']['plan']
        date = datetime.date.fromtimestamp(new_date_str).strftime('%Y.%m.%d')
        new = run.recalculate_schedule(
            curr_schedule=plan,
            target_final=sc['to'],
            changed_index=idx,
            new_date_str=date,
            new_target=new_target
        )
        data_users[username]['schedule']['plan'] = new
        return {}

    def do_delete_schedule(self):
        username = self.data['auth']['username']
        data_users[username]['schedule'] = None

    def do_ping(self):
        return {'type': 'pong'}


class WebsocketsManager:
    def __init__(self):
        self._tasks = []
        self._work = True

    def register(self, websock):
        t = asyncio.create_task(self._receive_task(websock))
        self._tasks.append(
            t
        )
        return t

    async def _receive_task(self, websocket: WebSocket):
        resolver = Resolver(f'Resolver {websocket}')

        while self._work:
            payload = await websocket.receive_json()
            try:
                resp = resolver.resolve(payload)
            except ResponseError as _ex:
                resp = {'status': 'error', 'payload': _ex.json()}
            if resp:
                resp_s = f'{resp}'
                if len(resp_s) > 200:
                    resp_s = resp_s[:200] + '...'
                print(f'{payload} -> {resp_s}')
                await websocket.send_json(resp)

    async def stop(self):
        self._work = False
        await asyncio.gather(*self._tasks)


ws_manager = WebsocketsManager()


@app.websocket('/ws')
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    task = ws_manager.register(websocket)
    try:
        await task
    except WebSocketDisconnect:
        return
    except Exception as e:
        e.add_note(f'Processing {websocket}')
        traceback.print_exception(e)


@app.get('/')
async def index():
    return FileResponse('./index.html')


app.mount("/static", StaticFiles(directory="static"), name="static")

try:
    uvicorn.run(app)
finally:
    with DATA_PTH.open('w') as fl:
        json.dump(data, fl, indent=4)