// script.js - 完整版本，使用自訂 SVG 狀態指示器，移除數字並用 CSS 控制顏色
let personCheckedItems = {};
let isInitialLoad = true;
let hasLoadedDefaultItems = false;

// ============================================
// 初始化函數
// ============================================

document.addEventListener("DOMContentLoaded", function () {
    console.log('DOM loaded, starting initialization...');
    
    initializeBasicFunctions();
    loadDefaultItems();
    
    // 延遲檢查 Firebase 狀態
    setTimeout(() => {
        if (typeof window.firebaseDB !== 'undefined') {
            console.log('Firebase available, initializing...');
            initializeFirebaseListeners();
        } else {
            console.log('Firebase not available, using local mode');
        }
    }, 2000);
});

function initializeBasicFunctions() {
    console.log('Initializing basic functions...');
    
    initializePersonCheckedItems();
    
    const addBtn = document.getElementById("add-unified-item");
    if (addBtn) {
        console.log('Add button found, setting up event listener');
        addBtn.addEventListener("click", addUnifiedItem);
    } else {
        console.error('Add button not found!');
    }
    
    const inputs = document.querySelectorAll('.add-item-form input[type="text"]');
    console.log(`Found ${inputs.length} input fields`);
    inputs.forEach((input) => {
        input.addEventListener("keypress", function (e) {
            if (e.key === "Enter") {
                addUnifiedItem();
            }
        });
    });
}

function initializePersonCheckedItems() {
    personCheckedItems = { all: {} };
    const defaultPersons = ['Milli', 'Shawn', 'Henry', 'Peggy', 'Jin', 'Tee', 'Alex'];
    defaultPersons.forEach(person => {
        personCheckedItems[person] = {};
    });
    personCheckedItems['All'] = {};
}

// ============================================
// 狀態指示器相關函數
// ============================================

// 直接載入 SVG 內容作為內聯 SVG，這樣可以用 CSS 控制顏色
const statusIconsSVG = {
    'status-none': `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
        <path d="M16 2C8.27 2 2 8.27 2 16s6.27 14 14 14 14-6.27 14-14S23.73 2 16 2zm0 2c6.63 0 12 5.37 12 12s-5.37 12-12 12S4 22.63 4 16 9.37 4 16 4z" fill="currentColor"/>
    </svg>`,
    'status-partial': `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
        <path d="M2,16c0,7.73,6.27,14,14,14V2c-7.73,0-14,6.27-14,14Z" fill="currentColor"/>
    </svg>`,
    'status-complete': `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
        <circle cx="16" cy="16" r="14" fill="currentColor"/>
    </svg>`
};
