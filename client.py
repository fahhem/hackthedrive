import requests
from swaggerpy.client import SwaggerClient
from swaggerpy.http_client import SynchronousHttpClient

http_client = SynchronousHttpClient()
# http_client.set_basic_auth('localhost', 'hey', 'peekaboo')


def vehicle_client():
    return SwaggerClient(
        "http://api.hackthedrive.com/vehicles/",
        http_client=http_client)


def data_client():
    return SwaggerClient(
        "http://data.api.hackthedrive.com/v1/Schema",
        http_client=http_client)


class CustomClient(object):
    method_names = {'get', 'post', 'put', 'head', 'options'}
    methods = {}
    for name in method_names:
        def _wrapper(method):
            def _method_caller(self, *a, **kw):
                return self.request(method, *a, **kw)
            return _method_caller
        methods[name] = _wrapper(name.upper())

    def __init__(self, uri, client=None):
        self.uri = uri
        self.client = client or SynchronousHttpClient()

    def request(self, method, params=None, json=None):
        # Assumes json.
        req = requests.Request(
            method=method, url=self.uri, params=params, json=json)
        self.client.apply_authentication(req)
        return self.client.session.send(
            self.client.session.prepare_request(req)).json()

    def set_api_key(self, *a, **kw):
        self.client.set_api_key(*a, **kw)

    def set_basic_auth(self, *a, **kw):
        self.client.set_basic_auth(*a, **kw)

    def __getattr__(self, attr):
        cls = type(self)
        if attr in cls.method_names:
            return lambda *a, **kw: cls.methods[attr](self, *a, **kw)
        return cls('/'.join([self.uri, attr]), self.client)
