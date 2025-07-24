// ================================
// Camping 2025 - 動態動畫控制
// 這個文件專門處理動態添加/刪除項目的動畫
// ================================

(function() {
    'use strict';

    // 動畫樣式定義
    const animationStyles = `
        /* 新增項目的動畫 */
        .item-enter {
            opacity: 0;
            transform: translateX(-30px) scale(0.9);
            transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .item-enter-active {
            opacity: 1;
            transform: translateX(0) scale(1);
        }

        /* 新增項目的高亮效果 */
        .item-highlight {
            background-color: rgba(55, 64, 47, 0.1);
            animation: highlightNewItem 2s ease-out;
        }

        @keyframes highlightNewItem {
            0% {
                background-color: rgba(55, 64, 47, 0.2);
                transform: scale(1.02);
            }
            50% {
                background-color: rgba(55, 64, 47, 0.1);
            }
            100% {
                background-color: transparent;
                transform: scale(1);
            }
        }

        /* 刪除項目的動畫 */
        .item-exit {
            opacity: 1;
            transform: translateX(0) scale(1);
            max-height: 48px;
            overflow: hidden;
            transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .item-exit-active {
            opacity: 0;
            transform: translateX(-100px) scale(0.8);
            max-height: 0;
            padding-top: 0;
            padding-bottom: 0;
            margin-top: 0;
            margin-bottom: 0;
        }

        /* 篩選切換動畫 */
        .item-filter-exit {
            opacity: 1;
            transform: translateX(0);
            transition: all 0.3s ease-out;
        }

        .item-filter-exit-active {
            opacity: 0;
            transform: translateX(-20px);
        }

        .item-filter-enter {
            opacity: 0;
            transform: translateX(-20px);
            transition: all 0.4s ease-out;
        }

        .item-filter-enter-active {
            opacity: 1;
            transform: translateX(0);
        }

        /* 更新通知 */
        .update-notification {
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(135deg, #4CAF50, #45a049);
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            z-index: 1000;
            font-size: 14px;
            font-weight: 500;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            transform: translateX(100%);
            opacity: 0;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .update-notification.show {
            transform: translateX(0);
            opacity: 1;
        }

        .update-notification.hide {
            transform: translateX(100%);
            opacity: 0;
        }
    `;

    // 將樣式添加到頁面
    function injectStyles() {
        const styleElement = document.createElement('style');
        styleElement.textContent = animationStyles;
        document.head.appendChild(styleElement);
    }

    // 監聽 DOM 變化，為新增的項目添加動畫
    function setupMutationObserver() {
        const observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                if (mutation.type === 'childList') {
                    // 處理新增的節點
                    mutation.addedNodes.forEach(function(node) {
                        if (node.nodeType === Node.ELEMENT_NODE && node.classList.contains('item')) {
                            animateNewItem(node);
                        }
                    });
                }
            });
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        return observer;
    }

    // 為新增項目添加入場動畫
    function animateNewItem(element) {
        // 避免對初始載入的項目添加動畫
        if (document.readyState === 'loading') return;

        element.classList.add('item-enter');
        
        // 強制瀏覽器重新計算樣式
        element.offsetHeight;
        
        // 添加動畫類別
        setTimeout(() => {
            element.classList.add('item-enter-active');
            element.classList.add('item-highlight');
        }, 10);

        // 清理動畫類別
        setTimeout(() => {
            element.classList.remove('item-enter', 'item-enter-active');
        }, 500);

        setTimeout(() => {
            element.classList.remove('item-highlight');
        }, 2000);
    }

    // 為刪除項目添加退場動畫
    function animateRemoveItem(element, callback) {
        element.classList.add('item-exit');
        
        setTimeout(() => {
            element.classList.add('item-exit-active');
        }, 10);

        setTimeout(() => {
            if (callback) callback();
        }, 400);
    }

    // 篩選動畫
    function animateFilterChange() {
        const items = document.querySelectorAll('.item');
        
        items.forEach((item, index) => {
            // 首先為所有項目添加退場動畫
            item.classList.add('item-filter-exit');
            
            setTimeout(() => {
                item.classList.add('item-filter-exit-active');
            }, 10);

            // 然後為顯示的項目添加入場動畫
            setTimeout(() => {
                if (item.style.display !== 'none') {
                    item.classList.remove('item-filter-exit', 'item-filter-exit-active');
                    item.classList.add('item-filter-enter');
                    
                    setTimeout(() => {
                        item.classList.add('item-filter-enter-active');
                    }, 10);

                    setTimeout(() => {
                        item.classList.remove('item-filter-enter', 'item-filter-enter-active');
                    }, 400);
                }
            }, 150 + (index * 20));
        });
    }

    // 顯示更新通知
    function showUpdateNotification(message) {
        // 移除現有通知
        const existing = document.querySelector('.update-notification');
        if (existing) {
            existing.remove();
        }

        const notification = document.createElement('div');
        notification.className = 'update-notification';
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        // 觸發顯示動畫
        setTimeout(() => {
            notification.classList.add('show');
        }, 10);

        // 自動隱藏
        setTimeout(() => {
            notification.classList.remove('show');
            notification.classList.add('hide');
            
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.remove();
                }
            }, 300);
        }, 3000);
    }

    // 覆寫原始的刪除函數以添加動畫支持
    function enhanceDeleteFunction() {
        // 監聽刪除按鈕點擊
        document.addEventListener('click', function(e) {
            if (e.target.classList.contains('delete-btn')) {
                e.preventDefault();
                e.stopPropagation();
                
                const item = e.target.closest('.item');
                if (item && confirm('確定要刪除這個項目嗎？')) {
                    animateRemoveItem(item, () => {
                        // 執行原本的刪除邏輯
                        const itemId = item.querySelector('input[type="checkbox"]')?.id;
                        
                        // 這裡需要調用原有的刪除邏輯
                        // 由於我們不修改 script.js，這部分由原有程式處理
                        item.remove();
                        
                        // 觸發更新
                        if (window.updateAllUIStates) {
                            window.updateAllUIStates();
                        }
                    });
                }
            }
        });
    }

    // 監聽篩選按鈕變化
    function setupFilterAnimations() {
        let lastActiveFilter = 'all';
        
        document.addEventListener('click', function(e) {
            if (e.target.classList.contains('filter-btn')) {
                const currentFilter = e.target.dataset.person;
                
                if (currentFilter !== lastActiveFilter) {
                    setTimeout(() => {
                        animateFilterChange();
                    }, 50);
                    
                    lastActiveFilter = currentFilter;
                }
            }
        });
    }

    // 主初始化函數
    function init() {
        // 等待 DOM 完全載入
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', init);
            return;
        }

        console.log('🎬 動畫系統初始化中...');
        
        // 注入樣式
        injectStyles();
        
        // 設置各種監聽器
        setupMutationObserver();
        enhanceDeleteFunction();
        setupFilterAnimations();
        
        // 將函數暴露到全域供其他模組使用
        window.animateNewItem = animateNewItem;
        window.animateRemoveItem = animateRemoveItem;
        window.animateFilterChange = animateFilterChange;
        window.showUpdateNotification = showUpdateNotification;
        
        console.log('✨ 動畫系統已就緒！');
    }

    // 如果已經載入完成就直接初始化
    init();

})();
