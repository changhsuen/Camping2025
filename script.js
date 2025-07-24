// script.js - 完整修復版本
let personCheckedItems = {};
let isInitialLoad = true;
let hasLoadedDefaultItems = false;
let firebaseInitialized = false;

// ============================================
// 初始化函數
// ============================================

document.addEventListener("DOMContentLoaded", function () {
  console.log("DOM loaded, starting initialization...");
  
  initializeBasicFunctions();
  loadDefaultItems();
  
  // 使用事件委託來處理動態生成的元素
  setupEventDelegation();
  
  // 等待 Firebase 初始化
  waitForFirebase();
});

function waitForFirebase() {
  let attempts = 0;
  const maxAttempts = 10;
  
  const checkFirebase = () => {
    attempts++;
    if (typeof window.firebaseDB !== "undefined") {
      console.log("Firebase available, initializing...");
      firebaseInitialized = true;
      initializeFirebaseListeners();
    } else if (attempts < maxAttempts) {
      console.log(`Firebase not ready, attempt ${attempts}/${maxAttempts}`);
      setTimeout(checkFirebase, 1000);
    } else {
      console.log("Firebase not available after max attempts, using local mode");
    }
  };
  
  checkFirebase();
}

function setupEventDelegation() {
  // 使用事件委託處理 checkbox 變化
  document.addEventListener('change', function(e) {
    if (e.target.type === 'checkbox' && e.target.closest('.item')) {
      handleCheckboxChange(e.target);
    }
  });
  
  // 使用事件委託處理刪除按鈕
  document.addEventListener('click', function(e) {
    if (e.target.classList.contains('delete-btn')) {
      e.preventDefault();
      e.stopPropagation();
      const item = e.target.closest('.item');
      if (item) deleteItem(item);
    }
  });
}

function initializeBasicFunctions() {
  console.log("Initializing basic functions...");

  initializePersonCheckedItems();

  const addBtn = document.getElementById("add-unified-item");
  if (addBtn) {
    console.log("Add button found, setting up event listener");
    addBtn.addEventListener("click", addUnifiedItem);
  }

  const inputs = document.querySelectorAll('.add-item-form input[type="text"]');
  inputs.forEach((input) => {
    input.addEventListener("keypress", function (e) {
      if (e.key === "Enter") {
        addUnifiedItem();
      }
    });
  });
}

function initializePersonCheckedItems() {
  if (Object.keys(personCheckedItems).length === 0) {
    personCheckedItems = { all: {} };
    const defaultPersons = ["Milli", "Shawn", "Henry", "Peggy", "Jin", "Tee", "Alex"];
    defaultPersons.forEach((person) => {
      personCheckedItems[person] = {};
    });
    personCheckedItems["All"] = {};
    console.log("Initialized personCheckedItems");
  }
}

// ============================================
// Firebase 安全處理函數
// ============================================

