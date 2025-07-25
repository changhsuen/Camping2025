// script.js - 專注即時線上同步的版本 - 修復版
let personCheckedItems = {};
let isInitialLoad = true;
let firebaseInitialized = false;

// ============================================
// 初始化
// ============================================

document.addEventListener("DOMContentLoaded", function () {
  console.log("🚀 應用程式啟動中...");

  initializeBasicFunctions();
  setupEventDelegation();

  // 等待 Firebase 並載入資料
  waitForFirebase();
});

function waitForFirebase() {
  let attempts = 0;
  const maxAttempts = 10;

  const checkFirebase = () => {
    attempts++;
    if (typeof window.firebaseDB !== "undefined") {
      console.log("🔥 Firebase 連接成功！");
      firebaseInitialized = true;
      initializeApp();
    } else if (attempts < maxAttempts) {
      console.log(`⏳ 等待 Firebase... (${attempts}/${maxAttempts})`);
      setTimeout(checkFirebase, 1000);
    } else {
      console.log("❌ Firebase 連接失敗，載入預設資料");
      loadDefaultItems(); // 離線模式
    }
  };

  checkFirebase();
}

function initializeApp() {
  // 設置即時監聽器
  setupRealtimeListeners();

  // 檢查是否有線上資料
  loadFromFirebase();
}

