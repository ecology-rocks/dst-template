// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app"
import { getAuth, GoogleAuthProvider } from "firebase/auth"
import { getFirestore } from "firebase/firestore"
import { getFunctions } from "firebase/functions" // <--- ADD THIS
import { getStorage } from 'firebase/storage'
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyB3oGf-A-vuQbQkuNdwAtP59oH6QTlAYeY",
  authDomain: "dogsporttees.firebaseapp.com",
  projectId: "dogsporttees",
  storageBucket: "dogsporttees.firebasestorage.app",
  messagingSenderId: "226816258728",
  appId: "1:226816258728:web:1e6d404e3b6da06afa089d",
  measurementId: "G-0Z8ZNLCTNR"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app)
const db = getFirestore(app)
// Explicitly tell the SDK which region your backend lives in
const functions = getFunctions(app, 'us-central1')
const googleProvider = new GoogleAuthProvider()
const storage = getStorage(app)

export { auth, db, functions, googleProvider, storage, analytics }