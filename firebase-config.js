// firebase-config.js

const firebaseConfig = {
  apiKey: "AIzaSyAHRILjNdZX6vygOx_lYyMTqlp-I86s-n0",
  authDomain: "qoraan-c95c1.firebaseapp.com",
  databaseURL: "https://qoraan-c95c1-default-rtdb.firebaseio.com",
  projectId: "qoraan-c95c1",
  storageBucket: "qoraan-c95c1.firebasestorage.app",
  messagingSenderId: "429753405831",
  appId: "1:429753405831:web:e567cbf5e2bbdf0229c322",
  measurementId: "G-D6BBEPV4T8"
};

// تهيئة تطبيق Firebase
firebase.initializeApp(firebaseConfig);

// تهيئة خدمات Firebase التي سنستخدمها
const auth = firebase.auth();
const db = firebase.database();
