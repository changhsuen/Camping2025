// firebase-config.js - 新的安全配置
// 使用現代的 Firebase v9+ 模組化 SDK
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import { getDatabase, ref, onValue, set, push, remove, off } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-database.js";

// 新的安全 Firebase 配置
const firebaseConfig = {
  apiKey: "AIzaSyBzBUTgtUuoZXvFd2W-j8r5YxKbGEIcejo",
  authDomain: "camping2025-7f344.firebaseapp.com",
  databaseURL: "https://camping2025-7f344-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "camping2025-7f344",
  storageBucket: "camping2025-7f344.firebasestorage.app",
  messagingSenderId: "289367697942",
  appId: "1:289367697942:web:cf12f1e71190e315c9a337",
  measurementId: "G-6WS5BKM3CK"
};

// 檢查是否在允許的域名上運行
const allowedDomains = [
  'changhsuen.github.io',
  'localhost',
  '127.0.0.1'
];

const currentDomain = window.location.hostname;
const isDomainAllowed = allowedDomains.some(domain => 
  currentDomain === domain || currentDomain.includes(domain)
);

if (!isDomainAllowed) {
  console.warn('警告：當前域名未被授權使用此 Firebase 配置');
}

try {
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

  console.log('Firebase 初始化成功！');
} catch (error) {
  console.error('Firebase 初始化錯誤:', error);
  // 即使 Firebase 失敗，也要觸發事件讓應用可以使用本地儲存
  window.dispatchEvent(new Event('firebaseReady'));
}
