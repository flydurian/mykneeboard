// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getDatabase } from "firebase/database";
import { getAuth } from "firebase/auth";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBqCk8phg_Bd8_3sz2Qnvy4WRRvH8Mf5k0",
  authDomain: "flightdashboard-159bc.firebaseapp.com",
  databaseURL: "https://flightdashboard-159bc-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "flightdashboard-159bc",
  storageBucket: "flightdashboard-159bc.firebasestorage.app",
  messagingSenderId: "834175395337",
  appId: "1:834175395337:web:839e1d56796b621a97fad8",
  measurementId: "G-X2FMMSY232"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const database = getDatabase(app);
const auth = getAuth(app);

export { app, analytics, database, auth };
