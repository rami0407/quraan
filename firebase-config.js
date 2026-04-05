// firebase-config.js
// إعدادات Firebase الخاصة بتطبيقك
// يرجى النقر على إعدادات المشروع (Project Settings) في لوحة تحكم Firebase
// ثم نسخ إعدادات الجزء الخاص بالويب ولصقها هنا مكان القيم الموجودة (YOUR_...)

const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    databaseURL: "https://YOUR_PROJECT_ID-default-rtdb.firebaseio.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// تهيئة تطبيق Firebase
firebase.initializeApp(firebaseConfig);

// تهيئة خدمات Firebase التي سنستخدمها
const auth = firebase.auth();
const db = firebase.database();
