import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyA8DFiy1Krb4Zsb_EMGKL_FaCF6sK8U9-U",
  authDomain: "educonnect-ai-19f96.firebaseapp.com",
  projectId: "educonnect-ai-19f96",
  storageBucket: "educonnect-ai-19f96.firebasestorage.app",
  messagingSenderId: "498527909477",
  appId: "1:498527909477:web:939cf407229d3e368cf88c"
};

const app =
  getApps().length === 0
    ? initializeApp(firebaseConfig)
    : getApps()[0];

export const db = getFirestore(app);
export const auth = getAuth(app);

export default app;