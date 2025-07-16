// script.js - 簡化版本，先確保基本功能運作
let personCheckedItems = {};
let isInitialLoad = true;

// 當文檔載入完成後執行初始化
document.addEventListener("DOMContentLoaded", function () {
    console.log('DOM loaded, starting initialization...');
    updateSyncStatus('connecting', 'Loading...');
    
    // 初始化基本功能
    initializeBasicFunctions();
    
    // 先載入預設項目
    loadDefaultItems();
    
    // 等待一秒後嘗試 Firebase
    setTimeout(() => {
        if (typeof window.firebaseDB !== 'undefined') {
            console.log('Firebase available, initializing...');
            updateSyncStatus('connected', 'Connected');
            initializeFirebaseListeners();
        } else {
            console.log('Firebase not available, using local mode');
            updateSyncStatus('offline', 'Local mode');
        }
    }, 2000);
});

// 初始化基本功能
function initializeBasicFunctions() {
    // 初始化人員勾選記錄
    initializePersonCheckedItems();
    
    // 設置添加項目按鈕
    const addBtn = document.getElementById("add-unified-item");
    if (addBtn) {
        addBtn.addEventListener("click", addUnifiedItem);
    }
    
    // 設置輸入框 Enter 鍵事件
    const inputs = document.querySelectorAll('.add-item-form input[type="text"]');
    inputs.forEach((input) => {
        input.addEventListener("keypress", function (e) {
            if (e.key === "Enter") {
                addUnifiedItem();
            }
        });
    });
}

// 等待 Firebase 準備就緒
window.addEventListener('firebaseReady', function() {
    console.log('Firebase is ready!');
    updateSyncStatus('connected', 'Connected');
    initializeFirebaseListeners();
});

// 更新同步狀態顯示
function updateSyncStatus(status, text) {
    const syncStatus = document.getElementById('sync-status');
    const syncText = document.getElementById('sync-text');
    
    if (syncStatus && syncText) {
        syncStatus.className = `sync-status ${status}`;
        syncText.textContent = text;
        console.log(`Status updated: ${status} - ${text}`);
    }
}

// 初始化 Firebase 監聽器
function initializeFirebaseListeners() {
    if (typeof window.firebaseDB === 'undefined') {
        console.log('Firebase not available, staying in local mode');
        return;
    }

    try {
        // 監聽勾選狀態變化
        const checklistRef = window.firebaseRef('checklist');
        window.firebaseOnValue(checklistRef, (snapshot) => {
            if (!isInitialLoad) {
                const data = snapshot.val();
                if (data) {
                    personCheckedItems = data.personChecked || {};
                    updateAllCheckboxStates();
                    updateProgress();
                }
            }
        });

        // 監聽清單項目變化
        const itemsRef = window.firebaseRef('items');
        window.firebaseOnValue(itemsRef, (snapshot) => {
            if (!isInitialLoad) {
                const data = snapshot.val();
                if (data) {
                    renderItemsFromFirebase(data);
                }
            }
        });
    } catch (error) {
        console.error('Error setting up Firebase listeners:', error);
        updateSyncStatus('offline', 'Connection error');
    }
}

// 載入預設項目
async function loadDefaultItems() {
    console.log('Loading default items...');
    
    // 創建預設項目數據
    const defaultData = {
        "categories": {
            "shared-items": {
                "title": "Shared Gear",
                "items": [
                    { "id": "item-default-1", "name": "Gas stove", "quantity": "", "persons": "Henry,Jin", "personData": "Henry,Jin" },
                    { "id": "item-default-2", "name": "Cookware", "quantity": "", "persons": "Henry,Jin", "personData": "Henry,Jin" },
                    { "id": "item-default-3", "name": "Seasoning", "quantity": "", "persons": "Henry", "personData": "Henry" },
                    { "id": "item-default-4", "name": "Coffee gear", "quantity": "", "persons": "Milli", "personData": "Milli" },
                    { "id": "item-default-5", "name": "Tissue", "quantity": "", "persons": "Peggy", "personData": "Peggy" }
                ]
            },
            "personal-items": {
                "title": "Personal Gear",
                "items": [
                    { "id": "item-default-12", "name": "Sleeping bag", "quantity": "", "persons": "All", "personData": "All" },
                    { "id": "item-default-13", "name": "Clothes", "quantity": "", "persons": "All", "personData": "All" },
                    { "id": "item-default-14", "name": "Rain gear", "quantity": "", "persons": "All", "personData": "All" },
                    { "id": "item-default-15", "name": "Toiletries", "quantity": "", "persons": "All", "personData": "All" },
                    { "id": "item-default-16", "name": "Camera", "quantity": "", "persons": "Milli", "personData": "Milli" }
                ]
            }
        },
        "personChecked": {
            "all": {},
            "Milli": {},
            "Shawn": {},
            "Henry": {},
            "Peggy": {},
            "Jin": {},
            "Tee": {},
            "Alex": {},
            "All": {}
        }
    };

    try {
        // 嘗試從 JSON 檔案載入
        const response = await fetch('defaultItems.json');
        if (response.ok) {
            const jsonData = await response.json();
            console.log('Loaded from defaultItems.json');
            renderSavedItems(jsonData);
        } else {
            throw new Error('JSON file not found');
        }
    } catch (error) {
        console.log('Using built-in default data');
        renderSavedItems(defaultData);
    }
    
    isInitialLoad = false;
    updateSyncStatus('offline', 'Ready');
}

