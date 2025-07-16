// 用於記錄每個人勾選的項目
let personCheckedItems = {}; // 格式：{ 人名: {itemId: true} }

// 當文檔加載完成後執行初始化
document.addEventListener("DOMContentLoaded", function () {
  // 從本地存儲加載已保存的狀態
  loadList();

  // 添加統一輸入區的事件監聽器
  document.getElementById("add-unified-item").addEventListener("click", addUnifiedItem);

  // 為統一輸入區的輸入框添加 Enter 鍵事件
  const unifiedInputs = document.querySelectorAll('.add-section input[type="text"]');
  unifiedInputs.forEach((input) => {
    input.addEventListener("keypress", function (e) {
      if (e.key === "Enter") {
        addUnifiedItem();
      }
    });
  });
});

// 初始化複選框事件
function initializeCheckboxEvents() {
  const checkboxes = document.querySelectorAll('input[type="checkbox"]');
  checkboxes.forEach((checkbox) => {
    checkbox.addEventListener("change", function () {
      handleCheckboxChange(this);
    });
  });
}

// 初始化刪除按鈕事件
function initializeDeleteEvents() {
  const deleteButtons = document.querySelectorAll(".delete-btn");
  deleteButtons.forEach((button) => {
    button.addEventListener("click", function () {
      deleteItem(this.closest(".item"));
    });
  });
}

// 初始化每個人的勾選記錄
function initializePersonCheckedItems() {
  // 先清空記錄
  personCheckedItems = {
    all: {}, // 確保始終有 "all" 篩選器的紀錄
  };

  // 預設的人員列表
  const defaultPersons = ["77", "阿曹", "Ikea", "吉拉", "康霖", "思霈", "昕樺"];

  // 為每個人初始化勾選記錄
  defaultPersons.forEach((person) => {
    personCheckedItems[person] = {};
  });

  // 添加通用標籤「所有人」
  personCheckedItems["所有人"] = {};
}

// 獲取項目所屬的類別
function getParentCategory(item) {
  // 向上尋找父元素，直到找到 item-list
  let parent = item.parentElement;
  while (parent && !parent.classList.contains("item-list")) {
    parent = parent.parentElement;
  }
  return parent ? parent.id : null;
}

// 處理複選框勾選變更
function handleCheckboxChange(checkbox) {
  const currentPerson = getCurrentFilterPerson();
  const itemId = checkbox.id;
  const item = checkbox.closest(".item");

  // 更新當前人的勾選記錄
  if (checkbox.checked) {
    personCheckedItems[currentPerson][itemId] = true;

    // 檢查是否所有負責人都已勾選此項目（Shared Gear 和 Food 類別）
    const parentCategory = getParentCategory(item);
    if (parentCategory === "public-items" || parentCategory === "food-items") {
      const responsiblePersons = item.dataset.person.split(",").map((p) => p.trim());
      // 只檢查真實的人員（不包括「所有人」標籤）
      const realPersons = responsiblePersons.filter((p) => p !== "所有人");

      if (realPersons.length > 0) {
        // 檢查是否所有負責人都勾選了此項目
        const allResponsibleChecked = realPersons.every((person) => personCheckedItems[person] && personCheckedItems[person][itemId]);

        // 如果所有負責人都勾選了，則在 "all" 篩選器中也勾選
        if (allResponsibleChecked) {
          personCheckedItems["all"][itemId] = true;
        }
      }
    }
  } else {
    delete personCheckedItems[currentPerson][itemId];

    // 如果任何負責人取消勾選，則在 "all" 篩選器中也取消勾選
    const parentCategory = getParentCategory(item);
    if (parentCategory === "public-items" || parentCategory === "food-items") {
      delete personCheckedItems["all"][itemId];
    }
  }

  updateItemStatus(checkbox);
  updateProgress();
}