function initializeBasicFunctions() {
  initializePersonCheckedItems();

  const addBtn = document.getElementById("add-unified-item");
  if (addBtn) {
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

function setupEventDelegation() {
  // checkbox 變化
  document.addEventListener("change", function (e) {
    if (e.target.type === "checkbox" && e.target.closest(".item")) {
      handleCheckboxChange(e.target);
    }
  });

  // 刪除按鈕
  document.addEventListener("click", function (e) {
    if (e.target.classList.contains("delete-btn")) {
      e.preventDefault();
      e.stopPropagation();
      const item = e.target.closest(".item");
      if (item) deleteItem(item);
    }
  });

  // 新增：Remove Person 按鈕
  document.addEventListener("click", function (e) {
    if (e.target.classList.contains("remove-person-btn")) {
      e.preventDefault();
      e.stopPropagation();
      const currentPerson = getCurrentFilterPerson();
      if (currentPerson && currentPerson !== "all") {
        removePerson(currentPerson);
      }
    }
  });
}

function initializePersonCheckedItems() {
  personCheckedItems = { all: {} };
  const defaultPersons = ["Milli", "Shawn", "Henry", "Peggy", "Jin", "Tee", "Alex", "All"];
  defaultPersons.forEach((person) => {
    personCheckedItems[person] = {};
  });
}

// ============================================
// Firebase 即時同步 - 核心功能（移除勾選提示）
// ============================================

function setupRealtimeListeners() {
  if (!firebaseInitialized) return;

  console.log("👂 設置即時監聽器");

  // 監聽勾選狀態變化 - 移除提示
  const checklistRef = window.firebaseRef("checklist");
  window.firebaseOnValue(checklistRef, (snapshot) => {
    const data = snapshot.val();
    if (data && data.personChecked) {
      // 移除了這行: showUpdateNotification("有人更新了勾選狀態");
      updatePersonCheckedItems(data.personChecked);
      updateAllUIStates();
    }
  });

  // 監聽項目變化
  const itemsRef = window.firebaseRef("items");
  window.firebaseOnValue(itemsRef, (snapshot) => {
    const data = snapshot.val();
    if (data && Object.keys(data).length > 0) {
      if (!isInitialLoad) {
        console.log("📥 收到即時項目更新");
        showUpdateNotification("有人更新了項目清單");
      }
      renderItemsFromFirebase(data);
    }
  });
}

function loadFromFirebase() {
  if (!firebaseInitialized) return;

  console.log("📡 從 Firebase 載入初始資料");

  // 載入項目
  const itemsRef = window.firebaseRef("items");
  window.firebaseOnValue(
    itemsRef,
    (snapshot) => {
      const data = snapshot.val();
      if (data && Object.keys(data).length > 0) {
        console.log("✅ 載入線上項目資料");
        renderItemsFromFirebase(data);
      } else {
        console.log("📋 沒有線上資料，載入預設項目");
        loadDefaultItems();
      }

      // 完成初始載入
      setTimeout(() => {
        isInitialLoad = false;
        console.log("🎉 初始載入完成");
      }, 1000);
    },
    { once: true }
  );
}

function updatePersonCheckedItems(firebaseData) {
  for (const person in firebaseData) {
    const originalPerson = person.replace(/_/g, ".");

    if (!personCheckedItems[originalPerson]) {
      personCheckedItems[originalPerson] = {};
    }

    // 清空並重新設置該人員的勾選狀態
    personCheckedItems[originalPerson] = {};

    for (const itemId in firebaseData[person]) {
      const originalItemId = itemId.replace(/_/g, ".");
      personCheckedItems[originalPerson][originalItemId] = firebaseData[person][itemId];
    }
  }
}

function renderItemsFromFirebase(data) {
  console.log("🎨 渲染 Firebase 項目資料");

  // 清空現有項目
  document.querySelectorAll(".item-list").forEach((list) => {
    list.innerHTML = "";
  });

  // 渲染新項目
  for (const categoryId in data) {
    if (categoryId.startsWith("item-") || categoryId === "lastUpdated" || categoryId === "updatedBy") {
      continue; // 跳過非分類資料
    }

    const list = document.getElementById(categoryId);
    if (list && data[categoryId] && Array.isArray(data[categoryId])) {
      console.log(`📝 渲染 ${data[categoryId].length} 個項目到 ${categoryId}`);
      data[categoryId].forEach((item) => {
        createItemElement(list, item);
      });
    }
  }

  updateAllUIStates();
}

function updateAllUIStates() {
  updateAllCheckboxStates();
  updateStatusIndicators();
  updateProgress();
  createPersonFilters();
  updateAddItemFormVisibility(); // 新增：控制表單顯示
  updateRemovePersonButton(); // 新增：控制 Remove 按鈕
}

// ============================================
// 即時推送到 Firebase
// ============================================

function pushToFirebase(type, data) {
  if (!firebaseInitialized) {
    console.log("⚠️ Firebase 未連接，無法同步");
    return;
  }

  if (type === "checklist") {
    pushChecklistToFirebase();
  } else if (type === "items") {
    pushItemsToFirebase();
  }
}

function pushChecklistToFirebase() {
  try {
    const sanitizedData = {};
    for (const person in personCheckedItems) {
      const sanitizedPerson = sanitizeFirebaseKey(person);
      sanitizedData[sanitizedPerson] = {};

      for (const itemId in personCheckedItems[person]) {
        const sanitizedItemId = sanitizeFirebaseKey(itemId);
        sanitizedData[sanitizedPerson][sanitizedItemId] = personCheckedItems[person][itemId];
      }
    }

    const checklistRef = window.firebaseRef("checklist");
    window.firebaseSet(checklistRef, {
      personChecked: sanitizedData,
      lastUpdated: new Date().toISOString(),
      updatedBy: getCurrentFilterPerson() || "unknown",
    });

    console.log("📤 勾選狀態已推送到 Firebase");
  } catch (error) {
    console.error("❌ 推送勾選狀態失敗:", error);
  }
}

function pushItemsToFirebase() {
  try {
    const items = getCurrentItemsData();

    const itemsRef = window.firebaseRef("items");
    window.firebaseSet(itemsRef, {
      ...items,
      lastUpdated: new Date().toISOString(),
      updatedBy: getCurrentFilterPerson() || "unknown",
    });

    console.log("📤 項目清單已推送到 Firebase");
  } catch (error) {
    console.error("❌ 推送項目清單失敗:", error);
  }
}

// ============================================
// 用戶操作處理 - 立即同步
// ============================================

function handleCheckboxChange(checkbox) {
  const currentPerson = getCurrentFilterPerson();
  const itemId = checkbox.id;
  const item = checkbox.closest(".item");
  const itemLabel = item.querySelector(".item-label");

  console.log(`✅ ${currentPerson} ${checkbox.checked ? "勾選" : "取消"} ${itemId}`);

  // 立即更新本地狀態
  if (checkbox.checked) {
    itemLabel.classList.add("checked");
    if (!personCheckedItems[currentPerson]) {
      personCheckedItems[currentPerson] = {};
    }
    personCheckedItems[currentPerson][itemId] = true;
  } else {
    itemLabel.classList.remove("checked");
    if (personCheckedItems[currentPerson]) {
      delete personCheckedItems[currentPerson][itemId];
    }
  }

  // 立即更新 UI
  updateProgress();
  updateStatusIndicators();

  // 立即推送到 Firebase
  pushToFirebase("checklist");
}

function addUnifiedItem() {
  const categorySelect = document.getElementById("category-select");
  const nameInput = document.getElementById("new-item-name");
  const quantityInput = document.getElementById("new-item-quantity");
  const personInput = document.getElementById("new-item-person");

  if (!categorySelect || !nameInput) {
    console.error("❌ 找不到必需的輸入欄位");
    return;
  }

  const category = categorySelect.value.trim();
  const name = nameInput.value.trim();
  const quantity = quantityInput ? quantityInput.value.trim() : "";
  const persons = personInput ? personInput.value.trim() : "";

  if (!name) {
    alert("請輸入項目名稱");
    return;
  }

  let listId = category === "Shared Gear" ? "shared-items" : "personal-items";

  console.log(`➕ 新增項目: ${name} 到 ${category}`);

  addNewItem(listId, name, quantity, persons);

  // 清空輸入欄位
  nameInput.value = "";
  if (quantityInput) quantityInput.value = "";
  if (personInput) personInput.value = "";
}

function addNewItem(listId, name, quantity, persons) {
  const list = document.getElementById(listId);
  if (!list) {
    console.error(`❌ 找不到列表: ${listId}`);
    return;
  }

  const id = generateSafeId("item");

  const item = {
    id: id,
    name: name,
    quantity: quantity,
    persons: persons || "All",
    personData: persons || "All",
  };

  // 立即創建 UI 元素
  createItemElement(list, item);
  updateAllUIStates();

  // 初始化新人員
  if (persons) {
    const personsList = persons.split(",");
    personsList.forEach((person) => {
      const trimmedPerson = person.trim();
      if (trimmedPerson && !personCheckedItems[trimmedPerson]) {
        personCheckedItems[trimmedPerson] = {};
      }
    });
  }

  // 立即推送到 Firebase
  pushToFirebase("items");
}

function deleteItem(itemElement) {
  if (confirm("確定要刪除這個項目嗎？")) {
    const itemId = itemElement.querySelector('input[type="checkbox"]')?.id;
    const itemName = itemElement.querySelector(".item-name")?.textContent;

    console.log(`🗑️ 刪除項目: ${itemName}`);

    // 從勾選記錄中移除
    if (itemId) {
      for (let person in personCheckedItems) {
        delete personCheckedItems[person][itemId];
      }
    }

    // 立即移除 UI 元素
    itemElement.remove();
    updateAllUIStates();

    // 立即推送變更
    pushToFirebase("checklist");
    pushToFirebase("items");
  }
}

// ============================================
// 新功能：完全移除人員
// ============================================

function removePerson(personName) {
  if (
    confirm(
      `確定要完全移除 ${personName} 嗎？\n\n• 只由 ${personName} 負責的項目將被刪除\n• 多人負責的項目將移除 ${personName} 標籤\n• ${personName} 的所有勾選狀態將被清除`
    )
  ) {
    console.log(`🗑️ 完全移除人員: ${personName}`);

    // 1. 清除該人員的勾選狀態
    if (personCheckedItems[personName]) {
      delete personCheckedItems[personName];
    }

    // 2. 處理項目：刪除或修改
    const itemsToRemove = [];
    const itemsToUpdate = [];

    document.querySelectorAll(".item").forEach((item) => {
      const personData = item.dataset.person;
      if (personData && personData.includes(personName)) {
        const personsList = personData
          .split(",")
          .map((p) => p.trim())
          .filter((p) => p);

        if (personsList.length === 1 && personsList[0] === personName) {
          // 只有這個人負責 → 刪除整個項目
          itemsToRemove.push(item);
        } else if (personsList.includes(personName)) {
          // 多人負責 → 只移除該人員標籤
          const newPersonsList = personsList.filter((p) => p !== personName);
          const newPersonsData = newPersonsList.join(",");

          // 更新 dataset
          item.dataset.person = newPersonsData;

          // 更新視覺標籤
          const personTags = item.querySelector(".person-tags");
          if (personTags) {
            personTags.innerHTML = "";
            newPersonsList.forEach((person) => {
              const personTag = document.createElement("span");
              personTag.className = "person-tag";
              personTag.textContent = person;
              personTags.appendChild(personTag);
            });
          }

          itemsToUpdate.push(item);
        }
      }
    });

    // 3. 實際移除項目
    itemsToRemove.forEach((item) => {
      const itemId = item.querySelector('input[type="checkbox"]')?.id;
      const itemName = item.querySelector(".item-name")?.textContent;
      console.log(`  🗑️ 刪除項目: ${itemName} (只由 ${personName} 負責)`);

      // 從所有人的勾選記錄中移除
      if (itemId) {
        for (let person in personCheckedItems) {
          delete personCheckedItems[person][itemId];
        }
      }

      item.remove();
    });

    // 4. 更新修改過的項目的狀態指示器
    itemsToUpdate.forEach((item) => {
      const itemId = item.querySelector('input[type="checkbox"]')?.id;
      if (itemId) {
        const responsiblePersons = item.dataset.person.split(",").map((p) => p.trim());
        const statusContainer = item.querySelector(".status-container");
        if (statusContainer) {
          const newStatusClass = getStatusClass(itemId, responsiblePersons);
          statusContainer.classList.remove("status-none", "status-partial", "status-complete");
          statusContainer.classList.add(newStatusClass);
        }
      }
    });

    // 5. 立即推送變更到 Firebase
    pushToFirebase("checklist");
    pushToFirebase("items");

    // 6. 更新 UI 狀態
    updateAllUIStates();

    // 7. 切換回 All 頁面
    switchToAllPage();

    // 8. 顯示操作結果
    const removedCount = itemsToRemove.length;
    const updatedCount = itemsToUpdate.length;
    let message = `已完全移除 ${personName}`;
    if (removedCount > 0) message += `\n刪除了 ${removedCount} 個項目`;
    if (updatedCount > 0) message += `\n更新了 ${updatedCount} 個項目`;

    showUpdateNotification(message);
  }
}

function switchToAllPage() {
  // 找到 All 按鈕並點擊
  const allButton = document.querySelector('[data-person="all"]');
  if (allButton) {
    allButton.click();
  }
}

// ============================================
// UI 工具函數 - 修改版
// ============================================

function createItemElement(list, item) {
  const li = document.createElement("li");
  li.className = "item";
  li.dataset.person = item.personData;

  const currentPerson = getCurrentFilterPerson();
  const isAllPage = currentPerson === "all";

  // Checkbox 容器
  const customCheckbox = document.createElement("div");
  customCheckbox.className = "custom-checkbox";
  customCheckbox.style.display = isAllPage ? "none" : "inline-block";

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.id = item.id;

  const checkboxLabel = document.createElement("label");
  checkboxLabel.className = "checkbox-label";
  checkboxLabel.setAttribute("for", item.id);

  customCheckbox.appendChild(checkbox);
  customCheckbox.appendChild(checkboxLabel);
  li.appendChild(customCheckbox);

  // 狀態指示器
  const responsiblePersons = (item.persons || item.personData || "All").split(",").map((p) => p.trim());
  const statusContainer = createStatusIndicator(item.id, responsiblePersons);
  statusContainer.style.display = isAllPage ? "flex" : "none";
  li.appendChild(statusContainer);

  // 項目標籤
  const itemLabel = document.createElement("label");
  itemLabel.className = "item-label";

  if (!isAllPage) {
    itemLabel.setAttribute("for", item.id);
    itemLabel.style.cursor = "pointer";
  } else {
    itemLabel.style.cursor = "default";
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

  // 負責人標籤
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

  // 刪除按鈕
  const deleteBtn = document.createElement("button");
  deleteBtn.className = "delete-btn";
  deleteBtn.innerHTML = "×";
  deleteBtn.title = "刪除項目";

  li.appendChild(itemLabel);
  li.appendChild(deleteBtn);
  list.appendChild(li);
}

function createStatusIndicator(itemId, responsiblePersons) {
  const statusContainer = document.createElement("div");
  statusContainer.className = "status-container";

  const statusIndicator = document.createElement("div");
  statusIndicator.className = "status-indicator";

  const statusClass = getStatusClass(itemId, responsiblePersons);
  statusContainer.classList.add(statusClass);
  statusContainer.appendChild(statusIndicator);

  return statusContainer;
}

function getStatusClass(itemId, responsiblePersons) {
  const checkedCount = responsiblePersons.filter((person) => {
    const personKey = person === "All" ? "All" : person;
    return personCheckedItems[personKey] && personCheckedItems[personKey][itemId] === true;
  }).length;

  if (checkedCount === 0) return "status-none";
  if (checkedCount === responsiblePersons.length) return "status-complete";
  return "status-partial";
}

function updateStatusIndicators() {
  const items = document.querySelectorAll(".item");

  items.forEach((item) => {
    const statusContainer = item.querySelector(".status-container");
    if (statusContainer) {
      const itemId = item.querySelector('input[type="checkbox"]')?.id;
      const responsiblePersons = item.dataset.person ? item.dataset.person.split(",").map((p) => p.trim()) : ["All"];

      const newStatusClass = getStatusClass(itemId, responsiblePersons);

      statusContainer.classList.remove("status-none", "status-partial", "status-complete");
      statusContainer.classList.add(newStatusClass);
    }
  });
}

function createPersonFilters() {
  const personFilter = document.getElementById("person-filter");
  if (!personFilter) return;

  const currentActive = document.querySelector(".filter-btn.active");
  const currentPerson = currentActive ? currentActive.dataset.person : "all";

  personFilter.innerHTML = '<button class="filter-btn" data-person="all">All</button>';

  // 動態收集目前存在的人員
  const allPersons = new Set();

  document.querySelectorAll(".item").forEach((item) => {
    const persons = item.dataset.person.split(",");
    persons.forEach((person) => {
      const trimmedPerson = person.trim();
      if (trimmedPerson && trimmedPerson !== "All" && trimmedPerson !== "") {
        allPersons.add(trimmedPerson);
      }
    });
  });

  // 按字母順序排序
  const sortedPersons = Array.from(allPersons).sort();

  sortedPersons.forEach((person) => {
    if (person && person !== "all") {
      const button = document.createElement("button");
      button.className = "filter-btn";
      button.textContent = person;
      button.dataset.person = person;
      personFilter.appendChild(button);
    }
  });

  // 設置當前活躍按鈕，如果原本的人員被移除了，就切換到 All
  const buttonToActivate = personFilter.querySelector(`[data-person="${currentPerson}"]`);
  if (buttonToActivate) {
    buttonToActivate.classList.add("active");
  } else {
    const allButton = personFilter.querySelector('[data-person="all"]');
    if (allButton) {
      allButton.classList.add("active");
    }
  }

  setupFilterButtons();
}

function setupFilterButtons() {
  const filterButtons = document.querySelectorAll(".filter-btn");
  filterButtons.forEach((button) => {
    button.replaceWith(button.cloneNode(true));
  });

  const newFilterButtons = document.querySelectorAll(".filter-btn");
  newFilterButtons.forEach((button) => {
    button.addEventListener("click", function () {
      const person = this.dataset.person;

      document.querySelectorAll(".filter-btn").forEach((btn) => {
        btn.classList.remove("active");
      });
      this.classList.add("active");

      switchViewMode(person);
      filterItems(person);
      updateAddItemFormVisibility(); // 新增
      updateRemovePersonButton(); // 新增

      if (person === "all") {
        updateStatusIndicators();
      } else {
        updateCheckboxStates();
      }

      updateProgress();
    });
  });
}

function switchViewMode(person) {
  const isAllPage = person === "all";

  document.querySelectorAll(".item").forEach((item) => {
    const customCheckbox = item.querySelector(".custom-checkbox");
    const statusContainer = item.querySelector(".status-container");
    const itemLabel = item.querySelector(".item-label");

    if (isAllPage) {
      if (customCheckbox) customCheckbox.style.display = "none";
      if (statusContainer) statusContainer.style.display = "flex";
      if (itemLabel) {
        itemLabel.style.cursor = "default";
        itemLabel.removeAttribute("for");
        // 關鍵修改：All 頁面不顯示刪除線
        itemLabel.classList.remove("checked");
      }
    } else {
      if (customCheckbox) customCheckbox.style.display = "inline-block";
      if (statusContainer) statusContainer.style.display = "none";
      if (itemLabel) {
        itemLabel.style.cursor = "pointer";
        const checkbox = item.querySelector('input[type="checkbox"]');
        if (checkbox) itemLabel.setAttribute("for", checkbox.id);
      }
    }
  });
}

// ============================================
// 新功能：控制表單和按鈕顯示
// ============================================

function updateAddItemFormVisibility() {
  const addItemSection = document.querySelector(".add-item-section");
  const currentPerson = getCurrentFilterPerson();

  if (addItemSection) {
    const addItemForm = addItemSection.querySelector(".add-item-form");
    if (addItemForm) {
      if (currentPerson === "all") {
        addItemForm.classList.remove("hidden");
      } else {
        addItemForm.classList.add("hidden");
      }
    }
  }
}

function updateRemovePersonButton() {
  const currentPerson = getCurrentFilterPerson();

  // 先移除現有的按鈕
  const existingBtn = document.querySelector(".remove-person-btn");
  if (existingBtn) {
    existingBtn.remove();
  }

  // 如果不是 All 頁面，添加 Remove Person 按鈕
  if (currentPerson !== "all") {
    const addItemSection = document.querySelector(".add-item-section");
    if (addItemSection) {
      const removeBtn = document.createElement("button");
      removeBtn.className = "remove-person-btn";
      removeBtn.textContent = `Remove ${currentPerson}`;

      // 移除所有內聯樣式，改用 CSS class
      addItemSection.appendChild(removeBtn);
    }
  }
}

function updateProgress() {
  const visibleItems = Array.from(document.querySelectorAll(".item")).filter((item) => item.style.display !== "none");
  const total = visibleItems.length;
  let checked = 0;

  const currentPerson = getCurrentFilterPerson();

  if (currentPerson === "all") {
    visibleItems.forEach((item) => {
      const statusContainer = item.querySelector(".status-container");
      if (statusContainer && statusContainer.classList.contains("status-complete")) {
        checked++;
      }
    });
  } else {
    visibleItems.forEach((item) => {
      const checkbox = item.querySelector('input[type="checkbox"]');
      if (checkbox && checkbox.checked) {
        checked++;
      }
    });
  }

  const progressBar = document.getElementById("progress-fill");
  const progressText = document.getElementById("progress-text");

  if (progressBar && progressText) {
    const percentage = total > 0 ? (checked / total) * 100 : 0;
    progressBar.style.width = `${percentage}%`;
    progressText.textContent = `${checked}/${total} Packed`;
  }
}

function filterItems(person) {
  const items = document.querySelectorAll(".item");

  items.forEach((item) => {
    if (person === "all") {
      item.style.display = "";
    } else {
      const itemPersons = item.dataset.person.split(",").map((p) => p.trim());

      if (itemPersons.includes(person) || itemPersons.includes("All")) {
        item.style.display = "";
      } else {
        item.style.display = "none";
      }
    }
  });
}

function updateCheckboxStates() {
  const currentPerson = getCurrentFilterPerson();
  const checkboxes = document.querySelectorAll('input[type="checkbox"]');

  checkboxes.forEach((checkbox) => {
    const itemId = checkbox.id;
    const item = checkbox.closest(".item");
    const itemLabel = item.querySelector(".item-label");

    const isChecked = personCheckedItems[currentPerson] && personCheckedItems[currentPerson][itemId] === true;

    checkbox.checked = isChecked;

    // 只在非 All 頁面顯示刪除線
    if (getCurrentFilterPerson() !== "all") {
      if (isChecked) {
        itemLabel.classList.add("checked");
      } else {
        itemLabel.classList.remove("checked");
      }
    }
  });
}

function updateAllCheckboxStates() {
  updateCheckboxStates();
}

// ============================================
// 載入預設資料（Firebase 失敗時的備案）
// ============================================

function loadDefaultItems() {
  console.log("📋 載入預設項目資料");

  const defaultData = {
    "shared-items": [
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
    "personal-items": [
      { id: "item-default-12", name: "Sleeping bag", quantity: "", persons: "All", personData: "All" },
      { id: "item-default-13", name: "Clothes", quantity: "", persons: "All", personData: "All" },
      { id: "item-default-14", name: "Rain gear", quantity: "", persons: "All", personData: "All" },
      { id: "item-default-15", name: "Toiletries", quantity: "", persons: "All", personData: "All" },
      { id: "item-default-16", name: "Camera", quantity: "", persons: "Milli", personData: "Milli" },
    ],
  };

  renderItemsFromFirebase(defaultData);

  // 推送預設資料到 Firebase
  if (firebaseInitialized) {
    console.log("📤 上傳預設資料到 Firebase");
    pushToFirebase("items");
  }

  setTimeout(() => {
    isInitialLoad = false;
  }, 1000);
}

// ============================================
// 工具函數
// ============================================

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

        const itemId = checkbox ? checkbox.id : generateSafeId("temp");

        items[categoryId].push({
          id: itemId,
          name: nameSpan.textContent,
          quantity: quantitySpan ? quantitySpan.textContent.replace("x", "") : "",
          persons: persons || "All",
          personData: item.dataset.person || "All",
        });
      });
    }
  });

  return items;
}

function getCurrentFilterPerson() {
  const activeButton = document.querySelector(".filter-btn.active");
  return activeButton ? activeButton.dataset.person : "all";
}

function sanitizeFirebaseKey(key) {
  return key.replace(/[.$#[\]/]/g, "_");
}

function generateSafeId(prefix = "item") {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100)}`;
}

// ============================================
// 更新通知
// ============================================

function showUpdateNotification(message) {
  // 簡單的通知提示
  const notification = document.createElement("div");
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #4CAF50;
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    z-index: 1000;
    font-size: 14px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  `;
  notification.textContent = message;

  document.body.appendChild(notification);

  setTimeout(() => {
    notification.remove();
  }, 3000);
}

console.log("🚀 修復版本載入完成 - 基於原始正常代碼的最小修改");
