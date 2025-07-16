// firebase-config.js
// 使用現代的 Firebase v9+ 模組化 SDK
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import { getDatabase, ref, onValue, set, push, remove, off } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-database.js";

// 你的 Firebase 配置
const firebaseConfig = {
  apiKey: "AIzaSyAGnd5L79bGb4Gkz4V8PJ1GttuqOGBbEvw",
  authDomain: "camping2025-7f344.firebaseapp.com",
  databaseURL: "https://camping2025-7f344-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "camping2025-7f344",
  storageBucket: "camping2025-7f344.firebasestorage.app",
  messagingSenderId: "289367697942",
  appId: "1:289367697942:web:b1049b9a16e69778c9a337",
  measurementId: "G-B5F34BY5JX"
};

// 初始化 Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

// 導出函數供其他文件使用
window.firebaseDB = database;
window.firebaseRef = (path) => ref(database, path);
window.firebaseOnValue = onValue;
window.firebaseSet = set;
window.firebasePush = push;
window.firebaseRemove = remove;
window.firebaseOff = off;

// 觸發自定義事件通知 Firebase 已準備就緒
window.dispatchEvent(new Event('firebaseReady'));

console.log('Firebase initialized successfully!');