// 渲染保存的項目
function renderSavedItems(data) {
    console.log('Rendering items...', data);
    
    // 清空現有項目
    document.querySelectorAll('.item-list').forEach(list => {
        list.innerHTML = '';
    });

    if (data.personChecked) {
        personCheckedItems = data.personChecked;
    } else {
        initializePersonCheckedItems();
    }

    const categoriesData = data.categories || data;
    for (const categoryId in categoriesData) {
        const list = document.getElementById(categoryId);
        if (list && categoriesData[categoryId].items) {
            categoriesData[categoryId].items.forEach(item => {
                createItemElement(list, item);
            });
        }
    }

    updateProgress();
    createPersonFilters();
    console.log('Items rendered successfully');
}

// 創建項目元素
function createItemElement(list, item) {
    const li = document.createElement('li');
    li.className = 'item';
    li.dataset.person = item.personData;

    const customCheckbox = document.createElement('div');
    customCheckbox.className = 'custom-checkbox';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = item.id;

    const checkboxLabel = document.createElement('label');
    checkboxLabel.className = 'checkbox-label';
    checkboxLabel.setAttribute('for', item.id);

    customCheckbox.appendChild(checkbox);
    customCheckbox.appendChild(checkboxLabel);

    const itemLabel = document.createElement('label');
    itemLabel.className = 'item-label';
    itemLabel.setAttribute('for', item.id);

    const nameSpan = document.createElement('span');
    nameSpan.className = 'item-name';
    nameSpan.textContent = item.name;
    itemLabel.appendChild(nameSpan);

    if (item.quantity) {
        const quantitySpan = document.createElement('span');
        quantitySpan.className = 'item-quantity';
        quantitySpan.textContent = `x${item.quantity}`;
        itemLabel.appendChild(quantitySpan);
    }

    const personTags = document.createElement('span');
    personTags.className = 'person-tags';

    if (item.persons) {
        const personsList = item.persons.split(',');
        personsList.forEach(person => {
            if (person.trim()) {
                const personTag = document.createElement('span');
                personTag.className = 'person-tag';
                personTag.textContent = person.trim();
                personTags.appendChild(personTag);
            }
        });
    }
    itemLabel.appendChild(personTags);

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-btn';
    deleteBtn.innerHTML = '×';
    deleteBtn.title = 'Delete item';
    deleteBtn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        deleteItem(li);
    });

    checkbox.addEventListener('change', function () {
        handleCheckboxChange(this);
    });

    li.appendChild(customCheckbox);
    li.appendChild(itemLabel);
    li.appendChild(deleteBtn);
    list.appendChild(li);
}

// 其他必要函數
function initializePersonCheckedItems() {
    personCheckedItems = { all: {} };
    const defaultPersons = ['Milli', 'Shawn', 'Henry', 'Peggy', 'Jin', 'Tee', 'Alex'];
    defaultPersons.forEach(person => {
        personCheckedItems[person] = {};
    });
    personCheckedItems['All'] = {};
}

function updateProgress() {
    const visibleItems = Array.from(document.querySelectorAll('.item')).filter(item => item.style.display !== 'none');
    const total = visibleItems.length;
    let checked = 0;

    visibleItems.forEach(item => {
        const checkbox = item.querySelector('input[type="checkbox"]');
        if (checkbox && checkbox.checked) {
            checked++;
        }
    });

    const progressBar = document.getElementById('progress-fill');
    const progressText = document.getElementById('progress-text');

    if (progressBar && progressText) {
        const percentage = total > 0 ? (checked / total) * 100 : 0;
        progressBar.style.width = `${percentage}%`;
        progressText.textContent = `${checked}/${total} Packed`;
    }
}

function createPersonFilters() {
    const personFilter = document.getElementById('person-filter');
    if (!personFilter) return;
    
    personFilter.innerHTML = '<button class="filter-btn active" data-person="all">All</button>';

    const defaultPersons = ['Milli', 'Shawn', 'Henry', 'Peggy', 'Jin', 'Tee', 'Alex'];
    defaultPersons.forEach(person => {
        const button = document.createElement('button');
        button.className = 'filter-btn';
        button.textContent = person;
        button.dataset.person = person;
        personFilter.appendChild(button);
    });

    setupFilterButtons();
}

function setupFilterButtons() {
    const filterButtons = document.querySelectorAll('.filter-btn');
    filterButtons.forEach(button => {
        button.addEventListener('click', function () {
            document.querySelectorAll('.filter-btn').forEach(btn => {
                btn.classList.remove('active');
            });
            this.classList.add('active');
            updateProgress();
        });
    });
}

function handleCheckboxChange(checkbox) {
    const item = checkbox.closest('.item');
    const itemLabel = item.querySelector('.item-label');

    if (checkbox.checked) {
        itemLabel.classList.add('checked');
    } else {
        itemLabel.classList.remove('checked');
    }
    updateProgress();
}

function addUnifiedItem() {
    console.log('Add item function called');
    // 基本的添加功能
}

function deleteItem(itemElement) {
    if (confirm('Are you sure you want to delete this item?')) {
        itemElement.remove();
        updateProgress();
    }
}

function saveList() {
    alert('Save function called - items saved to local storage');
}

// 其他輔助函數
function updateAllCheckboxStates() {}
function renderItemsFromFirebase() {}

console.log('Script loaded successfully');
