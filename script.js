// script.js - 修復 Firebase 和保存功能
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
// Firebase Key 清理函數 - 修復 Firebase 錯誤
// ============================================
function sanitizeFirebaseKey(key) {
    // Firebase 不允許這些字符: . $ # [ ] / 
    // 將不允許的字符替換成下劃線
    return key.toString().replace(/[.$#[\]/]/g, '_');
}

function sanitizePersonCheckedForFirebase(personChecked) {
    const sanitized = {};
    for (const person in personChecked) {
        const sanitizedPerson = sanitizeFirebaseKey(person);
        sanitized[sanitizedPerson] = {};
        
        for (const itemId in personChecked[person]) {
            const sanitizedItemId = sanitizeFirebaseKey(itemId);
            sanitized[sanitizedPerson][sanitizedItemId] = personChecked[person][itemId];
        }
    }
    return sanitized;
}

function sanitizeItemsForFirebase(items) {
    const sanitized = {};
    for (const categoryId in items) {
        const sanitizedCategoryId = sanitizeFirebaseKey(categoryId);
        sanitized[sanitizedCategoryId] = [];
        
        if (Array.isArray(items[categoryId])) {
            items[categoryId].forEach(item => {
                sanitized[sanitizedCategoryId].push({
                    ...item,
                    id: sanitizeFirebaseKey(item.id)
                });
            });
        }
    }
    return sanitized;
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
    const statusContainer = document.createElement('div');
    statusContainer.className = 'status-container';
    
    const statusIndicator = document.createElement('div');
    statusIndicator.className = 'status-indicator';
    
    const statusClass = getStatusClass(itemId, responsiblePersons);
    statusContainer.classList.add(statusClass);
    statusContainer.appendChild(statusIndicator);
    
    return statusContainer;
}

function updateStatusIndicators() {
    const items = document.querySelectorAll('.item');
    
    items.forEach((item, index) => {
        const statusContainer = item.querySelector('.status-container');
        if (statusContainer) {
            const itemId = item.querySelector('input[type="checkbox"]')?.id || 
                          item.querySelector('.item-name')?.textContent.replace(/\s+/g, '-').toLowerCase() || 
                          `item-${index}`;
            
            const responsiblePersons = item.dataset.person ? 
                item.dataset.person.split(',').map(p => p.trim()) : ['All'];
            
            const newStatusClass = getStatusClass(itemId, responsiblePersons);
            
            statusContainer.classList.remove('status-none', 'status-partial', 'status-complete');
            statusContainer.classList.add(newStatusClass);
        }
    });
}

// ============================================
// Firebase 相關函數
// ============================================

window.addEventListener('firebaseReady', function() {
    console.log('Firebase is ready!');
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
            }
        });

        const itemsRef = window.firebaseRef('items');
        window.firebaseOnValue(itemsRef, (snapshot) => {
            const data = snapshot.val();
            if (data && Object.keys(data).length > 0) {
                console.log('Loading items from Firebase');
                renderItemsFromFirebase(data);
            }
        });
    } catch (error) {
        console.error('Error setting up Firebase listeners:', error);
    }
}

function syncChecklistToFirebase() {
    if (typeof window.firebaseDB === 'undefined') {
        console.log('Firebase not available, skipping sync');
        return;
    }

    try {
        // 清理數據以符合 Firebase 要求
        const sanitizedData = sanitizePersonCheckedForFirebase(personCheckedItems);
        
        const checklistRef = window.firebaseRef('checklist');
        window.firebaseSet(checklistRef, {
            personChecked: sanitizedData,
            lastUpdated: new Date().toISOString()
        });
        console.log('Successfully synced checklist to Firebase');
    } catch (error) {
        console.error('Error syncing checklist to Firebase:', error);
        // 即使 Firebase 失敗，也要保存到本地
        localStorage.setItem('campingChecklist2025_backup', JSON.stringify({
            personChecked: personCheckedItems,
            lastUpdated: new Date().toISOString()
        }));
        console.log('Saved to localStorage as backup');
    }
}

function syncItemsToFirebase() {
    if (typeof window.firebaseDB === 'undefined') {
        console.log('Firebase not available, skipping items sync');
        return;
    }

    try {
        const items = getCurrentItemsData();
        const sanitizedItems = sanitizeItemsForFirebase(items);

        const itemsRef = window.firebaseRef('items');
        window.firebaseSet(itemsRef, sanitizedItems);
        console.log('Successfully synced items to Firebase');
    } catch (error) {
        console.error('Error syncing items to Firebase:', error);
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

function renderItemsFromFirebase(data) {
    console.log('Rendering items from Firebase...', data);
    
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

    updateProgress();
    createPersonFilters();
    updateStatusIndicators();
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

    renderSavedItems(defaultData);
    hasLoadedDefaultItems = true;
    isInitialLoad = false;
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
            categoriesData[categoryId].items.forEach(item => {
                createItemElement(list, item);
            });
        }
    }

    updateProgress();
    createPersonFilters();
    setTimeout(() => {
        updateStatusIndicators();
    }, 100);
}

// ============================================
// UI 元素創建函數
// ============================================

function createItemElement(list, item) {
    const li = document.createElement('li');
    li.className = 'item';
    li.dataset.person = item.personData || item.persons || 'All';

    const currentPerson = getCurrentFilterPerson();
    const isAllPage = currentPerson === 'all';
    
    if (isAllPage) {
        // All 頁面：使用圓點狀態指示器
        const responsiblePersons = (item.persons || item.personData || 'All').split(',').map(p => p.trim());
        const statusContainer = createStatusIndicator(item.id, responsiblePersons);
        li.appendChild(statusContainer);
        li.style.cursor = 'default';
    } else {
        // 個人頁面：使用 checkbox
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
        itemLabel.style.cursor = 'pointer';
    } else {
        itemLabel.style.cursor = 'default';
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

    const personsToShow = item.persons || item.personData || 'All';
    if (personsToShow) {
        const personsList = personsToShow.split(',');
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
            
            rerenderItemsForCurrentView();
            filterItems(person);
            updateCheckboxStates();
            updateProgress();
        });
    });
}

function rerenderItemsForCurrentView() {
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

    document.querySelectorAll('.item-list').forEach(list => {
        list.innerHTML = '';
    });

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
    syncChecklistToFirebase();
}

function addUnifiedItem() {
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

    addNewItem(listId, name, quantity, persons);

    nameInput.value = '';
    if (quantityInput) quantityInput.value = '';
    if (personInput) personInput.value = '';
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
    
    syncItemsToFirebase();
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
        
        syncChecklistToFirebase();
        syncItemsToFirebase();
    }
}

// ============================================
// 保存功能 - 修復版本
// ============================================
function saveList() {
    console.log('保存功能被調用');
    
    try {
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

        // 保存到本地存儲
        localStorage.setItem('campingChecklist2025', JSON.stringify(savedData));
        console.log('數據已保存到本地存儲');
        
        // 同步到 Firebase
        syncChecklistToFirebase();
        syncItemsToFirebase();
        
        alert('List saved successfully!');
        console.log('List saved to local storage and Firebase');
        
    } catch (error) {
        console.error('保存過程中出錯:', error);
        alert('保存時出現錯誤，請重試');
    }
}

// 確保 saveList 函數可以全局訪問（因為 HTML 中使用 onclick）
window.saveList = saveList;

// ============================================
// 輔助函數
// ============================================

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
