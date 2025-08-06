# BetterNotes - Simple Note Taking App

A clean, modern note-taking web application built with vanilla JavaScript, Firebase, and deployed on Netlify.

## Features

- ✨ Create new notes
- 🗑️ Delete notes with confirmation
- 🔄 Switch between notes easily
- 💾 Auto-save functionality
- 📱 Responsive design
- ☁️ Cloud storage with Firebase

## Setup Instructions

### 1. Firebase Setup (Free Tier)

1. **Create a Firebase Project:**
   - Go to [Firebase Console](https://console.firebase.google.com/)
   - Click "Create a project"
   - Enter project name (e.g., "betternotes-app")
   - Disable Google Analytics (optional for this app)
   - Click "Create project"

2. **Setup Firestore Database:**
   - In your Firebase project, go to "Firestore Database"
   - Click "Create database"
   - Choose "Start in test mode" (we'll secure it later)
   - Select a location close to you
   - Click "Done"

3. **Get Firebase Configuration:**
   - Go to Project Settings (gear icon)
   - Scroll down to "Your apps"
   - Click "Web" icon (</>) to add a web app
   - Register your app with a nickname
   - Copy the `firebaseConfig` object

4. **Update Firebase Configuration:**
   - Open `firebase-config.js` in your project
   - Replace the placeholder config with your actual Firebase config:

   ```javascript
   const firebaseConfig = {
     apiKey: "your-actual-api-key",
     authDomain: "your-project-id.firebaseapp.com",
     projectId: "your-project-id",
     storageBucket: "your-project-id.appspot.com",
     messagingSenderId: "your-sender-id",
     appId: "your-app-id"
   };
   ```

5. **Setup Firestore Security Rules (Optional but Recommended):**
   - Go to Firestore Database > Rules
   - Replace with these basic rules:

   ```javascript
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /notes/{document} {
         allow read, write: if true; // For demo purposes - make more restrictive in production
       }
     }
   }
   ```

### 2. Netlify Setup (Free Tier)

1. **Prepare Your Code:**
   - Make sure all files are in your project directory
   - Ensure `firebase-config.js` has your actual Firebase configuration

2. **Deploy to Netlify:**

   **Option A: Drag & Drop (Easiest)**
   - Go to [Netlify](https://netlify.com)
   - Sign up/Login
   - Drag your entire project folder to the deploy area
   - Your app will be live in seconds!

   **Option B: Git Integration (Recommended)**
   - Push your code to GitHub/GitLab/Bitbucket
   - In Netlify, click "New site from Git"
   - Connect your repository
   - Build settings should auto-detect (no build command needed)
   - Deploy!

3. **Custom Domain (Optional):**
   - In Netlify dashboard, go to Site settings > Domain management
   - Add your custom domain or use the provided netlify.app subdomain

## Project Structure

```
betternotes/
├── index.html          # Main HTML file
├── styles.css          # CSS styling
├── app.js             # Main application logic
├── firebase-config.js  # Firebase configuration
├── netlify.toml       # Netlify deployment settings
├── package.json       # Project metadata
└── README.md          # This file
```

## Usage

1. **Create a New Note:** Click the "New Note" button
2. **Edit Notes:** Click on any note in the sidebar to edit it
3. **Auto-save:** Notes are automatically saved as you type
4. **Manual Save:** Click "Save Note" button for immediate save
5. **Delete Notes:** Click the delete button (🗑️) with confirmation

## Technologies Used

- **Frontend:** HTML5, CSS3, Vanilla JavaScript
- **Database:** Firebase Firestore
- **Hosting:** Netlify
- **Styling:** Modern CSS with Inter font

## Free Tier Limits

**Firebase (Spark Plan):**
- 1 GiB stored
- 50K reads, 20K writes, 20K deletes per day
- Perfect for personal note-taking

**Netlify:**
- 100 GB bandwidth/month
- 300 build minutes/month
- Automatic HTTPS

## Development

To run locally:
1. Make sure your Firebase config is set up
2. Open `index.html` in a web browser
3. Or use a local server: `python -m http.server 8000`

## Security Note

The current Firestore rules allow anyone to read/write. For production use, implement proper authentication and security rules.

## Support

If you encounter any issues:
1. Check browser console for errors
2. Verify Firebase configuration
3. Ensure Firestore database is created and accessible 