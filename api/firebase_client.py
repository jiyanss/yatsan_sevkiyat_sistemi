import json, os

db = None
cred_json = os.environ.get("FIREBASE_CREDENTIALS", "")
if cred_json:
    import firebase_admin
    from firebase_admin import credentials, firestore
    if not firebase_admin._apps:
        firebase_admin.initialize_app(credentials.Certificate(json.loads(cred_json)))
    db = firestore.client()
