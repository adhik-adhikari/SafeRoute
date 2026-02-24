# SafeRoute 🗺️ 

SafeRoute is a mobile application that helps users navigate safely by providing crime predictions and suggesting safer routes.

## 🚀 Quick Start

### Prerequisites
- Node.js (v14 or newer)
- npm or yarn
- Expo Go app on your iOS/Android device
- Xcode (for iOS development)
- Android Studio (for Android development)

### Setting Up Your Development Environment

1. **Clone the repository**
```bash
git clone https://github.com/Prasanna401623/SafeRoute.git
cd SafeRoute
```

2. **Install Frontend Dependencies**
```bash
cd frontend
npm install
```

3. **Start the Development Server**
```bash
npx expo start
```

4. **Run on Your Device**
- Install Expo Go on your iOS/Android device
- Scan the QR code:
  - iOS: Use your camera app
  - Android: Use the Expo Go app
- Or press 'i' for iOS simulator or 'a' for Android emulator

## 📱 Features

- ✅ Google Authentication
- ✅ Modern UI with consistent design
- ✅ Tab-based navigation
- 🚧 Map integration (in progress)
- 🚧 Crime statistics (in progress)
- 🚧 Backend integration (in progress)

## 🔑 Google OAuth Setup

1. **Get the Client ID**
   - Use the team's iOS client ID
   - Bundle identifier: `com.saferoute.app`

2. **Configure Your Environment**
   - The OAuth configuration is already set up in `app.json`
   - No additional configuration needed for development

## 📁 Project Structure

```
SafeRoute/
├── frontend/
│   ├── app/                    # Main application screens
│   │   ├── (tabs)/            # Tab-based navigation screens
│   │   │   ├── index.tsx      # Home screen
│   │   │   ├── map.tsx        # Map screen
│   │   │   ├── stats.tsx      # Statistics screen
│   │   │   └── profile.tsx    # Profile screen
│   │   ├── login.tsx          # Login screen
│   │   └── _layout.tsx        # Root layout configuration
│   ├── assets/                # Images and static files
│   ├── components/            # Reusable React components
│   └── services/              # API and authentication services
└── backend/                   # Django backend (coming soon)
```

## 🛠️ Development Workflow

1. **Create a New Branch**
```bash
git checkout -b feature/your-feature-name
```

2. **Make Your Changes**
- Follow the existing code style
- Keep components modular
- Maintain the established design system

3. **Test Your Changes**
- Test on both iOS and Android
- Verify Google Sign-In works
- Check all navigation flows

4. **Commit Your Changes**
```bash
git add .
git commit -m "Description of your changes"
git push origin feature/your-feature-name
```

5. **Create a Pull Request**
- Go to GitHub
- Create a PR from your branch to main
- Add a clear description of your changes
- Request review from team members

## 🎨 Design Guidelines

- **Colors**
  - Primary Blue: `#1A237E`
  - Text Dark: `#333333`
  - Text Light: `#666666`
  - Border Color: `#E0E0E0`

- **Components**
  - Use existing components from the components directory
  - Maintain consistent styling with the design system
  - Follow the login page's design language

## 🤝 Need Help?

- Check the [Expo documentation](https://docs.expo.dev)
- Review the [React Native documentation](https://reactnative.dev)
- Contact team lead for access to Google Cloud Console
- Reach out to team members on our communication channel

## 🔜 Coming Soon

- Django backend integration
- Google Maps integration
- Crime data visualization
- Route optimization algorithm
- User preferences and history

Remember to never commit sensitive information like API keys or credentials! 
