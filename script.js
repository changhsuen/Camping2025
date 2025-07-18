// script.js - 完整修正版，加入狀態指示器功能
let personCheckedItems = {};
let isInitialLoad = true;
let hasLoadedDefaultItems = false;

// ============================================
// 初始化函數
// ============================================

document.addEventListener("DOMContentLoaded", function () {
    console.log('DOM loaded, starting initialization...');
    updateSyncStatus('connecting', '載入中...');
    
    initializeBasicFunctions();
    loadDefaultItems();
    
    // 延遲檢查 Firebase 狀態
    setTimeout(() => {
        if (typeof window.firebaseDB !== 'undefined') {
            console.log('Firebase available, initializing...');
            updateSyncStatus('connected', '已連接');
            initializeFirebaseListeners();
        } else {
            console.log('Firebase not available, using local mode');
            updateSyncStatus('offline', '本地模式');
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

function getStatusClass(itemId, responsiblePersons) {
    const checkedCount = responsiblePersons.filter(person => 
        personCheckedItems[person] && personCheckedItems[person][itemId]
    ).length;
    
    if (checkedCount === 0) return 'status-none';
    if (checkedCount === responsiblePersons.length) return 'status-complete';
    return 'status-partial';
}

function createStatusIndicator(itemId, responsiblePersons) {
    const statusIndicator = document.createElement('div');
    statusIndicator.className = 'status-indicator';
    
    const statusClass = getStatusClass(itemId, responsiblePersons);
    statusIndicator.classList.add(statusClass);
    
    // 添加進度文字
    const checkedCount = responsiblePersons.filter(person => 
        personCheckedItems[person] && personCheckedItems[person][itemId]
    ).length;
    
    const progressText = document.createElement('span');
    progressText.className = 'status-progress';
    progressText.textContent = `${checkedCount}/${responsiblePersons.length}`;
    
    const container = document.createElement('div');
    container.className = 'status-container';
    container.appendChild(statusIndicator);
    container.appendChild(progressText);
    
    return container;
}

function updateStatusIndicators() {
    const items = document.querySelectorAll('.item');
    items.forEach(item => {
        const statusContainer = item.querySelector('.status-container');
        if (statusContainer) {
            const itemId = item.querySelector('input[type="checkbox"]').id;
            const responsiblePersons = item.dataset.person.split(',').map(p => p.trim());
            
            const statusIndicator = statusContainer.querySelector('.status-indicator');
            const progressText = statusContainer.querySelector('.status-progress');
            
            // 更新狀態顏色
            statusIndicator.className = 'status-indicator';
            const statusClass = getStatusClass(itemId, responsiblePersons);
            statusIndicator.classList.add(statusClass);
            
            // 更新進度文字
            const checkedCount = responsiblePersons.filter(person => 
                personCheckedItems[person] && personCheckedItems[person][itemId]
            ).length;
            progressText.textContent = `${checkedCount}/${responsiblePersons.length}`;
        }
    });
}

// ============================================
// Firebase 相關函數
// ============================================

window.addEventListener('firebaseReady', function() {
    console.log('Firebase is ready!');
    updateSyncStatus('connected', '已連接');
    if (hasLoadedDefaultItems) {
        initializeFirebaseListeners();
    }
});

function initializeFirebaseListeners() {
    if (typeof window.firebaseDB === 'undefined') {
        console.log('Firebase not available, staying in local mode');
        return;
    }

    try {
        const checklistRef = window.firebaseRef('checklist');
        window.firebaseOnValue(checklistRef, (snapshot) => {
            const data = snapshot.val();
            if (data && data.personChecked) {
                console.log('Syncing checklist from Firebase');
                personCheckedItems = data.personChecked;
                updateAllCheckboxStates();
                updateStatusIndicators();
                updateProgress();
            } else {
                console.log('No checklist data in Firebase, keeping local state');
                // 如果 Firebase 沒有資料，將本地狀態同步到 Firebase
                if (Object.keys(personCheckedItems).length > 1) { // 不只有 all
                    syncChecklistToFirebase();
                }
            }
        });

        const itemsRef = window.firebaseRef('items');
        window.firebaseOnValue(itemsRef, (snapshot) => {
            const data = snapshot.val();
            if (data && Object.keys(data).length > 0) {
                console.log('Loading items from Firebase');
                renderItemsFromFirebase(data);
            } else {
                console.log('No items in Firebase, syncing current items');
                // 如果 Firebase 沒有項目資料，將當前項目同步到 Firebase
                const currentItems = getCurrentItemsData();
                if (currentItems && Object.keys(currentItems).length > 0) {
                    syncItemsToFirebase();
                }
            }
        });
        
        updateSyncStatus('connected', '已同步');
    } catch (error) {
        console.error('Error setting up Firebase listeners:', error);
        updateSyncStatus('offline', '連接錯誤');
    }
}

function getCurrentItemsData() {
    const items = {};
    
    document.querySelectorAll('.category-section').forEach(category => {
        const categoryList = category.querySelector('.item-list');
        if (!categoryList) return;
        
        const categoryId = categoryList.id;
        const itemElements = category.querySelectorAll('.item');
        
        if (itemElements.length > 0) {
            items[categoryId] = [];

            itemElements.forEach(item => {
                const checkbox = item.querySelector('input[type="checkbox"]');
                const nameSpan = item.querySelector('.item-name');
                const quantitySpan = item.querySelector('.item-quantity');
                const personTags = item.querySelectorAll('.person-tag');

                if (!nameSpan) return;

                const persons = Array.from(personTags)
                    .map(tag => tag.textContent)
                    .join(',');

                // 確保有 ID，如果沒有則生成一個
                const itemId = checkbox ? checkbox.id : `temp-${Date.now()}-${Math.random()}`;

                items[categoryId].push({
                    id: itemId,
                    name: nameSpan.textContent,
                    quantity: quantitySpan ? quantitySpan.textContent.replace('x', '') : '',
                    persons: persons || 'All',
                    personData: item.dataset.person || 'All',
                });
            });
        }
    });
    
    return items;
}

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
        console.log('Synced checklist to Firebase');
    } catch (error) {
        console.error('Error syncing checklist to Firebase:', error);
    }
}

function syncItemsToFirebase() {
    if (typeof window.firebaseDB === 'undefined') {
        return;
    }

    const items = getCurrentItemsData();

    try {
        const itemsRef = window.firebaseRef('items');
        window.firebaseSet(itemsRef, items);
        console.log('Items synced to Firebase');
    } catch (error) {
        console.error('Error syncing items to Firebase:', error);
    }
}

function renderItemsFromFirebase(data) {
    console.log('Rendering items from Firebase...', data);
    
    // 清空現有項目
    document.querySelectorAll('.item-list').forEach(list => {
        list.innerHTML = '';
    });

    // 渲染 Firebase 資料
    for (const categoryId in data) {
        const list = document.getElementById(categoryId);
        if (list && data[categoryId] && Array.isArray(data[categoryId])) {
            console.log(`Rendering ${data[categoryId].length} items for ${categoryId}`);
            data[categoryId].forEach(item => {
                createItemElement(list, item);
            });
        }
    }

    updateProgress();
    createPersonFilters();
    updateStatusIndicators();
    console.log('Items from Firebase rendered successfully');
}

// ============================================
// 資料載入函數
// ============================================

async function loadDefaultItems() {
    console.log('Loading default items...');
    
    const defaultData = {
        "categories": {
            "shared-items": {
                "title": "Shared Gear",
                "items": [
                    { "id": "item-default-1", "name": "Gas stove", "quantity": "", "persons": "Henry,Jin", "personData": "Henry,Jin" },
                    { "id": "item-default-2", "name": "Cookware", "quantity": "", "persons": "Henry,Jin", "personData": "Henry,Jin" },
                    { "id": "item-default-3", "name": "Seasoning", "quantity": "", "persons": "Henry", "personData": "Henry" },
                    { "id": "item-default-4", "name": "Coffee gear", "quantity": "", "persons": "Milli", "personData": "Milli" },
                    { "id": "item-default-5", "name": "Tissue", "quantity": "", "persons": "Peggy", "personData": "Peggy" },
                    { "id": "item-default-6", "name": "Rag", "quantity": "", "persons": "Peggy", "personData": "Peggy" },
                    { "id": "item-default-7", "name": "Ice bucket", "quantity": "", "persons": "Shawn", "personData": "Shawn" },
                    { "id": "item-default-8", "name": "Shovel", "quantity": "", "persons": "Shawn", "personData": "Shawn" },
                    { "id": "item-default-9", "name": "Dishwashing liquid", "quantity": "", "persons": "Tee", "personData": "Tee" },
                    { "id": "item-default-10", "name": "Trash bag", "quantity": "", "persons": "Tee", "personData": "Tee" },
                    { "id": "item-default-11", "name": "Extension cord", "quantity": "", "persons": "Alex", "personData": "Alex" }
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
        const response = await fetch('defaultItems.json');
        if (response.ok) {
            const jsonData = await response.json();
            console.log('Loaded from defaultItems.json');
            renderSavedItems(jsonData);
        } else {
            throw new Error('JSON file not found');
        }
    } catch (error) {
        console.log('JSON file not found, using built-in default data');
        renderSavedItems(defaultData);
    }
    
    hasLoadedDefaultItems = true;
    isInitialLoad = false;
    updateSyncStatus('offline', '準備就緒');
}

function renderSavedItems(data) {
    console.log('Rendering items...', data);
    
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
            console.log(`Rendering ${categoriesData[categoryId].items.length} items for ${categoryId}`);
            categoriesData[categoryId].items.forEach(item => {
                createItemElement(list, item);
            });
        } else {
            console.log(`No list found for ${categoryId} or no items`);
        }
    }

    updateProgress();
    createPersonFilters();
    updateStatusIndicators();
    console.log('Items rendered successfully');
}

// ============================================
// UI 元素創建函數
// ============================================

function createItemElement(list, item) {
    console.log('Creating item element:', item.name);
    
    const li = document.createElement('li');
    li.className = 'item';
    li.dataset.person = item.personData;

    const currentPerson = getCurrentFilterPerson();
    const isAllPage = currentPerson === 'all';
    
    if (isAllPage) {
        // All 頁面：使用狀態指示器
        const responsiblePersons = item.persons.split(',').map(p => p.trim());
        const statusContainer = createStatusIndicator(item.id, responsiblePersons);
        li.appendChild(statusContainer);
    } else {
        // 個人頁面：使用正常的 checkbox
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

        checkbox.addEventListener('change', function () {
            handleCheckboxChange(this);
        });

        li.appendChild(customCheckbox);
    }

    const itemLabel = document.createElement('label');
    itemLabel.className = 'item-label';
    if (!isAllPage) {
        itemLabel.setAttribute('for', item.id);
    }

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

    li.appendChild(itemLabel);
    li.appendChild(deleteBtn);
    list.appendChild(li);
}

function createPersonFilters() {
    const personFilter = document.getElementById('person-filter');
    if (!personFilter) return;
    
    const currentActive = document.querySelector('.filter-btn.active');
    const currentPerson = currentActive ? currentActive.dataset.person : 'all';
    
    personFilter.innerHTML = '<button class="filter-btn" data-person="all">All</button>';

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

    allPersons.forEach(person => {
        if (person && person !== 'all') {
            const button = document.createElement('button');
            button.className = 'filter-btn';
            button.textContent = person;
            button.dataset.person = person;
            personFilter.appendChild(button);
        }
    });

    const buttonToActivate = personFilter.querySelector(`[data-person="${currentPerson}"]`);
    if (buttonToActivate) {
        buttonToActivate.classList.add('active');
    } else {
        personFilter.querySelector('[data-person="all"]').classList.add('active');
    }

    setupFilterButtons();

    allPersons.forEach(person => {
        if (!personCheckedItems[person]) {
            personCheckedItems[person] = {};
        }
    });
}

// ============================================
// 事件處理函數
// ============================================

function setupFilterButtons() {
    const filterButtons = document.querySelectorAll('.filter-btn');
    filterButtons.forEach(button => {
        button.addEventListener('click', function () {
            const person = this.dataset.person;
            
            document.querySelectorAll('.filter-btn').forEach(btn => {
                btn.classList.remove('active');
            });
            this.classList.add('active');
            
            // 重新渲染項目以切換顯示模式
            rerenderItemsForCurrentView();
            
            filterItems(person);
            updateCheckboxStates();
            updateProgress();
        });
    });
}

function renderItemsFromData(data) {
    document.querySelectorAll('.item-list').forEach(list => {
        list.innerHTML = '';
    });

    for (const categoryId in data) {
        const list = document.getElementById(categoryId);
        if (list && data[categoryId] && Array.isArray(data[categoryId])) {
            data[categoryId].forEach(item => {
                createItemElement(list, item);
            });
        }
    }
}

function rerenderItemsForCurrentView() {
    // 獲取當前所有項目的數據
    const allItems = [];
    document.querySelectorAll('.item').forEach(item => {
        const checkbox = item.querySelector('input[type="checkbox"]');
        const nameSpan = item.querySelector('.item-name');
        const quantitySpan = item.querySelector('.item-quantity');
        const personTags = item.querySelectorAll('.person-tag');

        if (nameSpan) {
            const persons = Array.from(personTags)
                .map(tag => tag.textContent)
                .join(',');

            const itemId = checkbox ? checkbox.id : `temp-${Date.now()}-${Math.random()}`;

            allItems.push({
                id: itemId,
                name: nameSpan.textContent,
                quantity: quantitySpan ? quantitySpan.textContent.replace('x', '') : '',
                persons: persons || 'All',
                personData: item.dataset.person || 'All',
                categoryId: item.closest('.item-list').id
            });
        }
    });

    // 清空所有列表
    document.querySelectorAll('.item-list').forEach(list => {
        list.innerHTML = '';
    });

    // 按類別重新渲染
    const itemsByCategory = {};
    allItems.forEach(item => {
        if (!itemsByCategory[item.categoryId]) {
            itemsByCategory[item.categoryId] = [];
        }
        itemsByCategory[item.categoryId].push(item);
    });

    for (const categoryId in itemsByCategory) {
        const list = document.getElementById(categoryId);
        if (list) {
            itemsByCategory[categoryId].forEach(item => {
                createItemElement(list, item);
            });
        }
    }
}

function handleCheckboxChange(checkbox) {
    const currentPerson = getCurrentFilterPerson();
    const itemId = checkbox.id;
    const item = checkbox.closest('.item');
    const itemLabel = item.querySelector('.item-label');

    if (checkbox.checked) {
        itemLabel.classList.add('checked');
        if (!personCheckedItems[currentPerson]) {
            personCheckedItems[currentPerson] = {};
        }
        personCheckedItems[currentPerson][itemId] = true;
    } else {
        itemLabel.classList.remove('checked');
        if (personCheckedItems[currentPerson]) {
            delete personCheckedItems[currentPerson][itemId];
        }
    }
    
    updateProgress();
    updateStatusIndicators();
    
    if (typeof window.firebaseDB !== 'undefined') {
        syncChecklistToFirebase();
    }
}

function addUnifiedItem() {
    console.log('Add item function called');
    
    const categorySelect = document.getElementById('category-select');
    const nameInput = document.getElementById('new-item-name');
    const quantityInput = document.getElementById('new-item-quantity');
    const personInput = document.getElementById('new-item-person');

    if (!categorySelect || !nameInput) {
        console.error('Required input elements not found');
        return;
    }

    const category = categorySelect.value.trim();
    const name = nameInput.value.trim();
    const quantity = quantityInput ? quantityInput.value.trim() : '';
    const persons = personInput ? personInput.value.trim() : '';

    console.log('Form values:', { category, name, quantity, persons });

    if (!category) {
        alert('Please select a category');
        return;
    }

    if (!name) {
        alert('Please enter item name');
        return;
    }

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

    console.log(`Adding to list: ${listId}`);
    addNewItem(listId, name, quantity, persons);

    nameInput.value = '';
    if (quantityInput) quantityInput.value = '';
    if (personInput) personInput.value = '';
    
    console.log(`Successfully added: ${name}`);
}

function addNewItem(listId, name, quantity, persons) {
    if (!name) {
        console.error('No name provided for new item');
        return;
    }
    
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
    
    console.log('Creating new item:', item);
    
    createItemElement(list, item);
    updateProgress();
    createPersonFilters();
    updateStatusIndicators();

    if (persons) {
        const personsList = persons.split(',');
        personsList.forEach(person => {
            const trimmedPerson = person.trim();
            if (trimmedPerson && !personCheckedItems[trimmedPerson]) {
                personCheckedItems[trimmedPerson] = {};
            }
        });
    }
    
    if (typeof window.firebaseDB !== 'undefined') {
        syncItemsToFirebase();
    }
    
    console.log(`Successfully created item: ${name} in ${listId}`);
}

function deleteItem(itemElement) {
    if (confirm('Are you sure you want to delete this item?')) {
        const itemId = itemElement.querySelector('input[type="checkbox"]')?.id;
        if (itemId) {
            for (let person in personCheckedItems) {
                delete personCheckedItems[person][itemId];
            }
        }
        
        itemElement.remove();
        updateProgress();
        createPersonFilters();
        updateStatusIndicators();
        
        if (typeof window.firebaseDB !== 'undefined') {
            syncChecklistToFirebase();
            syncItemsToFirebase();
        }
        
        console.log('Item deleted successfully');
    }
}

function saveList() {
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

            if (!nameSpan) return;

            const persons = Array.from(personTags)
                .map(tag => tag.textContent)
                .join(',');

            // 確保有 ID，如果沒有則生成一個
            const itemId = checkbox ? checkbox.id : `item-${Date.now()}-${Math.random()}`;

            items.push({
                id: itemId,
                name: nameSpan.textContent,
                quantity: quantitySpan ? quantitySpan.textContent.replace('x', '') : '',
                persons: persons || 'All',
                personData: item.dataset.person || 'All',
            });
        });

        savedData.categories[categoryId] = {
            title: categoryTitle,
            items: items,
        };
    });

    localStorage.setItem('campingChecklist2025', JSON.stringify(savedData));
    
    if (typeof window.firebaseDB !== 'undefined') {
        syncChecklistToFirebase();
        syncItemsToFirebase();
    }
    
    alert('List saved successfully!');
    console.log('List saved to local storage and Firebase');
}

