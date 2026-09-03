import urllib.request, urllib.error, json

BASE = 'http://localhost:8000'

def post(url, data, h={}):
    req = urllib.request.Request(url, json.dumps(data).encode(), {**h, 'Content-Type': 'application/json'}, method='POST')
    try: return json.loads(urllib.request.urlopen(req).read()), None
    except urllib.error.HTTPError as e: return None, json.loads(e.read())

def get(url, h={}):
    try: return json.loads(urllib.request.urlopen(urllib.request.Request(url, headers=h)).read()), None
    except urllib.error.HTTPError as e: return None, json.loads(e.read())

def patch(url, data, h={}):
    req = urllib.request.Request(url, json.dumps(data).encode(), {**h, 'Content-Type': 'application/json'}, method='PATCH')
    try: return json.loads(urllib.request.urlopen(req).read()), None
    except urllib.error.HTTPError as e: return None, json.loads(e.read())

OK = "[OK]"; FAIL = "[FAIL]"

# Health
r, _ = get(f'{BASE}/')
print(f"{OK if r else FAIL} Health: {r.get('status') if r else _}")

# Teacher register+login
post(f'{BASE}/auth/register', {'name':'AuditTeacher','email':'t@audit.com','password':'pass123','role':'teacher'})
r, _ = post(f'{BASE}/auth/login', {'email':'t@audit.com','password':'pass123'})
th = {'Authorization': f'Bearer {r["access_token"]}'}
print(f"{OK} Teacher login: role={r['user']['role']}")

# Create class
r, _ = post(f'{BASE}/classes/create', {'name':'AuditClass'}, th)
if _: r, _ = get(f'{BASE}/classes/my-classes', th); r = r[0]
class_id = r.get('id'); class_code = r.get('code')
print(f"{OK} Class: id={class_id}, code={class_code}")

# Create quiz
qdata = {'title':'AuditQuiz','class_id':class_id,'type':'MCQ','difficulty':'Medium','bloom_level':'Understanding',
         'total_marks':10,'duration':30,'negative_marks':0,
         'questions':[{'id':'q1','type':'mcq','text':'2+2?','options':['3','4','5'],'correctAnswer':'4','maxMarks':10}]}
r, err = post(f'{BASE}/quizzes/create-quiz', qdata, th)
quiz_id = r['quiz_id'] if r else None
print(f"{OK if r else FAIL} Create quiz: {f'id={quiz_id}' if r else err}")

# Student register+login
post(f'{BASE}/auth/register', {'name':'AuditStudent','email':'s@audit.com','password':'pass123','role':'student'})
r2, _ = post(f'{BASE}/auth/login', {'email':'s@audit.com','password':'pass123'})
sh = {'Authorization': f'Bearer {r2["access_token"]}'}
print(f"{OK} Student login")

# Join class
r, err = post(f'{BASE}/classes/join', {'code': class_code}, sh)
print(f"{OK if r else FAIL} Join class: {r.get('message') if r else err.get('detail')}")

# Student sees quiz
r, _ = get(f'{BASE}/quizzes/get-quizzes', sh)
print(f"{OK if r else FAIL} Student get-quizzes: {len(r) if r else _} visible")

# Submit answers (BUG 1 FIX: quiz_id in URL path)
r, err = post(f'{BASE}/quizzes/submit-answers/{quiz_id}', {'answers':{'q1':'4'}}, sh)
score_info = f'score={r["mcq_score"]}, pct={r["percentage"]}%' if r else str(err)
print(f"{OK if r else FAIL} Submit quiz: {score_info}")

# Teacher sees submissions (BUG 3 FIX: new endpoint)
r, err = get(f'{BASE}/submissions/get-submissions', th)
print(f"{OK if r else FAIL} GET /submissions/get-submissions (teacher): {len(r) if r else err} entries")
if r: s=r[0]; print(f"   -> email={s['studentEmail']}, title={s['assessmentTitle']}, pct={s['percentage']}%")

# Student sees own submissions
r, err = get(f'{BASE}/submissions/get-submissions', sh)
print(f"{OK if r else FAIL} GET /submissions/get-submissions (student): {len(r) if r else err} entries")

# Grade submission (BUG 2 FIX: correct URL order /{id}/grade)
sub_id = r[0]['id'] if r else None
if sub_id:
    r2, err2 = patch(f'{BASE}/submissions/{sub_id}/grade', {'manual_score':0,'feedback':'Good'}, th)
    print(f"{OK if r2 else FAIL} PATCH /submissions/{sub_id}/grade: {r2.get('message') if r2 else err2}")

# Admin stats
post(f'{BASE}/auth/register', {'name':'AuditAdmin','email':'a@audit.com','password':'pass123','role':'admin'})
r, _ = post(f'{BASE}/auth/login', {'email':'a@audit.com','password':'pass123'})
ah = {'Authorization': f'Bearer {r["access_token"]}'}
r, _ = get(f'{BASE}/admin/stats', ah)
print(f"{OK if r else FAIL} Admin stats: teachers={r['total_teachers']}, students={r['total_students']}, assessments={r['total_assessments']}")

r, _ = get(f'{BASE}/admin/users', ah)
print(f"{OK if r else FAIL} Admin users: {len(r)} users")

# Parent
post(f'{BASE}/auth/register', {'name':'AuditParent','email':'p@audit.com','password':'pass123','role':'parent','children_emails':['s@audit.com']})
r, _ = post(f'{BASE}/auth/login', {'email':'p@audit.com','password':'pass123'})
ph = {'Authorization': f'Bearer {r["access_token"]}'}
r, _ = get(f'{BASE}/parent/children', ph)
print(f"{OK if r else FAIL} Parent children: {len(r)} children, avg={r[0]['avg_score'] if r else 'n/a'}")

print("\n=== AUDIT COMPLETE ===")
