# Bella — Security & Deployment Guide

## Your biggest concerns addressed

---

### 1. "Anyone can see my Firebase API key in the source"

**This is normal and safe for Firebase Web apps.**
Firebase API keys are NOT secret — they identify your project, not grant admin access.
Security is enforced by **Firestore Rules** (see below).

What you MUST do to be secure:
- ✅ Apply the `firestore.rules` file in your project
- ✅ In Firebase Console → Authentication → Settings → **Authorised domains**, add ONLY your Hugging Face Spaces URL (remove `localhost` in production)
- ✅ Enable **App Check** (optional, advanced) to block non-browser requests

---

### 2. Firestore Rules — Deploy these NOW

Go to **Firebase Console → Firestore → Rules** and paste:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

This means:
- A user can ONLY read/write their OWN document
- No one else can read any user's hearts, name, or data
- Anonymous visitors are completely blocked

---

### 3. "Someone can copy my URL and use Pollinations for free"

**Reality:** Pollinations.ai is a **free, open, public API** — it has no private keys.
Anyone can call `image.pollinations.ai` directly. There's nothing to protect there.

What you CAN do:
- Your Firestore **heart system** already limits how many images users generate per day
- If you add a backend proxy (Node.js/Python on HF Spaces), you can rate-limit by user ID

---

### 4. "Someone can copy my HuggingFace Space backend URL"

Your chat API at `https://shahid202-image30.hf.space/chat` is public.
To limit abuse, add rate limiting in your FastAPI backend:

```python
from slowapi import Limiter
from slowapi.util import get_remote_address
limiter = Limiter(key_func=get_remote_address)

@app.post("/chat")
@limiter.limit("30/minute")
async def chat(request: Request, ...):
    ...
```

Also add an auth header check — require a secret token:
```python
# In your FastAPI
SECRET = "bella-secret-2025"

@app.post("/chat")
async def chat(request: Request, x_bella_token: str = Header(None)):
    if x_bella_token != SECRET:
        raise HTTPException(status_code=403, detail="Forbidden")
    ...
```

Then in app.js, add the header:
```js
headers: {
  "Content-Type": "application/json",
  "x-bella-token": "bella-secret-2025"
}
```

This won't stop a determined developer but stops casual copycats completely.

---

### 5. Protecting your source code (obfuscation)

For Hugging Face Spaces (static HTML), the JS is always viewable.
You can run it through a minifier/obfuscator before deploying:

**Free tool:** https://obfuscator.io
- Paste your JS, enable "String Array", "Control Flow Flattening"
- Download and replace your js/ files

This makes the code very hard to read but doesn't hide API keys.

---

### 6. File structure for Hugging Face Spaces

```
your-space/
├── index.html
├── css/
│   └── style.css
├── js/
│   ├── firebase.js
│   └── app.js
└── firestore.rules   (use this in Firebase Console, not uploaded here)
```

Hugging Face Spaces with a static HTML template will serve these files correctly.

---

### 7. Authorised domains (most important step)

Firebase Console → Authentication → Settings → Authorised domains

**Keep only:**
- `shahid202-image30.hf.space` (or whatever your Space URL is)
- Remove `localhost` for production

This means even if someone copies your config, Firebase Auth will reject signups/logins from any other domain.