// ============================================
// 輔助函數
// ============================================

function updateSyncStatus(status, text) {
    const syncStatus = document.getElementById('sync-status');
    const syncText = document.getElementById('sync-text');
    
    if (syncStatus && syncText) {
        syncStatus.className = `sync-status ${status}`;
        
        // 更清楚的狀態描述
        const statusMessages = {
            'connecting': '正在連接...',
            'connected': '已同步',
            'offline': '本地模式',
            'syncing': '同步中...',
            'error': '同步失敗'
        };
        
        syncText.textContent = statusMessages[status] || text;
        console.log(`Status updated: ${status} - ${statusMessages[status] || text}`);
    }
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

function filterItems(person) {
    const items = document.querySelectorAll('.item');
    
    items.forEach(item => {
        if (person === 'all') {
            item.style.display = '';
        } else {
            const itemPersons = item.dataset.person.split(',').map(p => p.trim());
            
            if (itemPersons.includes(person) || itemPersons.includes('All')) {
                item.style.display = '';
            } else {
                item.style.display = 'none';
            }
        }
    });
    
    console.log(`Filtered for: ${person}`);
}

function getCurrentFilterPerson() {
    const activeButton = document.querySelector('.filter-btn.active');
    return activeButton ? activeButton.dataset.person : 'all';
}

function updateCheckboxStates() {
    const currentPerson = getCurrentFilterPerson();
    const checkboxes = document.querySelectorAll('input[type="checkbox"]');

    checkboxes.forEach(checkbox => {
        const itemId = checkbox.id;
        const item = checkbox.closest('.item');
        const itemLabel = item.querySelector('.item-label');

        const isChecked = personCheckedItems[currentPerson] && personCheckedItems[currentPerson][itemId] === true;
        
        checkbox.checked = isChecked;
        
        if (isChecked) {
            itemLabel.classList.add('checked');
        } else {
            itemLabel.classList.remove('checked');
        }
    });
}

function updateAllCheckboxStates() {
    updateCheckboxStates();
}

console.log('Script loaded successfully');
