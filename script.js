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
    
    // 保持當前選中的人員
    const currentActive = document.querySelector('.filter-btn.active');
    const currentPerson = currentActive ? currentActive.dataset.person : 'all';
    
    personFilter.innerHTML = '<button class="filter-btn" data-person="all">All</button>';

    // 收集所有出現在項目中的人員
    const allPersons = new Set(['Milli', 'Shawn', 'Henry', 'Peggy', 'Jin', 'Tee', 'Alex']);
    
    document.querySelectorAll('.item').forEach(item => {
        const persons = item.dataset.person.split(',');
        persons.forEach(person => {
            const trimmedPerson = person.trim();
            if (trimmedPerson && trimmedPerson !== 'All' && trimmedPerson !== 'Tag') {
                allPersons.add(trimmedPerson);
            }
        });
    });

    // 為每個人創建篩選按鈕
    allPersons.forEach(person => {
        if (person && person !== 'all') {
            const button = document.createElement('button');
            button.className = 'filter-btn';
            button.textContent = person;
            button.dataset.person = person;
            personFilter.appendChild(button);
        }
    });

    // 恢復之前選中的狀態
    const buttonToActivate = personFilter.querySelector(`[data-person="${currentPerson}"]`);
    if (buttonToActivate) {
        buttonToActivate.classList.add('active');
    } else {
        personFilter.querySelector('[data-person="all"]').classList.add('active');
    }

    // 重新設置按鈕事件
    setupFilterButtons();

    // 確保每個人的勾選記錄已初始化
    allPersons.forEach(person => {
        if (!personCheckedItems[person]) {
            personCheckedItems[person] = {};
        }
    });
}

function setupFilterButtons() {
    const filterButtons = document.querySelectorAll('.filter-btn');
    filterButtons.forEach(button => {
        button.addEventListener('click', function () {
            const person = this.dataset.person;
            
            // 更新按鈕狀態
            document.querySelectorAll('.filter-btn').forEach(btn => {
                btn.classList.remove('active');
            });
            this.classList.add('active');
            
            // 執行篩選
            filterItems(person);
            
            // 更新勾選框狀態以顯示該人員的勾選情況
            updateCheckboxStates();
            
            updateProgress();
        });
    });
}

// 篩選項目函數
function filterItems(person) {
    const items = document.querySelectorAll('.item');
    
    items.forEach(item => {
        if (person === 'all') {
            // 如果選擇 "All"，顯示所有項目
            item.style.display = '';
        } else {
            // 獲取項目的負責人列表
            const itemPersons = item.dataset.person.split(',').map(p => p.trim());
            
            // 檢查是否包含選擇的人員或 "All" 標籤
            if (itemPersons.includes(person) || itemPersons.includes('All')) {
                item.style.display = '';
            } else {
                item.style.display = 'none';
            }
        }
    });
    
    console.log(`Filtered for: ${person}`);
}

// 獲取當前篩選的人員
function getCurrentFilterPerson() {
    const activeButton = document.querySelector('.filter-btn.active');
    return activeButton ? activeButton.dataset.person : 'all';
}

// 更新所有勾選框狀態（當切換篩選時）
function updateCheckboxStates() {
    const currentPerson = getCurrentFilterPerson();
    const checkboxes = document.querySelectorAll('input[type="checkbox"]');

    checkboxes.forEach(checkbox => {
        const itemId = checkbox.id;
        const item = checkbox.closest('.item');
        const itemLabel = item.querySelector('.item-label');

        // 檢查該人員是否勾選了此項目
        const isChecked = personCheckedItems[currentPerson] && personCheckedItems[currentPerson][itemId] === true;
        
        checkbox.checked = isChecked;
        
        if (isChecked) {
            itemLabel.classList.add('checked');
        } else {
            itemLabel.classList.remove('checked');
        }
    });
}

function handleCheckboxChange(checkbox) {
    const currentPerson = getCurrentFilterPerson();
    const itemId = checkbox.id;
    const item = checkbox.closest('.item');
    const itemLabel = item.querySelector('.item-label');

    // 更新視覺狀態
    if (checkbox.checked) {
        itemLabel.classList.add('checked');
        // 記錄該人員勾選此項目
        if (!personCheckedItems[currentPerson]) {
            personCheckedItems[currentPerson] = {};
        }
        personCheckedItems[currentPerson][itemId] = true;
    } else {
        itemLabel.classList.remove('checked');
        // 移除該人員對此項目的勾選記錄
        if (personCheckedItems[currentPerson]) {
            delete personCheckedItems[currentPerson][itemId];
        }
    }
    
    updateProgress();
    
    // 同步到 Firebase（如果可用）
    if (typeof window.firebaseDB !== 'undefined') {
        syncChecklistToFirebase();
    }
}

