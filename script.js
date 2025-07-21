// script.js - 基於可工作版本，只修改 All 頁面顯示狀態指示器
let personCheckedItems = {};
let isInitialLoad = true;
let hasLoadedDefaultItems = false;

// ============================================
// 初始化函數
// ============================================

document.addEventListener("DOMContentLoaded", function () {
  console.log("DOM loaded, starting initialization...");

  initializeBasicFunctions();
  loadDefaultItems();

  // 延遲檢查 Firebase 狀態
  setTimeout(() => {
    if (typeof window.firebaseDB !== "undefined") {
      console.log("Firebase available, initializing...");
      initializeFirebaseListeners();
    } else {
      console.log("Firebase not available, using local mode");
    }
  }, 2000);
});

function initializeBasicFunctions() {
  console.log("Initializing basic functions...");

  initializePersonCheckedItems();

  const addBtn = document.getElementById("add-unified-item");
  if (addBtn) {
    console.log("Add button found, setting up event listener");
    addBtn.addEventListener("click", addUnifiedItem);
  } else {
    console.error("Add button not found!");
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
  const defaultPersons = ["Milli", "Shawn", "Henry", "Peggy", "Jin", "Tee", "Alex"];
  defaultPersons.forEach((person) => {
    personCheckedItems[person] = {};
  });
  personCheckedItems["All"] = {};
}

// ============================================
// 狀態指示器相關函數（新增）
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

window.addEventListener("firebaseReady", function () {
  console.log("Firebase is ready!");
  if (hasLoadedDefaultItems) {
    initializeFirebaseListeners();
  }
});

function initializeFirebaseListeners() {
  if (typeof window.firebaseDB === "undefined") {
    console.log("Firebase not available, staying in local mode");
    return;
  }

  try {
    const checklistRef = window.firebaseRef("checklist");
    window.firebaseOnValue(checklistRef, (snapshot) => {
      const data = snapshot.val();
      if (data && data.personChecked) {
        console.log("Syncing checklist from Firebase");
        personCheckedItems = data.personChecked;
        updateAllCheckboxStates();
        updateStatusIndicators(); // 更新狀態指示器
        updateProgress();
      } else {
        console.log("No checklist data in Firebase, keeping local state");
        if (Object.keys(personCheckedItems).length > 1) {
          syncChecklistToFirebase();
        }
      }
    });

    const itemsRef = window.firebaseRef("items");
    window.firebaseOnValue(itemsRef, (snapshot) => {
      const data = snapshot.val();
      if (data && Object.keys(data).length > 0) {
        console.log("Loading items from Firebase");
        renderItemsFromFirebase(data);
      } else {
        console.log("No items in Firebase, syncing current items");
        const currentItems = getCurrentItemsData();
        if (currentItems && Object.keys(currentItems).length > 0) {
          syncItemsToFirebase();
        }
      }
    });
  } catch (error) {
    console.error("Error setting up Firebase listeners:", error);
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

        if (!checkbox || !nameSpan) return;

        const persons = Array.from(personTags)
          .map((tag) => tag.textContent)
          .join(",");

        items[categoryId].push({
          id: checkbox.id,
          name: nameSpan.textContent,
          quantity: quantitySpan ? quantitySpan.textContent.replace("x", "") : "",
          persons: persons,
          personData: item.dataset.person,
        });
      });
    }
  });

  return items;
}

function syncChecklistToFirebase() {
  if (typeof window.firebaseDB === "undefined") {
    return;
  }

  try {
    const checklistRef = window.firebaseRef("checklist");
    window.firebaseSet(checklistRef, {
      personChecked: personCheckedItems,
      lastUpdated: new Date().toISOString(),
    });
    console.log("Synced checklist to Firebase");
  } catch (error) {
    console.error("Error syncing checklist to Firebase:", error);
  }
}

function syncItemsToFirebase() {
  if (typeof window.firebaseDB === "undefined") {
    return;
  }

  const items = getCurrentItemsData();

  try {
    const itemsRef = window.firebaseRef("items");
    window.firebaseSet(itemsRef, items);
    console.log("Items synced to Firebase");
  } catch (error) {
    console.error("Error syncing items to Firebase:", error);
  }
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
  updateStatusIndicators(); // 更新狀態指示器
  console.log("Items from Firebase rendered successfully");
}

// ============================================
// 資料載入函數
// ============================================

async function loadDefaultItems() {
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
    },
    personChecked: {
      all: {},
      Milli: {},
      Shawn: {},
      Henry: {},
      Peggy: {},
      Jin: {},
      Tee: {},
      Alex: {},
      All: {},
    },
  };

  renderSavedItems(defaultData);
  hasLoadedDefaultItems = true;
  isInitialLoad = false;
}

function renderSavedItems(data) {
  console.log("Rendering items...", data);

  document.querySelectorAll(".item-list").forEach((list) => {
    list.innerHTML = "";
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
      categoriesData[categoryId].items.forEach((item) => {
        createItemElement(list, item);
      });
    } else {
      console.log(`No list found for ${categoryId} or no items`);
    }
  }

  updateProgress();
  createPersonFilters();
  updateStatusIndicators(); // 更新狀態指示器
  console.log("Items rendered successfully");
}

// ============================================
// UI 元素創建函數 - 修改版本，All頁面顯示狀態指示器
// ============================================

function createItemElement(list, item) {
  console.log("Creating item element:", item.name);

  const li = document.createElement("li");
  li.className = "item";
  li.dataset.person = item.personData;

  const currentPerson = getCurrentFilterPerson();
  const isAllPage = currentPerson === 'all';

  if (isAllPage) {
    // All 頁面：顯示狀態指示器
    const responsiblePersons = (item.persons || item.personData || 'All').split(',').map(p => p.trim());
    const statusContainer = createStatusIndicator(item.id, responsiblePersons);
    li.appendChild(statusContainer);
  } else {
    // 個人頁面：顯示原有的 checkbox
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

    checkbox.addEventListener("change", function () {
      handleCheckboxChange(this);
    });

    li.appendChild(customCheckbox);
  }

  const itemLabel = document.createElement("label");
  itemLabel.className = "item-label";
  
  // 只有非 All 頁面才設置 for 屬性
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
  item
