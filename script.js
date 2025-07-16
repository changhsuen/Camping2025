// script.js - 使用現代 Firebase API
let personCheckedItems = {};
let isInitialLoad = true;

// 等待 Firebase 準備就緒
window.addEventListener('firebaseReady', function() {
    console.log('Firebase is ready!');
    updateSyncStatus('connected', 'Connected');
    initializeFirebaseListeners();
});

// 當文檔載入完成後執行初始化
document.addEventListener("DOMContentLoaded", function () {
    updateSyncStatus('connecting', 'Connecting...');
    
    // 延遲一點以確保 Firebase 配置已載入
    setTimeout(() => {
        loadList();
        
        document.getElementById("add-unified-item").addEventListener("click", addUnifiedItem);
        
        const unifiedInputs = document.querySelectorAll('.add-item-form input[type="text"]');
        unifiedInputs.forEach((input) => {
            input.addEventListener("keypress", function (e) {
                if (e.key === "Enter") {
                    addUnifiedItem();
                }
            });
        });
    }, 1000);
});

// 更新同步狀態顯示
function updateSyncStatus(status, text) {
    const syncStatus = document.getElementById('sync-status');
    const syncText = document.getElementById('sync-text');
    
    if (syncStatus && syncText) {
        syncStatus.className = `sync-status ${status}`;
        syncText.textContent = text;
    }
}

// 初始化 Firebase 監聽器
function initializeFirebaseListeners() {
    if (typeof window.firebaseDB === 'undefined') {
        console.log('Firebase not available, using local storage');
        updateSyncStatus('offline', 'Offline mode');
        return;
    }

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
}