// 同步勾選狀態到 Firebase
function syncChecklistToFirebase() {
    if (typeof window.firebaseDB === 'undefined') {
        return;
    }

    try {
        const checklistRef = window.firebaseRef('checklist');
        window.firebaseSet(checklistRef, {
            personChecked: personCheckedItems,
            lastUpdated: new Date().toISOString()
        });
        console.log('Synced to Firebase');
    } catch (error) {
        console.error('Error syncing to Firebase:', error);
    }
}

function handleCheckboxChange(checkbox) {
    const currentPerson = getCurrentFilterPerson();
    const itemId = checkbox.id;
    const item = checkbox.closest('.item');
    const itemLabel = item.querySelector('.item-label');

    // 更新視覺狀態
    if (checkbox.checked) {
        itemLabel.classList.add('checked');
        // 記錄該人員勾選此項目
        if (!personCheckedItems[currentPerson]) {
            personCheckedItems[currentPerson] = {};
        }
        personCheckedItems[currentPerson][itemId] = true;
    } else {
        itemLabel.classList.remove('checked');
        // 移除該人員對此項目的勾選記錄
        if (personCheckedItems[currentPerson]) {
            delete personCheckedItems[currentPerson][itemId];
        }
    }
    
    updateProgress();
    
    // 同步到 Firebase（如果可用）
    if (typeof window.firebaseDB !== 'undefined') {
        syncChecklistToFirebase();
    }
}

// 獲取當前篩選的人員
function getCurrentFilterPerson() {
    const activeButton = document.querySelector('.filter-btn.active');
    return activeButton ? activeButton.dataset.person : 'all';
}

// 更新所有勾選框狀態（當切換篩選時）
function updateCheckboxStates() {
    const currentPerson = getCurrentFilterPerson();
    const checkboxes = document.querySelectorAll('input[type="checkbox"]');

    checkboxes.forEach(checkbox => {
        const itemId = checkbox.id;
        const item = checkbox.closest('.item');
        const itemLabel = item.querySelector('.item-label');

        // 檢查該人員是否勾選了此項目
        const isChecked = personCheckedItems[currentPerson] && personCheckedItems[currentPerson][itemId] === true;
        
        checkbox.checked = isChecked;
        
        if (isChecked) {
            itemLabel.classList.add('checked');
        } else {
            itemLabel.classList.remove('checked');
        }
    });
}

// 同步勾選狀態到 Firebase
function syncChecklistToFirebase() {
    if (typeof window.firebaseDB === 'undefined') {
        return;
    }

    try {
        const checklistRef = window.firebaseRef('checklist');
        window.firebaseSet(checklistRef, {
            personChecked: personCheckedItems,
            lastUpdated: new Date().toISOString()
        });
        console.log('Synced to Firebase');
    } catch (error) {
        console.error('Error syncing to Firebase:', error);
    }
}

function addUnifiedItem() {
    console.log('Add item function called');
    
    const categorySelect = document.getElementById('category-select');
    const nameInput = document.getElementById('new-item-name');
    const quantityInput = document.getElementById('new-item-quantity');
    const personInput = document.getElementById('new-item-person');

    const category = categorySelect.value.trim();
    const name = nameInput.value.trim();
    const quantity = quantityInput.value.trim();
    const persons = personInput.value.trim();

    // 檢查輸入是否有效
    if (!category) {
        alert('Please select a category');
        return;
    }

    if (!name) {
        alert('Please enter item name');
        return;
    }

    // 確定要添加到哪個列表
    let listId;
    switch (category) {
        case 'Shared Gear':
            listId = 'shared-items';
            break;
        case 'Personal Gear':
            listId = 'personal-items';
            break;
        default:
            listId = 'shared-items';
    }

    // 添加新項目
    addNewItem(listId, name, quantity, persons);

    // 清空輸入框
    nameInput.value = '';
    quantityInput.value = '';
    personInput.value = '';
    
    console.log(`Added new item: ${name} to ${listId}`);
}

