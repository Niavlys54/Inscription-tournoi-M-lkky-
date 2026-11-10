import base64
import json
import time
import urllib.request
import urllib.error
import urllib.parse
from pathlib import Path

UID = "th9gEGFrlQUJt299LlV6VdGgl643"
BASE = "http://127.0.0.1:9000"
NS = "demo-pagny-security"
def token(user):
    enc = lambda data: base64.urlsafe_b64encode(json.dumps(data).encode()).decode().rstrip("=")
    now = int(time.time())
    return enc({"alg":"none","typ":"JWT"}) + "." + enc({
        "aud":NS,"iss":"https://securetoken.google.com/"+NS,
        "sub":user,"user_id":user,"iat":now,"exp":now+3600,"auth_time":now,
        "firebase":{"identities":{},"sign_in_provider":"password"}
    }) + "."

def call(method, path, data=None, user=None):
    headers = {"Content-Type":"application/json"}
    if user == "owner":
        headers["Authorization"] = "Bearer owner"
    suffix = "&auth=" + urllib.parse.quote(token(user)) if user and user != "owner" else ""
    req = urllib.request.Request(BASE+path+".json?ns="+NS+suffix,
        data=json.dumps(data).encode() if method in ("PUT","PATCH") else None,
        headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=25) as r:
            return r.status, r.read()
    except urllib.error.HTTPError as e:
        return e.code, e.read()

def expect(method, path, data=None, user=None, allowed=False):
    status, _ = call(method,path,data,user)
    assert (status == 200) == allowed, f"{method} {path}: HTTP {status}"

status, body = call("PUT","/.settings/rules",json.loads(Path(__file__).with_name("database.rules.json").read_text()),"owner")
assert status == 200, body
print("Rules compiled by Firebase emulator", flush=True)
status, _ = call("PUT","/",{
    "members":[{"id":"1","name":"Test"}],
    "tournaments":{
        "open":{"name":"Test","date":"2026-11-20"},
        "archived":{"name":"Archive","date":"2026-01-01","results":{"phase":"Finaliste"}},
        "weekend":{"name":"Weekend","date":"2026-11-20","days":{"day1":{"results":{"phase":"Finaliste"}},"day2":{"date":"2026-11-21"}}},
        "done":{"name":"Termine","date":"2026-01-01","days":{"day1":{"results":{"phase":"Finaliste"}},"day2":{"results":{"phase":"Vainqueur"}}}}
    },
    "privateTest":{"value":"Private"}
},"owner")
assert status == 200
expect("GET","/members",allowed=True)
expect("GET","/tournaments",allowed=True)
expect("GET","/")
expect("GET","/privateTest")
for value in ["registered","available","absent","none"]:
    expect("PUT","/tournaments/open/statuses/1",value,allowed=True)
for value in [None,"bad",True,123,{"phase":"Vainqueur"}]:
    expect("PUT","/tournaments/open/statuses/1",value)
for path in ["/members","/members/0/name","/tournaments","/tournaments/open","/tournaments/open/name","/tournaments/open/results","/tournaments/open/teams","/tournaments/open/days","/tournaments/open/statuses","/privateTest"]:
    expect("PUT",path,"bad")
    expect("DELETE",path)
    expect("PUT",path,"bad",user="other-user")
expect("PATCH","/tournaments/open",{"name":"Hacked","statuses":{"1":"registered"}})
expect("PATCH","/",{"tournaments/open/name":"Hacked","tournaments/open/statuses/1":"registered"})
expect("PUT","/tournaments/missing/statuses/1","registered")
expect("PUT","/tournaments/open/statuses/invalid","registered")
expect("PUT","/tournaments/archived/statuses/1","registered")
expect("PUT","/tournaments/done/statuses/1","registered")
expect("PUT","/tournaments/weekend/statuses/1","registered",allowed=True)
expect("PUT","/tournaments/open/name","Updated",user=UID,allowed=True)
expect("PUT","/tournaments/open/results",{"phase":"Finaliste","podium":{"first":"Test"}},user=UID,allowed=True)
expect("PUT","/members",[{"id":"1","name":"Updated"}],user=UID,allowed=True)
expect("DELETE","/tournaments/open",user=UID,allowed=True)
print("OK emulator: public reads and statuses allowed; invalid values, deletion, parent writes, archives, unrelated user writes denied; designated admin writes allowed.", flush=True)
