// 設定目標日期：2025年3月15日 11:30
const targetDate = new Date(2025, 2, 15, 11, 30, 0).getTime();

// 更新倒數計時的函數
function updateCountdown() {
  // 取得現在的時間
  const now = new Date().getTime();

  // 計算剩餘的時間（毫秒）
  const timeRemaining = targetDate - now;

  // 如果已經到達或超過目標時間
  if (timeRemaining <= 0) {
    document.getElementById("days").textContent = "00";
    document.getElementById("hours").textContent = "00";
    document.getElementById("minutes").textContent = "00";
    document.getElementById("seconds").textContent = "00";
    clearInterval(countdownInterval);
    return;
  }

  // 計算天、小時、分鐘和秒數
  const days = Math.floor(timeRemaining / (1000 * 60 * 60 * 24));
  const hours = Math.floor((timeRemaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((timeRemaining % (1000 * 60)) / 1000);

  // 更新HTML元素 - 確保總是有兩位數字
  document.getElementById("days").textContent = days.toString().padStart(2, "0");
  document.getElementById("hours").textContent = hours.toString().padStart(2, "0");
  document.getElementById("minutes").textContent = minutes.toString().padStart(2, "0");
  document.getElementById("seconds").textContent = seconds.toString().padStart(2, "0");
}

// 初次執行
updateCountdown();

// 設定每秒更新一次
const countdownInterval = setInterval(updateCountdown, 1000);