// 添加新項目到指定列表
function addNewItem(listId, name, quantity, persons) {
    if (!name) return;
    
    const list = document.getElementById(listId);
    if (!list) {
        console.error(`List with id ${listId} not found`);
        return;
    }
    
    const id = `item-${Date.now()}`;
    
    const item = {
        id: id,
        name: name,
        quantity: quantity,
        persons: persons || 'All',
        personData: persons || 'All'
    };
    
    // 創建項目元素
    createItemElement(list, item);
    
    // 更新進度和篩選器
    updateProgress();
    createPersonFilters();

    // 確保人員勾選記錄已初始化
    if (persons) {
        const personsList = persons.split(',');
        personsList.forEach(person => {
            const trimmedPerson = person.trim();
            if (trimmedPerson && !personCheckedItems[trimmedPerson]) {
                personCheckedItems[trimmedPerson] = {};
            }
        });
    }
    
    // 同步到 Firebase（如果可用）
    if (typeof window.firebaseDB !== 'undefined') {
        syncItemsToFirebase();
    }
    
    console.log(`Successfully added item: ${name}`);
}

// 同步項目到 Firebase
function syncItemsToFirebase() {
    if (typeof window.firebaseDB === 'undefined') {
        return;
    }

    const items = {};
    
    // 收集所有項目
    document.querySelectorAll('.category-section').forEach(category => {
        const categoryList = category.querySelector('.item-list');
        if (!categoryList) return;
        
        const categoryId = categoryList.id;
        items[categoryId] = [];

        category.querySelectorAll('.item').forEach(item => {
            const checkbox = item.querySelector('input[type="checkbox"]');
            const nameSpan = item.querySelector('.item-name');
            const quantitySpan = item.querySelector('.item-quantity');
            const personTags = item.querySelectorAll('.person-tag');

            if (!checkbox || !nameSpan) return;

            const persons = Array.from(personTags)
                .map(tag => tag.textContent)
                .join(',');

            items[categoryId].push({
                id: checkbox.id,
                name: nameSpan.textContent,
                quantity: quantitySpan ? quantitySpan.textContent.replace('x', '') : '',
                persons: persons,
                personData: item.dataset.person,
            });
        });
    });

    try {
        const itemsRef = window.firebaseRef('items');
        window.firebaseSet(itemsRef, items);
        console.log('Items synced to Firebase');
    } catch (error) {
        console.error('Error syncing items to Firebase:', error);
    }
}

function deleteItem(itemElement) {
    if (confirm('Are you sure you want to delete this item?')) {
        // 從所有人的勾選記錄中刪除該項目
        const itemId = itemElement.querySelector('input[type="checkbox"]')?.id;
        if (itemId) {
            for (let person in personCheckedItems) {
                delete personCheckedItems[person][itemId];
            }
        }
        
        itemElement.remove();
        updateProgress();
        createPersonFilters();
        
        // 同步到 Firebase（如果可用）
        if (typeof window.firebaseDB !== 'undefined') {
            syncChecklistToFirebase();
            syncItemsToFirebase();
        }
        
        console.log('Item deleted successfully');
    }
}

function saveList() {
    // 保存到本地儲存
    const categories = document.querySelectorAll('.category-section');
    const savedData = {
        categories: {},
        personChecked: personCheckedItems,
        lastSaved: new Date().toISOString()
    };

    categories.forEach(category => {
        const categoryList = category.querySelector('.item-list');
        if (!categoryList) return;
        
        const categoryId = categoryList.id;
        const categoryTitle = category.querySelector('.category-title')?.textContent || 'Unknown';
        const items = [];

        category.querySelectorAll('.item').forEach(item => {
            const checkbox = item.querySelector('input[type="checkbox"]');
            const nameSpan = item.querySelector('.item-name');
            const quantitySpan = item.querySelector('.item-quantity');
            const personTags = item.querySelectorAll('.person-tag');

            if (!checkbox || !nameSpan) return;

            const persons = Array.from(personTags)
                .map(tag => tag.textContent)
                .join(',');

            items.push({
                id: checkbox.id,
                name: nameSpan.textContent,
                quantity: quantitySpan ? quantitySpan.textContent.replace('x', '') : '',
                persons: persons,
                personData: item.dataset.person,
            });
        });

        savedData.categories[categoryId] = {
            title: categoryTitle,
            items: items,
        };
    });

    localStorage.setItem('campingChecklist2025', JSON.stringify(savedData));
    
    // 同步到 Firebase（如果可用）
    if (typeof window.firebaseDB !== 'undefined') {
        syncChecklistToFirebase();
        syncItemsToFirebase();
    }
    
    alert('List saved successfully!');
    console.log('List saved to local storage and Firebase');
}

// 其他輔助函數
function updateAllCheckboxStates() {}
function renderItemsFromFirebase() {}

console.log('Script loaded successfully');
