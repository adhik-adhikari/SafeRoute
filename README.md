# SafeRoute 🗺️

SafeRoute is a mobile application that helps users navigate safely by providing real-time crime risk analysis and safer route suggestions. It combines a React Native / Expo frontend with a Django REST API backend powered by an AI-based risk scoring engine.

---

## 📱 Features

| Area | Status |
|---|---|
| Google Authentication | ✅ Done |
| Tab-based navigation (Home, Map, Report, Statistics, Profile) | ✅ Done |
| Django REST API with crime incident endpoints | ✅ Done |
| Crime incident reporting | ✅ Done |
| Risk area computation (distance + time-decay scoring) | ✅ Done |
| AI-powered crime report parsing (Gemini API) | ✅ Done |
| Push notification device registration | ✅ Done |
| Interactive map with risk overlays | ✅ Done |
| Route optimization with risk avoidance | ✅ Done |
| Crime statistics dashboard | ✅ Done |

---

## 📁 Project Structure

```
SafeRoute/
├── backend/
│   ├── requirements.txt
│   └── safeRoute/
│       ├── manage.py
│       ├── .env.example          # Copy to .env and fill in values
│       ├── alerts/               # Core Django app
│       │   ├── models.py         # CrimeIncident, RiskArea, Device
│       │   ├── views.py          # REST API views
│       │   ├── serializers.py
│       │   ├── urls.py
│       │   ├── utils.py          # Risk scoring, distance, time-decay
│       │   ├── chatgpt_cleaner.py # Gemini AI crime report parser
│       │   └── management/commands/process_crime.py
│       └── safeRoute/            # Django project settings
└── frontend/
    ├── app/
    │   ├── (tabs)/               # Home, Map, Report, Statistics, Profile
    │   ├── login.tsx
    │   └── _layout.tsx
    ├── components/               # Reusable UI components
    ├── services/auth.ts          # Authentication service
    ├── contexts/auth.tsx         # Auth context provider
    ├── constants/config.ts       # API base URL config
    └── .env.example              # Copy to .env and fill in values
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** v18+
- **Python** 3.10+
- **Expo Go** app on your iOS/Android device
- A **Gemini API key** (from [Google AI Studio](https://aistudio.google.com/))

---

### Backend Setup

```bash
cd backend/safeRoute

# Create and activate a virtual environment
python -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate

# Install dependencies
pip install -r ../requirements.txt

# Set up environment variables
cp .env.example .env
# Edit .env and fill in DJANGO_SECRET_KEY and GEMINI_API_KEY

# Run migrations and start the server
python manage.py migrate
python manage.py runserver 0.0.0.0:8000
```

The API will be available at `http://<your-local-ip>:8000/api/`.

#### Backend Environment Variables (`backend/safeRoute/.env`)

| Variable | Description |
|---|---|
| `DJANGO_SECRET_KEY` | Django secret key — generate one with `python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"` |
| `DEBUG` | `True` for development, `False` for production |
| `GEMINI_API_KEY` | Gemini API key for AI crime report parsing |

---

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env — set EXPO_PUBLIC_GEMINI_API_KEY and update API_BASE_URL in constants/config.ts

# Start the dev server
npx expo start
```

- Scan the QR code with **Expo Go** (Android) or the Camera app (iOS).
- Press `i` for iOS simulator or `a` for Android emulator.

#### Frontend Environment Variables (`frontend/.env`)

| Variable | Description |
|---|---|
| `EXPO_PUBLIC_GEMINI_API_KEY` | Gemini API key used by the frontend |

> Also update `frontend/constants/config.ts` with your machine's local IP address (replace the hardcoded value).

---

## 🔑 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/risk-areas/` | Get risk areas near a location (`?lat=&lon=&radius=`) |
| `POST` | `/api/crime-reports/` | Submit a new crime report |
| `GET` | `/api/crime-incidents/` | List all crime incidents |
| `POST` | `/api/register-device/` | Register a device for push notifications |
| `GET` | `/api/safe-route/` | Compute direct & risk-avoiding routes (`?start_lat=&start_lon=&end_lat=&end_lon=&mode=`) |

---

## 🛠️ Development Workflow

```bash
# Create a feature branch
git checkout -b feature/your-feature-name

# After making changes
git add .
git commit -m "feat: description of your changes"
git push origin feature/your-feature-name
```

Then open a Pull Request on GitHub targeting `main`.

---

## 🎨 Design System

| Token | Value |
|---|---|
| Primary Blue | `#1A237E` |
| Text Dark | `#333333` |
| Text Light | `#666666` |
| Border | `#E0E0E0` |

---

## 🤝 Resources

- [Expo Documentation](https://docs.expo.dev)
- [React Native Documentation](https://reactnative.dev)
- [Django REST Framework](https://www.django-rest-framework.org)
- [Google AI Studio (Gemini)](https://aistudio.google.com/)

---

> **Security reminder:** Never commit `.env` files, API keys, or secret keys to version control.