// 獲取當前篩選的人名
function getCurrentFilterPerson() {
  const activeButton = document.querySelector(".person-filter button.active");
  return activeButton ? activeButton.dataset.person : "all";
}

// 設置篩選按鈕事件
function setupFilterButtons() {
  const filterButtons = document.querySelectorAll(".person-filter button");
  filterButtons.forEach((button) => {
    button.addEventListener("click", function () {
      const person = this.dataset.person;

      // 更新篩選顯示
      filterItems(person);

      // 更新按鈕狀態
      document.querySelectorAll(".person-filter button").forEach((btn) => {
        btn.classList.remove("active");
      });
      this.classList.add("active");

      // 更新勾選狀態以顯示該人的勾選項目
      updateCheckboxStates();
    });
  });
}

// 更新所有勾選框的狀態
function updateCheckboxStates() {
  const currentPerson = getCurrentFilterPerson();
  const checkboxes = document.querySelectorAll('input[type="checkbox"]');

  checkboxes.forEach((checkbox) => {
    const itemId = checkbox.id;
    const item = checkbox.closest(".item");

    // 如果是 "all" 篩選器，則需要特別處理 Shared Gear 和 Food 類別
    if (currentPerson === "all") {
      const parentCategory = getParentCategory(item);

      if (parentCategory === "public-items" || parentCategory === "food-items") {
        // 已經在 handleCheckboxChange 中處理了，只需檢查 all 中的狀態
        checkbox.checked = personCheckedItems[currentPerson][itemId] === true;
      } else {
        // 個人物品類別，如果項目標記為「所有人」，則顯示該項目在 all 中的狀態
        const itemPersons = item.dataset.person.split(",").map((p) => p.trim());
        if (itemPersons.includes("所有人")) {
          checkbox.checked = personCheckedItems[currentPerson][itemId] === true;
        } else {
          // 其他個人物品，如果選擇「全部」篩選器，則預設不顯示勾選
          checkbox.checked = false;
        }
      }
    } else {
      // 非 "all" 篩選器，顯示該人的勾選狀態
      checkbox.checked = personCheckedItems[currentPerson][itemId] === true;
    }

    updateItemStatus(checkbox);
  });

  updateProgress();
}

// 統一的項目添加函數
function addUnifiedItem() {
  const categorySelect = document.getElementById("category-select");
  const nameInput = document.getElementById("new-item-name");
  const quantityInput = document.getElementById("new-item-quantity");
  const personInput = document.getElementById("new-item-person");

  const category = categorySelect.value.trim();
  const name = nameInput.value.trim();
  const quantity = quantityInput.value.trim();
  const persons = personInput.value.trim();

  // 檢查輸入是否有效
  if (!category) {
    alert("請選擇類別");
    return;
  }

  if (!name) {
    alert("請輸入項目名稱");
    return;
  }

  // 確定要添加到哪個列表
  let listId;

  switch (category) {
    case "Shared Gear":
      listId = "public-items";
      break;
    case "Food":
      listId = "food-items";
      break;
    case "Personal Gear":
      listId = "personal-items";
      break;
    default:
      // 如果找不到匹配的類別，使用公共物品列表
      listId = "public-items";
  }

  // 添加新項目
  addNewItem(listId, name, quantity, persons);

  // 清空輸入框
  nameInput.value = "";
  quantityInput.value = "";
  personInput.value = "";
}

