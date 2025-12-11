// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries
import { getFirestore } from "firebase/firestore"; // THÊM DÒNG NÀY
// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBB8qyd_u7Yd1Nql3u-3tJ02Ohm1bbtT6Y",
  authDomain: "mathgenius-thu18.firebaseapp.com",
  projectId: "mathgenius-thu18",
  storageBucket: "mathgenius-thu18.firebasestorage.app",
  messagingSenderId: "96381399270",
  appId: "1:96381399270:web:328c841027ddc2c77a4b27",
  measurementId: "G-66F83H5226"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app); // THÊM DÒNG NÀY