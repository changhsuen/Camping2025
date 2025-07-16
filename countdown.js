// countdown.js - 倒數計時功能（修復版）
// 設定目標日期：2025年3月15日 11:30
const targetDate = new Date(2025, 2, 15, 11, 30, 0).getTime();

// 定義倒數計時間隔變數
let countdownInterval;

// 更新倒數計時的函數
function updateCountdown() {
  // 取得現在的時間
  const now = new Date().getTime();

  // 計算剩餘的時間（毫秒）
  const timeRemaining = targetDate - now;

  // 如果已經到達或超過目標時間
  if (timeRemaining <= 0) {
    const daysEl = document.getElementById("days");
    const hoursEl = document.getElementById("hours");
    const minutesEl = document.getElementById("minutes");
    const secondsEl = document.getElementById("seconds");
    
    if (daysEl) daysEl.textContent = "00";
    if (hoursEl) hoursEl.textContent = "00";
    if (minutesEl) minutesEl.textContent = "00";
    if (secondsEl) secondsEl.textContent = "00";
    
    if (countdownInterval) {
      clearInterval(countdownInterval);
    }
    return;
  }

  // 計算天、小時、分鐘和秒數
  const days = Math.floor(timeRemaining / (1000 * 60 * 60 * 24));
  const hours = Math.floor((timeRemaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((timeRemaining % (1000 * 60)) / 1000);

  // 更新HTML元素 - 確保元素存在且總是有兩位數字
  const daysEl = document.getElementById("days");
  const hoursEl = document.getElementById("hours");
  const minutesEl = document.getElementById("minutes");
  const secondsEl = document.getElementById("seconds");
  
  if (daysEl) daysEl.textContent = days.toString().padStart(2, "0");
  if (hoursEl) hoursEl.textContent = hours.toString().padStart(2, "0");
  if (minutesEl) minutesEl.textContent = minutes.toString().padStart(2, "0");
  if (secondsEl) secondsEl.textContent = seconds.toString().padStart(2, "0");
}

// 等待 DOM 載入完成後再啟動
document.addEventListener('DOMContentLoaded', function() {
  // 初次執行
  updateCountdown();
  
  // 設定每秒更新一次
  countdownInterval = setInterval(updateCountdown, 1000);
});
