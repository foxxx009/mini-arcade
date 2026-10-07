"""Push (or update) every site file to GitHub via the Contents API.
git push is blocked in this sandbox (github.com:443 unreachable), the API is not.
Existing files need their current sha, so we fetch it first for each path."""
import os, base64, json, subprocess, tempfile

ROOT = os.path.dirname(os.path.abspath(__file__))
OWNER = 'foxxx009'
REPO = 'mini-arcade'
SKIP = {'.git', 'node_modules'}


def gh(args):
    return subprocess.run(['gh', 'api'] + args, capture_output=True, text=True,
                          encoding='utf-8', errors='replace')


def sha_of(rel):
    r = gh(['repos/%s/%s/contents/%s' % (OWNER, REPO, rel), '--jq', '.sha'])
    s = (r.stdout or '').strip()
    return s if r.returncode == 0 and s and not s.startswith('{') else None


ok = fail = skip = 0
for dirpath, dirs, files in os.walk(ROOT):
    dirs[:] = [d for d in dirs if d not in SKIP]
    for f in sorted(files):
        p = os.path.join(dirpath, f)
        rel = os.path.relpath(p, ROOT).replace(os.sep, '/')
        b64 = base64.b64encode(open(p, 'rb').read()).decode('ascii')

        # body goes through a temp file: Windows caps command-line length (~32KB)
        # and a base64 game bundle easily exceeds it (WinError 206).
        body = {'message': 'Update ' + rel, 'content': b64, 'branch': 'main'}
        sha = sha_of(rel)
        if sha:
            body['sha'] = sha
        fd, tmp = tempfile.mkstemp(suffix='.json')
        with os.fdopen(fd, 'w', encoding='utf-8') as fh:
            json.dump(body, fh)
        r = gh(['-X', 'PUT', 'repos/%s/%s/contents/%s' % (OWNER, REPO, rel), '--input', tmp])
        os.unlink(tmp)
        if r.returncode == 0:
            ok += 1
            print('OK   ' + rel)
        elif 'sha' in (r.stderr or '') and not sha:
            skip += 1
            print('SKIP ' + rel + ' (needs sha refresh)')
        else:
            fail += 1
            print('FAIL ' + rel + ' :: ' + (r.stderr or r.stdout)[:160])

print('--- uploaded %d, skipped %d, failed %d' % (ok, skip, fail))