// 添加新項目到指定列表
function addNewItem(listId, name, quantity, persons) {
  if (name) {
    const list = document.getElementById(listId);
    const id = `item-${Date.now()}`;

    const li = document.createElement("li");
    li.className = "item";
    li.dataset.person = persons;

    // 創建自定義複選框
    const customCheckbox = document.createElement("div");
    customCheckbox.className = "custom-checkbox";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.id = id;

    const checkboxLabel = document.createElement("label");
    checkboxLabel.className = "checkbox-label";
    checkboxLabel.setAttribute("for", id);

    customCheckbox.appendChild(checkbox);
    customCheckbox.appendChild(checkboxLabel);

    // 創建項目標籤
    const itemLabel = document.createElement("label");
    itemLabel.className = "item-label";
    itemLabel.setAttribute("for", id);

    const nameSpan = document.createElement("span");
    nameSpan.className = "item-name";
    nameSpan.textContent = name;

    itemLabel.appendChild(nameSpan);

    if (quantity) {
      const quantitySpan = document.createElement("span");
      quantitySpan.className = "item-quantity";
      quantitySpan.textContent = `x${quantity}`;
      itemLabel.appendChild(quantitySpan);
    }

    const personTags = document.createElement("span");
    personTags.className = "person-tags";

    if (persons) {
      const personsList = persons.split(",");
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

    // 添加刪除按鈕
    const deleteBtn = document.createElement("button");
    deleteBtn.className = "delete-btn";
    deleteBtn.innerHTML = "×";
    deleteBtn.title = "刪除項目";
    deleteBtn.addEventListener("click", function (e) {
      e.preventDefault(); // 防止觸發勾選事件
      e.stopPropagation(); // 防止事件冒泡
      deleteItem(li);
    });

    checkbox.addEventListener("change", function () {
      handleCheckboxChange(this);
    });

    li.appendChild(customCheckbox);
    li.appendChild(itemLabel);
    li.appendChild(deleteBtn);
    list.appendChild(li);

    // 更新進度和篩選器
    updateProgress();
    createPersonFilters();

    // 確保剛添加的項目對應的人員勾選記錄已初始化
    if (persons) {
      const personsList = persons.split(",");
      personsList.forEach((person) => {
        const trimmedPerson = person.trim();
        if (trimmedPerson && !personCheckedItems[trimmedPerson]) {
          personCheckedItems[trimmedPerson] = {};
        }
      });
    }
  }
}

// 建立人員篩選按鈕
function createPersonFilters() {
  const personFilter = document.getElementById("person-filter");
  // 先清空篩選器容器，只保留「全部」按鈕
  personFilter.innerHTML = '<button class="active" data-person="all">All</button>';

  // 預設的人員列表
  const defaultPersons = ["77", "阿曹", "Ikea", "吉拉", "康霖", "思霈", "昕樺"];
  const commonTags = ["所有人"]; // 只保留「所有人」作為通用標籤

  // 收集項目中的人員標籤
  const itemPersons = new Set(defaultPersons);
  document.querySelectorAll(".item").forEach((item) => {
    const persons = item.dataset.person.split(",");
    persons.forEach((person) => {
      const trimmedPerson = person.trim();
      if (trimmedPerson && trimmedPerson !== "Tag") {
        itemPersons.add(trimmedPerson);
      }
    });
  });

  // 為每個人建立篩選按鈕
  itemPersons.forEach((person) => {
    if (person && person !== "all" && person !== "Tag" && !commonTags.includes(person)) {
      const button = document.createElement("button");
      button.textContent = person;
      button.dataset.person = person;
      personFilter.appendChild(button);
    }
  });

  // 重新添加篩選功能
  setupFilterButtons();

  // 確保每個人的勾選記錄已初始化
  itemPersons.forEach((person) => {
    if (!personCheckedItems[person]) {
      personCheckedItems[person] = {};
    }
  });
}

// 篩選項目，只顯示包含「所有人」的通用標籤項目
function filterItems(person) {
  const items = document.querySelectorAll(".item");
  const commonTags = ["所有人"]; // 只保留「所有人」作為通用標籤

  items.forEach((item) => {
    if (person === "all") {
      item.style.display = "";
    } else {
      const itemPersons = item.dataset.person.split(",").map((p) => p.trim());

      // 如果項目包含篩選的人員名稱或包含「所有人」標籤，則顯示
      if (itemPersons.includes(person) || itemPersons.some((p) => commonTags.includes(p))) {
        item.style.display = "";
      } else {
        item.style.display = "none";
      }
    }
  });
}

// 更新項目狀態（勾選/取消勾選）
function updateItemStatus(checkbox) {
  const item = checkbox.closest(".item");
  const itemLabel = item.querySelector(".item-label");

  if (checkbox.checked) {
    itemLabel.classList.add("checked");
  } else {
    itemLabel.classList.remove("checked");
  }
}

// 更新進度條
function updateProgress() {
  const currentPerson = getCurrentFilterPerson();
  const visibleItems = Array.from(document.querySelectorAll(".item")).filter((item) => item.style.display !== "none");

  const total = visibleItems.length;
  let checked = 0;

  visibleItems.forEach((item) => {
    const checkbox = item.querySelector('input[type="checkbox"]');
    if (checkbox && checkbox.checked) {
      checked++;
    }
  });

  const progressBar = document.getElementById("progress");
  const progressText = document.getElementById("progress-text");

  const percentage = total > 0 ? (checked / total) * 100 : 0;
  progressBar.style.width = `${percentage}%`;
  progressText.textContent = `${checked}/${total} Packed`;
}

// 刪除項目
function deleteItem(itemElement) {
  if (confirm("確定要刪除這個項目嗎？")) {
    // 在所有人的勾選記錄中刪除該項目
    const itemId = itemElement.querySelector('input[type="checkbox"]').id;
    for (let person in personCheckedItems) {
      delete personCheckedItems[person][itemId];
    }

    // 從DOM中移除項目
    itemElement.remove();

    // 更新進度條
    updateProgress();

    // 更新篩選器（如果刪除的是某人的唯一項目，需要更新篩選按鈕）
    createPersonFilters();
  }
}

// 儲存清單到本地存儲
function saveList() {
  const categories = document.querySelectorAll(".category");
  const savedData = {
    categories: {},
    personChecked: personCheckedItems, // 保存每個人的勾選狀態
  };

  categories.forEach((category) => {
    const categoryId = category.querySelector(".item-list").id;
    const categoryTitle = category.querySelector(".category-title").textContent;
    const items = [];

    category.querySelectorAll(".item").forEach((item) => {
      const checkbox = item.querySelector('input[type="checkbox"]');
      const nameSpan = item.querySelector(".item-name");
      const quantitySpan = item.querySelector(".item-quantity");
      const personTags = item.querySelectorAll(".person-tag");

      const persons = Array.from(personTags)
        .map((tag) => tag.textContent)
        .join(",");

      items.push({
        id: checkbox.id,
        name: nameSpan.textContent,
        quantity: quantitySpan ? quantitySpan.textContent.replace("x", "") : "",
        persons: persons,
        personData: item.dataset.person,
      });
    });

    savedData.categories[categoryId] = {
      title: categoryTitle,
      items: items,
    };
  });

  localStorage.setItem("groupCampingChecklist", JSON.stringify(savedData));
  alert("清單已儲存！");
}

// 從本地存儲載入清單，如果沒有就載入預設項目
async function loadList() {
  const savedData = localStorage.getItem("groupCampingChecklist");

  if (savedData) {
    // 載入已保存的清單
    renderSavedItems(JSON.parse(savedData));
  } else {
    // 沒有已保存的清單，載入預設項目
    try {
      // 從文件加載預設項目
      const response = await fetch("defaultItems.json");
      if (response.ok) {
        const defaultData = await response.json();
        renderSavedItems(defaultData);
      } else {
        console.error("無法載入預設項目");
        // 初始化空清單
        initializePersonCheckedItems();

        // 建立人員篩選按鈕
        createPersonFilters();

        // 為已有的複選框添加事件
        initializeCheckboxEvents();

        // 為刪除按鈕添加事件
        initializeDeleteEvents();
      }
    } catch (error) {
      console.error("載入預設項目時出錯:", error);
      // 初始化空清單
      initializePersonCheckedItems();

      // 建立人員篩選按鈕
      createPersonFilters();

      // 為已有的複選框添加事件
      initializeCheckboxEvents();

      // 為刪除按鈕添加事件
      initializeDeleteEvents();
    }
  }
}

// 渲染保存的或預設的項目
function renderSavedItems(data) {
  // 清空現有清單
  document.querySelectorAll(".item-list").forEach((list) => {
    list.innerHTML = "";
  });

  // 載入每個人的勾選狀態
  if (data.personChecked) {
    personCheckedItems = data.personChecked;
  } else {
    // 兼容舊版本保存的數據（沒有personChecked屬性）
    initializePersonCheckedItems();
  }

  // 添加保存的項目
  const categoriesData = data.categories || data; // 兼容舊版本保存的數據結構
  for (const categoryId in categoriesData) {
    const list = document.getElementById(categoryId);
    if (list && categoriesData[categoryId].items) {
      categoriesData[categoryId].items.forEach((item) => {
        // 創建自定義複選框
        const customCheckbox = document.createElement("div");
        customCheckbox.className = "custom-checkbox";

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.id = item.id;

        // 檢查當前選擇的人是否勾選了此項目
        const currentPerson = getCurrentFilterPerson();
        checkbox.checked = personCheckedItems[currentPerson] && personCheckedItems[currentPerson][item.id] === true;

        const checkboxLabel = document.createElement("label");
        checkboxLabel.className = "checkbox-label";
        checkboxLabel.setAttribute("for", item.id);

        customCheckbox.appendChild(checkbox);
        customCheckbox.appendChild(checkboxLabel);

        const li = document.createElement("li");
        li.className = "item";
        li.dataset.person = item.personData;

        // 創建項目標籤
        const itemLabel = document.createElement("label");
        itemLabel.className = "item-label";
        itemLabel.setAttribute("for", item.id);

        if (checkbox.checked) {
          itemLabel.classList.add("checked");
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

        // 添加刪除按鈕
        const deleteBtn = document.createElement("button");
        deleteBtn.className = "delete-btn";
        deleteBtn.innerHTML = "×";
        deleteBtn.title = "刪除項目";
        deleteBtn.addEventListener("click", function (e) {
          e.preventDefault();
          e.stopPropagation();
          deleteItem(li);
        });

        checkbox.addEventListener("change", function () {
          handleCheckboxChange(this);
        });

        li.appendChild(customCheckbox);
        li.appendChild(itemLabel);
        li.appendChild(deleteBtn);
        list.appendChild(li);
      });
    }
  }

  // 檢查共享項目的勾選狀態
  updateSharedItemsAllStatus();

  // 更新進度
  updateProgress();

  // 更新篩選器
  createPersonFilters();

  // 初始化事件
  initializeCheckboxEvents();
  initializeDeleteEvents();
}

// 更新所有共享項目在 all 篩選器中的狀態
function updateSharedItemsAllStatus() {
  // 檢查所有共享項目
  const sharedItems = document.querySelectorAll("#public-items .item, #food-items .item");

  sharedItems.forEach((item) => {
    const checkbox = item.querySelector('input[type="checkbox"]');
    const itemId = checkbox.id;

    // 獲取負責人列表
    const responsiblePersons = item.dataset.person.split(",").map((p) => p.trim());
    // 只考慮真實人員（不包括「所有人」標籤）
    const realPersons = responsiblePersons.filter((p) => p !== "所有人");

    if (realPersons.length > 0) {
      // 檢查是否所有負責人都勾選了此項目
      const allResponsibleChecked = realPersons.every((person) => personCheckedItems[person] && personCheckedItems[person][itemId]);

      // 如果所有負責人都勾選了，則在 "all" 篩選器中也勾選
      if (allResponsibleChecked) {
        personCheckedItems["all"][itemId] = true;
      } else {
        delete personCheckedItems["all"][itemId];
      }
    }
  });
}