function sanitizeFirebaseKey(key) {
  return key.replace(/[.$#[\]/]/g, '_');
}

function generateSafeId(prefix = 'item') {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100)}`;
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

function initializeFirebaseListeners() {
  if (!firebaseInitialized || typeof window.firebaseDB === "undefined") {
    console.log("Firebase not ready for listeners");
    return;
  }

  try {
    // 只在初始化時同步一次，避免循環
    const checklistRef = window.firebaseRef("checklist");
    window.firebaseOnValue(checklistRef, (snapshot) => {
      const data = snapshot.val();
      if (data && data.personChecked && !isInitialLoad) {
        console.log("Syncing checklist from Firebase (not initial load)");
        mergePersonCheckedItems(data.personChecked);
        updateAllCheckboxStates();
        updateStatusIndicators();
        updateProgress();
      }
    });

    // 項目監聽器只在沒有本地項目時觸發
    const itemsRef = window.firebaseRef("items");
    window.firebaseOnValue(itemsRef, (snapshot) => {
      const data = snapshot.val();
      const hasLocalItems = document.querySelectorAll('.item').length > 0;
      
      if (data && Object.keys(data).length > 0 && !hasLocalItems) {
        console.log("Loading items from Firebase");
        renderItemsFromFirebase(data);
      }
    });
    
    // 初始同步
    if (hasLoadedDefaultItems) {
      setTimeout(() => {
        syncToFirebase();
      }, 1000);
    }
  } catch (error) {
    console.error("Error setting up Firebase listeners:", error);
  }
}

function mergePersonCheckedItems(firebaseData) {
  for (const person in firebaseData) {
    if (!personCheckedItems[person]) {
      personCheckedItems[person] = {};
    }
    Object.assign(personCheckedItems[person], firebaseData[person]);
  }
}

function syncToFirebase() {
  if (!firebaseInitialized) return;
  
  syncChecklistToFirebase();
  syncItemsToFirebase();
}

function syncChecklistToFirebase() {
  if (!firebaseInitialized) return;

  try {
    const sanitizedData = {};
    for (const person in personCheckedItems) {
      sanitizedData[sanitizeFirebaseKey(person)] = {};
      for (const itemId in personCheckedItems[person]) {
        const sanitizedItemId = sanitizeFirebaseKey(itemId);
        sanitizedData[sanitizeFirebaseKey(person)][sanitizedItemId] = personCheckedItems[person][itemId];
      }
    }

    const checklistRef = window.firebaseRef("checklist");
    window.firebaseSet(checklistRef, {
      personChecked: sanitizedData,
      lastUpdated: new Date().toISOString(),
    });
    console.log("Synced checklist to Firebase");
  } catch (error) {
    console.error("Error syncing checklist to Firebase:", error);
  }
}

function syncItemsToFirebase() {
  if (!firebaseInitialized) return;

  const items = getCurrentItemsData();

  try {
    const itemsRef = window.firebaseRef("items");
    window.firebaseSet(itemsRef, items);
    console.log("Items synced to Firebase");
  } catch (error) {
    console.error("Error syncing items to Firebase:", error);
  }
}

function getCurrentItemsData() {
  const items = {};

  document.querySelectorAll(".category-section").forEach((category) => {
    const categoryList = category.querySelector(".item-list");
    if (!categoryList) return;

    const categoryId = categoryList.id;
    const itemElements = category.querySelectorAll(".item");

    if (itemElements.length > 0) {
      items[categoryId] = [];

      itemElements.forEach((item) => {
        const checkbox = item.querySelector('input[type="checkbox"]');
        const nameSpan = item.querySelector(".item-name");
        const quantitySpan = item.querySelector(".item-quantity");
        const personTags = item.querySelectorAll(".person-tag");

        if (!nameSpan) return;

        const persons = Array.from(personTags)
          .map((tag) => tag.textContent)
          .join(",");

        const itemId = checkbox ? checkbox.id : generateSafeId('temp');

        items[categoryId].push({
          id: itemId,
          name: nameSpan.textContent,
          quantity: quantitySpan ? quantitySpan.textContent.replace("x", "") : "",
          persons: persons || 'All',
          personData: item.dataset.person || 'All',
        });
      });
    }
  });

  return items;
}

function renderItemsFromFirebase(data) {
  console.log("Rendering items from Firebase...", data);

  document.querySelectorAll(".item-list").forEach((list) => {
    list.innerHTML = "";
  });

  for (const categoryId in data) {
    const list = document.getElementById(categoryId);
    if (list && data[categoryId] && Array.isArray(data[categoryId])) {
      console.log(`Rendering ${data[categoryId].length} items for ${categoryId}`);
      data[categoryId].forEach((item) => {
        createItemElement(list, item);
      });
    }
  }

  updateProgress();
  createPersonFilters();
  updateStatusIndicators();
  console.log("Items from Firebase rendered successfully");
}

// ============================================
// 資料載入函數
// ============================================

function loadDefaultItems() {
  console.log("Loading default items...");

  const defaultData = {
    categories: {
      "shared-items": {
        title: "Shared Gear",
        items: [
          { id: "item-default-1", name: "Gas stove", quantity: "", persons: "Henry,Jin", personData: "Henry,Jin" },
          { id: "item-default-2", name: "Cookware", quantity: "", persons: "Henry,Jin", personData: "Henry,Jin" },
          { id: "item-default-3", name: "Seasoning", quantity: "", persons: "Henry", personData: "Henry" },
          { id: "item-default-4", name: "Coffee gear", quantity: "", persons: "Milli", personData: "Milli" },
          { id: "item-default-5", name: "Tissue", quantity: "", persons: "Peggy", personData: "Peggy" },
          { id: "item-default-6", name: "Rag", quantity: "", persons: "Peggy", personData: "Peggy" },
          { id: "item-default-7", name: "Ice bucket", quantity: "", persons: "Shawn", personData: "Shawn" },
          { id: "item-default-8", name: "Shovel", quantity: "", persons: "Shawn", personData: "Shawn" },
          { id: "item-default-9", name: "Dishwashing liquid", quantity: "", persons: "Tee", personData: "Tee" },
          { id: "item-default-10", name: "Trash bag", quantity: "", persons: "Tee", personData: "Tee" },
          { id: "item-default-11", name: "Extension cord", quantity: "", persons: "Alex", personData: "Alex" },
        ],
      },
      "personal-items": {
        title: "Personal Gear",
        items: [
          { id: "item-default-12", name: "Sleeping bag", quantity: "", persons: "All", personData: "All" },
          { id: "item-default-13", name: "Clothes", quantity: "", persons: "All", personData: "All" },
          { id: "item-default-14", name: "Rain gear", quantity: "", persons: "All", personData: "All" },
          { id: "item-default-15", name: "Toiletries", quantity: "", persons: "All", personData: "All" },
          { id: "item-default-16", name: "Camera", quantity: "", persons: "Milli", personData: "Milli" },
        ],
      },
    }
  };

  renderSavedItems(defaultData);
  hasLoadedDefaultItems = true;
  
  // 延遲設置 isInitialLoad = false，確保初始化完成
  setTimeout(() => {
    isInitialLoad = false;
    console.log("Initial load completed");
  }, 2000);
  
  if (firebaseInitialized) {
    setTimeout(() => {
      syncToFirebase();
    }, 3000);
  }
}

function renderSavedItems(data) {
  console.log("Rendering items...", data);

  document.querySelectorAll(".item-list").forEach((list) => {
    list.innerHTML = "";
  });

  const categoriesData = data.categories || data;
  for (const categoryId in categoriesData) {
    const list = document.getElementById(categoryId);
    if (list && categoriesData[categoryId].items) {
      console.log(`Rendering ${categoriesData[categoryId].items.length} items for ${categoryId}`);
      categoriesData[categoryId].items.forEach((item) => {
        createItemElement(list, item);
      });
    }
  }

  updateProgress();
  createPersonFilters();
  updateStatusIndicators();
  console.log("Items rendered successfully");
}

// ============================================
// UI 元素創建函數
// ============================================

function createItemElement(list, item) {
  const li = document.createElement("li");
  li.className = "item";
  li.dataset.person = item.personData;

  const currentPerson = getCurrentFilterPerson();
  const isAllPage = currentPerson === 'all';

  if (isAllPage) {
    const responsiblePersons = (item.persons || item.personData || 'All').split(',').map(p => p.trim());
    const statusContainer = createStatusIndicator(item.id, responsiblePersons);
    li.appendChild(statusContainer);
  } else {
    const customCheckbox = document.createElement("div");
    customCheckbox.className = "custom-checkbox";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.id = item.id;

    const checkboxLabel = document.createElement("label");
    checkboxLabel.className = "checkbox-label";
    checkboxLabel.setAttribute("for", item.id);

    customCheckbox.appendChild(checkbox);
    customCheckbox.appendChild(checkboxLabel);
    li.appendChild(customCheckbox);
  }

  const itemLabel = document.createElement("label");
  itemLabel.className = "item-label";
  
  if (!isAllPage) {
    itemLabel.setAttribute("for", item.id);
  }

  const nameSpan = document.createElement("span");
  nameSpan.className = "item-name";
  nameSpan.textContent = item.name;
  itemLabel.appendChild(nameSpan);

  if (item.quantity) {
    const quantitySpan = document.createElement("span");
    quantitySpan.className = "item-quantity";
    quantitySpan.textContent = `x${item.quantity}`;
    itemLabel.appendChild(quantitySpan);
  }

  const personTags = document.createElement("span");
  personTags.className = "person-tags";

  if (item.persons) {
    const personsList = item.persons.split(",");
    personsList.forEach((person) => {
      if (person.trim()) {
        const personTag = document.createElement("span");
        personTag.className = "person-tag";
        personTag.textContent = person.trim();
        personTags.appendChild(personTag);
      }
    });
  }
  itemLabel.appendChild(personTags);

  const deleteBtn = document.createElement("button");
  deleteBtn.className = "delete-btn";
  deleteBtn.innerHTML = "×";
  deleteBtn.title = "Delete item";

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
      if (trimmedPerson && trimmedPerson !== 'All') {
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
    button.replaceWith(button.cloneNode(true));
  });
  
  const newFilterButtons = document.querySelectorAll('.filter-btn');
  newFilterButtons.forEach(button => {
    button.addEventListener('click', function () {
      const person = this.dataset.person;
      
      document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
      });
      this.classList.add('active');
      
      rerenderItemsForCurrentView();
      filterItems(person);
      updateCheckboxStates();
      updateStatusIndicators();
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

      const itemId = checkbox ? checkbox.id : generateSafeId('temp');

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

  console.log(`Checkbox changed: ${itemId}, person: ${currentPerson}, checked: ${checkbox.checked}`);

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
  
  // 減少 Firebase 同步頻率，避免循環
  clearTimeout(window.firebaseSyncTimeout);
  window.firebaseSyncTimeout = setTimeout(() => {
    if (firebaseInitialized && !isInitialLoad) {
      console.log("Syncing checkbox change to Firebase");
      syncChecklistToFirebase();
    }
  }, 2000); // 增加延遲時間
}

function addUnifiedItem() {
  console.log("Add item function called");
  
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

  if (!name) {
    alert('Please enter item name');
    return;
  }

  let listId = category === 'Shared Gear' ? 'shared-items' : 'personal-items';

  addNewItem(listId, name, quantity, persons);

  nameInput.value = '';
  if (quantityInput) quantityInput.value = '';
  if (personInput) personInput.value = '';
}

function addNewItem(listId, name, quantity, persons) {
  const list = document.getElementById(listId);
  if (!list) {
    console.error(`List with id ${listId} not found`);
    return;
  }
  
  const id = generateSafeId('item');
  
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
  
  if (firebaseInitialized) {
    syncItemsToFirebase();
  }
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
    
    if (firebaseInitialized) {
      syncChecklistToFirebase();
      syncItemsToFirebase();
    }
  }
}

// ============================================
// 輔助函數
// ============================================

function updateProgress() {
  const visibleItems = Array.from(document.querySelectorAll('.item')).filter(item => item.style.display !== 'none');
  const total = visibleItems.length;
  let checked = 0;

  const currentPerson = getCurrentFilterPerson();
  
  if (currentPerson === 'all') {
    visibleItems.forEach(item => {
      const statusContainer = item.querySelector('.status-container');
      if (statusContainer && statusContainer.classList.contains('status-complete')) {
        checked++;
      }
    });
  } else {
    visibleItems.forEach(item => {
      const checkbox = item.querySelector('input[type="checkbox"]');
      if (checkbox && checkbox.checked) {
        checked++;
      }
    });
  }

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

// ============================================
// 全域函數
// ============================================

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

      items.push({
        id: checkbox ? checkbox.id : generateSafeId('item'),
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
  
  // 手動同步，不依賴 Firebase 監聽器
  if (firebaseInitialized) {
    console.log("Manual sync to Firebase from saveList");
    syncItemsToFirebase();
    syncChecklistToFirebase();
  }
  
  alert('List saved successfully!');
  console.log('List saved successfully');
}

window.saveList = saveList;

console.log('Fixed script loaded successfully');
