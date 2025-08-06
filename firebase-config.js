// Firebase configuration
// YOU NEED TO REPLACE THIS WITH YOUR ACTUAL FIREBASE CONFIG
const firebaseConfig = {
    apiKey: "AIzaSyDmIEYkkbw98BRTeCNv41vgUSxEJD8wVm4",
    authDomain: "betternotes-app.firebaseapp.com",
    projectId: "betternotes-app",
    storageBucket: "betternotes-app.firebasestorage.app",
    messagingSenderId: "536054248991",
    appId: "1:536054248991:web:235b018c1ee171504ec72a",
  };

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize Firestore
const db = firebase.firestore(); 