// 同步勾選狀態到 Firebase
function syncChecklistToFirebase() {
    if (typeof window.firebaseDB === 'undefined') {
        return;
    }

    const checklistRef = window.firebaseRef('checklist');
    window.firebaseSet(checklistRef, {
        personChecked: personCheckedItems,
        lastUpdated: new Date().toISOString()
    });
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
        const categoryId = categoryList.id;
        items[categoryId] = [];

        category.querySelectorAll('.item').forEach(item => {
            const checkbox = item.querySelector('input[type="checkbox"]');
            const nameSpan = item.querySelector('.item-name');
            const quantitySpan = item.querySelector('.item-quantity');
            const personTags = item.querySelectorAll('.person-tag');

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

    const itemsRef = window.firebaseRef('items');
    window.firebaseSet(itemsRef, items);
}

// 從 Firebase 渲染項目
function renderItemsFromFirebase(itemsData) {
    // 清空現有項目
    document.querySelectorAll('.item-list').forEach(list => {
        list.innerHTML = '';
    });

    // 渲染項目
    Object.keys(itemsData).forEach(categoryId => {
        const list = document.getElementById(categoryId);
        if (list && itemsData[categoryId]) {
            itemsData[categoryId].forEach(item => {
                createItemElement(list, item);
            });
        }
    });

    updateProgress();
    createPersonFilters();
}

// 創建項目元素
function createItemElement(list, item) {
    const customCheckbox = document.createElement('div');
    customCheckbox.className = 'custom-checkbox';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = item.id;

    const currentPerson = getCurrentFilterPerson();
    checkbox.checked = personCheckedItems[currentPerson] && personCheckedItems[currentPerson][item.id] === true;

    const checkboxLabel = document.createElement('label');
    checkboxLabel.className = 'checkbox-label';
    checkboxLabel.setAttribute('for', item.id);

    customCheckbox.appendChild(checkbox);
    customCheckbox.appendChild(checkboxLabel);

    const li = document.createElement('li');
    li.className = 'item';
    li.dataset.person = item.personData;

    const itemLabel = document.createElement('label');
    itemLabel.className = 'item-label';
    itemLabel.setAttribute('for', item.id);

    if (checkbox.checked) {
        itemLabel.classList.add('checked');
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

    checkbox.addEventListener('change', function () {
        handleCheckboxChange(this);
    });

    li.appendChild(customCheckbox);
    li.appendChild(itemLabel);
    li.appendChild(deleteBtn);
    list.appendChild(li);
}

// 處理勾選框變化
function handleCheckboxChange(checkbox) {
    const currentPerson = getCurrentFilterPerson();
    const itemId = checkbox.id;
    const item = checkbox.closest('.item');

    if (checkbox.checked) {
        personCheckedItems[currentPerson][itemId] = true;

        const parentCategory = getParentCategory(item);
        if (parentCategory === 'shared-items') {
            const responsiblePersons = item.dataset.person.split(',').map(p => p.trim());
            const realPersons = responsiblePersons.filter(p => p !== 'All');

            if (realPersons.length > 0) {
                const allResponsibleChecked = realPersons.every(person => 
                    personCheckedItems[person] && personCheckedItems[person][itemId]
                );

                if (allResponsibleChecked) {
                    personCheckedItems['all'][itemId] = true;
                }
            }
        }
    } else {
        delete personCheckedItems[currentPerson][itemId];

        const parentCategory = getParentCategory(item);
        if (parentCategory === 'shared-items') {
            delete personCheckedItems['all'][itemId];
        }
    }

    updateItemStatus(checkbox);
    updateProgress();
    
    // 同步到 Firebase
    syncChecklistToFirebase();
}

// 添加統一項目
function addUnifiedItem() {
    const categorySelect = document.getElementById('category-select');
    const nameInput = document.getElementById('new-item-name');
    const quantityInput = document.getElementById('new-item-quantity');
    const personInput = document.getElementById('new-item-person');

    const category = categorySelect.value.trim();
    const name = nameInput.value.trim();
    const quantity = quantityInput.value.trim();
    const persons = personInput.value.trim();

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
    quantityInput.value = '';
    personInput.value = '';
    
    // 同步到 Firebase
    syncItemsToFirebase();
}

// 添加新項目到指定列表
function addNewItem(listId, name, quantity, persons) {
    if (name) {
        const list = document.getElementById(listId);
        const id = `item-${Date.now()}`;
        
        const item = {
            id: id,
            name: name,
            quantity: quantity,
            persons: persons,
            personData: persons
        };
        
        createItemElement(list, item);
        updateProgress();
        createPersonFilters();

        if (persons) {
            const personsList = persons.split(',');
            personsList.forEach(person => {
                const trimmedPerson = person.trim();
                if (trimmedPerson && !personCheckedItems[trimmedPerson]) {
                    personCheckedItems[trimmedPerson] = {};
                }
            });
        }
    }
}

// 創建人員篩選器
function createPersonFilters() {
    const personFilter = document.getElementById('person-filter');
    personFilter.innerHTML = '<button class="filter-btn active" data-person="all">All</button>';

    const defaultPersons = ['Milli', 'Shawn', 'Henry', 'Peggy', 'Jin', 'Tee', 'Alex'];
    const commonTags = ['All'];

    const itemPersons = new Set(defaultPersons);
    document.querySelectorAll('.item').forEach(item => {
        const persons = item.dataset.person.split(',');
        persons.forEach(person => {
            const trimmedPerson = person.trim();
            if (trimmedPerson && trimmedPerson !== 'Tag') {
                itemPersons.add(trimmedPerson);
            }
        });
    });

    itemPersons.forEach(person => {
        if (person && person !== 'all' && person !== 'Tag' && !commonTags.includes(person)) {
            const button = document.createElement('button');
            button.className = 'filter-btn';
            button.textContent = person;
            button.dataset.person = person;
            personFilter.appendChild(button);
        }
    });

    setupFilterButtons();

    itemPersons.forEach(person => {
        if (!personCheckedItems[person]) {
            personCheckedItems[person] = {};
        }
    });
}

// 設置篩選按鈕
function setupFilterButtons() {
    const filterButtons = document.querySelectorAll('.filter-btn');
    filterButtons.forEach(button => {
        button.addEventListener('click', function () {
            const person = this.dataset.person;
            filterItems(person);
            document.querySelectorAll('.filter-btn').forEach(btn => {
                btn.classList.remove('active');
            });
            this.classList.add('active');
            updateCheckboxStates();
        });
    });
}

// 篩選項目
function filterItems(person) {
    const items = document.querySelectorAll('.item');
    const commonTags = ['All'];

    items.forEach(item => {
        if (person === 'all') {
            item.style.display = '';
        } else {
            const itemPersons = item.dataset.person.split(',').map(p => p.trim());
            if (itemPersons.includes(person) || itemPersons.some(p => commonTags.includes(p))) {
                item.style.display = '';
            } else {
                item.style.display = 'none';
            }
        }
    });
}

// 更新勾選框狀態
function updateCheckboxStates() {
    updateAllCheckboxStates();
    updateProgress();
}

// 更新所有勾選框狀態
function updateAllCheckboxStates() {
    const checkboxes = document.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
        const currentPerson = getCurrentFilterPerson();
        const itemId = checkbox.id;
        const item = checkbox.closest('.item');

        if (currentPerson === 'all') {
            const parentCategory = getParentCategory(item);
            if (parentCategory === 'shared-items') {
                checkbox.checked = personCheckedItems[currentPerson][itemId] === true;
            } else {
                const itemPersons = item.dataset.person.split(',').map(p => p.trim());
                if (itemPersons.includes('All')) {
                    checkbox.checked = personCheckedItems[currentPerson][itemId] === true;
                } else {
                    checkbox.checked = false;
                }
            }
        } else {
            checkbox.checked = personCheckedItems[currentPerson][itemId] === true;
        }

        updateItemStatus(checkbox);
    });
}

// 刪除項目
function deleteItem(itemElement) {
    if (confirm('Are you sure you want to delete this item?')) {
        const itemId = itemElement.querySelector('input[type="checkbox"]').id;
        for (let person in personCheckedItems) {
            delete personCheckedItems[person][itemId];
        }

        itemElement.remove();
        updateProgress();
        createPersonFilters();
        
        // 同步到 Firebase
        syncChecklistToFirebase();
        syncItemsToFirebase();
    }
}

// 保存清單
function saveList() {
    const categories = document.querySelectorAll('.category-section');
    const savedData = {
        categories: {},
        personChecked: personCheckedItems,
    };

    categories.forEach(category => {
        const categoryList = category.querySelector('.item-list');
        const categoryId = categoryList.id;
        const categoryTitle = category.querySelector('.category-title').textContent;
        const items = [];

        category.querySelectorAll('.item').forEach(item => {
            const checkbox = item.querySelector('input[type="checkbox"]');
            const nameSpan = item.querySelector('.item-name');
            const quantitySpan = item.querySelector('.item-quantity');
            const personTags = item.querySelectorAll('.person-tag');

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
    
    // 同步到 Firebase
    syncChecklistToFirebase();
    syncItemsToFirebase();
    
    alert('List saved successfully!');
}

// 載入清單
async function loadList() {
    if (typeof window.firebaseDB !== 'undefined') {
        // 嘗試從 Firebase 載入
        const itemsRef = window.firebaseRef('items');
        const checklistRef = window.firebaseRef('checklist');
        
        try {
            // 載入項目
            window.firebaseOnValue(itemsRef, (snapshot) => {
                const itemsData = snapshot.val();
                if (itemsData) {
                    renderItemsFromFirebase(itemsData);
                } else {
                    loadDefaultItems();
                }
            });

            // 載入勾選狀態
            window.firebaseOnValue(checklistRef, (snapshot) => {
                const data = snapshot.val();
                if (data && data.personChecked) {
                    personCheckedItems = data.personChecked;
                } else {
                    initializePersonCheckedItems();
                }
                updateAllCheckboxStates();
                updateProgress();
                isInitialLoad = false;
            });
            
            return;
        } catch (error) {
            console.error('Error loading from Firebase:', error);
            updateSyncStatus('offline', 'Connection error');
        }
    }
    
    // 降級到本地儲存
    const savedData = localStorage.getItem('campingChecklist2025');
    if (savedData) {
        renderSavedItems(JSON.parse(savedData));
    } else {
        loadDefaultItems();
    }
    
    isInitialLoad = false;
}

// 載入預設項目
async function loadDefaultItems() {
    try {
        const response = await fetch('defaultItems.json');
        if (response.ok) {
            const defaultData = await response.json();
            renderSavedItems(defaultData);
            // 初次載入時同步到 Firebase
            if (typeof window.firebaseDB !== 'undefined') {
                syncItemsToFirebase();
                syncChecklistToFirebase();
            }
        } else {
            console.error('Cannot load default items');
            initializePerson
