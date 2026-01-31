// manager.js
// フィルタ管理画面のロジックを記述

//----------------------------------------------------------------------
// 1. 初期化と基本設定
//----------------------------------------------------------------------
console.log("Filter Manager tab loaded!");

// グローバル設定オブジェクト
window.appSettings = {
    enableDeleteAction: false,  // 削除機能:デフォルトでは無効
    lastUpdated: new Date().toISOString()
};
// フィルタデータを保持するための配列（初期値として空の配列）
let filters = [];

// 現在選択されているフィルタのインデックスを保持
let currentFilterIndex = -1;

// 保存処理のデバウンス用タイマーID
let saveTimerId = null;

// ページの読み込みが完了したら実行される処理
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOMContentLoaded event fired.");

    // UIテキストの多言語化を適用 (data-i18n属性を使用)
    localizeHtmlPage();

    // 全ての条件項目要素を取得し、ロジックを設定
    const conditionItems = document.querySelectorAll('.filter-condition-item');
    if (conditionItems.length > 0) {
        conditionItems.forEach(item => {
            setupConditionItem(item);
        });
    } else {
        console.warn("No filter condition items found.");
    }

    // アプリ設定を読み込む
    loadAppSettings();

    // ドラッグアンドドロップ機能の初期化
    setupFilterListSorting();

    // バージョン表示機能
    const displayVersionNumber = function() {
        const versionElement = document.getElementById('version-display');
        if (versionElement && chrome.runtime && chrome.runtime.getManifest) {
            const version = chrome.runtime.getManifest().version || '不明';
            versionElement.textContent = 'v' + version;
        }
    };

    // バージョン表示を実行
    displayVersionNumber();

    // 「＋ フィルタを追加」ボタンにイベントリスナーを設定
    const addNewFilterButton = document.getElementById('add-new-filter');
    if (addNewFilterButton) {
        console.log("'+ フィルタを追加' button found, adding event listener.");
        addNewFilterButton.addEventListener('click', () => {
            console.log("'+ フィルタを追加' button clicked!");
            const newFilter = createNewFilterData(); // 無題のフィルタデータを作成
            filters.push(newFilter); // filters 配列に追加
            console.log("New filter added:", newFilter);
            console.log("Current filters:", filters);
            renderFilterList(); // フィルタ一覧を更新
            // 無題のフィルタのIDで選択する
            selectFilterById(newFilter.id);
            console.log("New filter should be rendered and selected.");
            // 削除ボタンの状態を更新
            updateDeleteButtonState();
            // 明示的に保存処理を呼び出す
            saveFiltersToStorage();
            // リストを最下部にスクロール
            scrollFilterListToBottom();
        });
    } else {
        console.error("'+ フィルタを追加' button not found!");
    }

    // フィルタ名入力欄のイベントリスナー設定
    const filterNameInput = document.getElementById('filter-name-input');
    if (filterNameInput) {
        filterNameInput.addEventListener('input', updateCurrentFilterData);
    }

    // フィルタ処理に関する入力要素のイベントリスナー設定
    setupFilterProcessEvents();

    // 既存のフィルタデータをストレージから読み込む
    loadFiltersFromStorage();

    // 「この処理を複製」ボタンにイベントリスナーを設定
    const duplicateProcessButton = document.getElementById('duplicate-this-process');
    if (duplicateProcessButton) {
        console.log("'この処理を複製' button found, adding event listener.");
        duplicateProcessButton.addEventListener('click', duplicateCurrentProcess);
    } else {
        console.error("'この処理を複製' button not found!");
    }

    // 「このフィルタを保存する」ボタンにイベントリスナーを設定
    const exportCurrentFilterButton = document.getElementById('export-this-filter');
    if (exportCurrentFilterButton) {
        console.log("'このフィルタを保存' button found, adding event listener.");
        exportCurrentFilterButton.addEventListener('click', function () {
            exportFilters('current'); // 「current」モードでエクスポート
        });
    } else {
        console.error("'このフィルタを保存' button not found!");
    }

    // 「このフィルタを複製」ボタンにイベントリスナーを設定
    const duplicateFilterButton = document.getElementById('duplicate-this-filter');
    if (duplicateFilterButton) {
        console.log("'このフィルタを複製' button found, adding event listener.");
        duplicateFilterButton.addEventListener('click', duplicateCurrentFilter);
    } else {
        console.error("'このフィルタを複製' button not found!");
    }

    // 「このフィルタを削除」ボタンにイベントリスナーを設定
    const deleteFilterButton = document.getElementById('delete-this-filter');
    if (deleteFilterButton) {
        console.log("'このフィルタを削除' button found, adding event listener.");
        deleteFilterButton.addEventListener('click', deleteCurrentFilter);
    } else {
        console.error("'このフィルタを削除' button not found!");
    }

    // エクスポート・インポートボタンのイベントリスナー設定
    document.getElementById('export-filter').addEventListener('click', function () { exportFilters('all'); });
    document.getElementById('import-filter').addEventListener('click', showImportDialog);

    console.log("manager.js setup complete.");
});

// フィルタ処理に関する入力要素のイベント設定を行う関数
function setupFilterProcessEvents() {
    // チェックボックスのイベントリスナー設定
    document.querySelectorAll('.filter-process-item input[type="checkbox"]').forEach(checkbox => {
        checkbox.addEventListener('change', updateCurrentFilterData);

        // 関連する入力要素の有効/無効を切り替える処理
        const relatedInput = checkbox.closest('.filter-process-item').querySelector('input[type="text"]');
        const relatedSelect = checkbox.closest('.filter-process-item').querySelector('select');

        if (relatedInput) {
            checkbox.addEventListener('change', () => {
                relatedInput.disabled = !checkbox.checked;
                // チェックが外れたら入力値もクリア
                if (!checkbox.checked) {
                    relatedInput.value = '';
                    updateCurrentFilterData(); // データも更新
                }
            });
            // 初期状態を設定
            relatedInput.disabled = !checkbox.checked;
        }

        if (relatedSelect) {
            checkbox.addEventListener('change', () => {
                relatedSelect.disabled = !checkbox.checked;
                // チェックが外れたら選択値をクリア
                if (!checkbox.checked) {
                    relatedSelect.value = ''; // デフォルト値に戻す
                    updateCurrentFilterData(); // データも更新
                }
            });
            // 初期状態を設定
            relatedSelect.disabled = !checkbox.checked;
        }
    });

    // テキスト入力フィールドのイベントリスナー設定
    document.querySelectorAll('.filter-process-item input[type="text"]').forEach(input => {
        input.addEventListener('input', function () {
            console.log(`テキスト入力変更: ${this.id} = ${this.value}`);
            updateCurrentFilterData();
        });
    });

    // セレクトボックスのイベントリスナー設定
    document.querySelectorAll('.filter-process-item select').forEach(select => {
        select.addEventListener('change', function () {
            console.log(`セレクトボックス変更: ${this.id} = ${this.value}`);
            updateCurrentFilterData();
        });
    });

    // サイズ条件の入力要素のイベントリスナー設定
    const sizeValueInput = document.getElementById('condition-size-value-input');
    const sizeOperatorSelect = document.getElementById('condition-size-operator');
    const sizeUnitSelect = document.getElementById('condition-size-unit');

    if (sizeValueInput) {
        sizeValueInput.addEventListener('input', function () {
            console.log(`サイズ値変更: ${this.value}`);
            updateCurrentFilterData();
        });
    }

    if (sizeOperatorSelect) {
        sizeOperatorSelect.addEventListener('change', function () {
            console.log(`サイズ演算子変更: ${this.value}`);
            updateCurrentFilterData();
        });
    }

    if (sizeUnitSelect) {
        sizeUnitSelect.addEventListener('change', function () {
            console.log(`サイズ単位変更: ${this.value}`);
            updateCurrentFilterData();
        });
    }

    // 添付ファイルチェックボックスのイベントリスナー設定
    const hasAttachmentCheckbox = document.getElementById('condition-has-attachment');
    if (hasAttachmentCheckbox) {
        hasAttachmentCheckbox.addEventListener('change', function () {
            console.log(`添付ファイル条件変更: ${this.checked}`);
            updateCurrentFilterData();
        });
    }
}


//----------------------------------------------------------------------
// 2. ユーティリティ関数
//----------------------------------------------------------------------

// チップを作成 (汎用化)
function createChip(text, type) {
    const chip = document.createElement('span');
    chip.classList.add('chip', type);
    chip.appendChild(document.createTextNode(text));
    return chip;
}

// 入力フォーム内のチップに削除ボタンを追加するヘルパー関数
function addRemoveButtonToInputChip(chip) {
    const removeButton = document.createElement('button');
    removeButton.classList.add('remove-chip'); // 入力フォーム内削除用共通クラス
    removeButton.textContent = '✕'; // バツ印
    removeButton.type = 'button'; // フォーム送信を防ぐ
    chip.appendChild(removeButton);
}

// ORグループの開始を示す要素を作成（2個目以降のORグループとORグループの間用）
function createOrGroupIndicator() {
    const orIndicator = document.createElement('span');
    orIndicator.classList.add('or-indicator'); // 共通クラス
    orIndicator.textContent = 'OR';
    return orIndicator;
}

// ORグループ単位の削除ボタンを作成
function createOrGroupRemoveButton() {
    const removeButton = document.createElement('button');
    removeButton.classList.add('remove-or-group-button'); // ORグループ削除用共通クラス
    removeButton.textContent = '✕';
    removeButton.type = 'button';
    return removeButton;
}

// XMLの特殊文字をエスケープする関数
function escapeXml(unsafe) {
    if (!unsafe) return '';

    return unsafe.replace(/[<>&'"]/g, function (c) {
        switch (c) {
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '&': return '&amp;';
            case '\'': return '&apos;';
            case '"': return '&quot;'; // 直接エスケープシーケンスを使用
        }
    });
}

// XML特殊文字をデコードする関数（インポート時に使用）
function unescapeXml(escapedXml) {
    if (!escapedXml) return '';

    return escapedXml
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, '\'')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>');
}

// 環境判定関数（拡張機能環境かどうか）
function isExtensionEnvironment() {
    return typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;
}

//----------------------------------------------------------------------
// 3. データモデル関連
//----------------------------------------------------------------------

// 無題のフィルタデータを作成する関数
function createNewFilterData() {
    // デフォルト値を持つ無題のフィルタオブジェクトを生成
    const newFilter = {
        id: Date.now().toString(), // シンプルなIDとしてタイムスタンプを使用
        name: "",
        conditions: { // フィルタ条件の初期値は空またはデフォルト値
            from: [],
            to: [],
            subject: [],
            includes: [],
            excludes: [],
            size: {
                operator: 'larger_than',
                value: null,
                unit: 's_smb'
            },
            hasAttachment: false
        },
        actions: { // フィルタ処理の初期値は全てfalseまたはデフォルト値
            skipInbox: false,
            markAsRead: false,
            star: false,
            applyLabel: { enabled: false, labelName: '' },
            forward: { enabled: false, forwardAddress: '' },
            delete: false,
            notSpam: false,
            alwaysImportant: false,
            neverImportant: false,
            applyCategory: { enabled: false, category: '' }
        }
    };
    return newFilter;
}

// デバウンス付きで保存をスケジュールする関数
function scheduleSaveFilters() {
    // すでにタイマーがあればクリア（連続入力をまとめる）
    if (saveTimerId !== null) {
        clearTimeout(saveTimerId);
    }

    // 最後の変更から 1500ms 後に1回だけ保存
    saveTimerId = setTimeout(() => {
        saveTimerId = null;
        // ここで既存の保存関数を呼ぶ
        saveFiltersToStorage();
    }, 3000); // 好みで 1000〜3000ms くらいに調整
}

// フィルタデータを保存する関数
function saveFiltersToStorage() {
    if (isExtensionEnvironment()) {
        // Chrome拡張環境では同期ストレージに保存
        chrome.storage.sync.set({ 'filters': filters }, function () {
            if (chrome.runtime.lastError) {
                console.error('フィルタ設定の同期ストレージへの保存に失敗しました:', chrome.runtime.lastError);
                // 必要であれば、ここでローカルストレージへのフォールバック保存を検討することもできます。
            } else {
                console.log('フィルタ設定が保存されました（chrome.storage.sync）');
            }
        });
    } else {
        // 通常のWeb環境（開発時）はlocalStorageを使用
        try {
            localStorage.setItem('gmail_filters', JSON.stringify(filters));
            console.log('フィルタ設定が保存されました（localStorage）');
        } catch (e) {
            console.error('フィルタ設定のlocalStorageへの保存に失敗しました：', e);
        }
    }
}

// 読み込んだデータを処理する関数
function handleLoadedData(loadedFilters) {
    if (loadedFilters && Array.isArray(loadedFilters) && loadedFilters.length > 0) {
        // データがあればそれを使用
        filters = loadedFilters;
        console.log('保存されたフィルタを読み込みました:', filters.length, '件');

        // フィルタ一覧を描画
        renderFilterList();

        // 最初のフィルタを選択
        selectFilter(0);
    } else {
        // 保存データがない場合は初期フィルタを作成
        console.log("ストレージからフィルタが見つからないか、データが無効です。初期フィルタを作成します。");
        const initialFilter = createNewFilterData();
        filters = [initialFilter]; // 空の配列に初期フィルタを追加

        // フィルタ一覧を描画
        renderFilterList();

        // 作成したフィルタを選択
        selectFilterById(initialFilter.id);

        // 初期フィルタをストレージに保存
        saveFiltersToStorage();
    }

    // 削除ボタンの状態を更新
    updateDeleteButtonState();
}

// 保存されたフィルタデータを読み込む関数
function loadFiltersFromStorage() {
    console.log("ストレージからフィルタデータの読み込みを開始します");

    if (isExtensionEnvironment()) {
        // 1. 同期ストレージから読み込みを試行
        chrome.storage.sync.get('filters', function(syncResult) {
            if (chrome.runtime.lastError) {
                console.error('同期ストレージの読み込みに失敗:', chrome.runtime.lastError);
                // エラーが発生した場合、ローカルストレージからの読み込みを試みる
                loadFiltersFromLocalAsFallback();
                return;
            }

            if (syncResult.filters && syncResult.filters.length > 0) {
                // 1-1. 同期ストレージにデータがあればそれを使用
                console.log('同期ストレージからフィルタを読み込みました。');
                handleLoadedData(syncResult.filters);
            } else {
                // 1-2. 同期ストレージにデータがない場合、ローカルストレージを確認
                console.log('同期ストレージにデータが見つかりません。ローカルストレージを確認します。');
                chrome.storage.local.get('filters', function(localResult) {
                    if (localResult.filters && localResult.filters.length > 0) {
                        // 2. ローカルストレージにデータがあれば、それを同期ストレージに移行
                        console.log('ローカルストレージからデータを検出し、同期ストレージへ移行します。');
                        
                        // データを同期ストレージに保存
                        chrome.storage.sync.set({ 'filters': localResult.filters }, function() {
                            if (chrome.runtime.lastError) {
                                console.error('ローカルから同期ストレージへのデータ移行に失敗:', chrome.runtime.lastError);
                            } else {
                                console.log('データ移行が成功しました。');
                                // 移行後、ローカルのデータを削除することも検討できますが、
                                // 安全のため、まずは残しておくことを推奨します。
                                // chrome.storage.local.remove('filters');
                            }
                        });
                        // 読み込んだローカルデータでUIを初期化
                        handleLoadedData(localResult.filters);
                    } else {
                        // 3. どちらにもデータがない場合、初期データを作成
                        console.log('ローカルストレージにもデータが見つかりません。初期フィルタを作成します。');
                        handleLoadedData(null); // handleLoadedData内で初期フィルタが作成される
                    }
                });
            }
        });
    } else {
        // 通常のWeb環境（開発時）のロジックは変更なし
        try {
            const savedData = localStorage.getItem('gmail_filters');
            const parsedData = savedData ? JSON.parse(savedData) : null;
            handleLoadedData(parsedData);
        } catch (e) {
            console.error('フィルタ設定の読み込みに失敗しました：', e);
            handleLoadedData(null);
        }
    }
}

// 同期ストレージの読み込みに失敗した場合のフォールバック関数
function loadFiltersFromLocalAsFallback() {
    console.warn('フォールバック：ローカルストレージからフィルタを読み込みます。');
    chrome.storage.local.get('filters', function (result) {
        if (result.filters) {
            console.log('フォールバック読み込み成功。');
            handleLoadedData(result.filters);
        } else {
            console.error('フォールバック読み込み失敗。初期データを作成します。');
            handleLoadedData(null);
        }
    });
}

// 右ペインの入力値の変更を現在のフィルタデータに反映させる関数
function updateCurrentFilterData() {
    console.log("Updating current filter data...");
    if (currentFilterIndex === -1 || !filters[currentFilterIndex]) {
        console.warn("No filter selected or filter data missing to update.");
        return; // フィルタが選択されていない場合やフィルタデータが存在しない場合は何もしない
    }

    const currentFilter = filters[currentFilterIndex];

    // フィルタ名入力欄の値を取得してデータに反映
    updateFilterName(currentFilter);

    // 条件項目のDOM要素からフィルタデータを更新
    updateFilterConditions(currentFilter);

    // アクション（処理）項目のDOM要素からフィルタデータを更新
    updateFilterActions(currentFilter);

    // 変更を保存
    scheduleSaveFilters();

    console.log("Updated filter data:", currentFilter);
}

// フィルタ名を更新する関数
function updateFilterName(currentFilter) {
    const filterNameInput = document.getElementById('filter-name-input');
    if (filterNameInput) {
        const newFilterName = filterNameInput.value.trim();
        currentFilter.name = newFilterName; // フィルタデータ自体は入力された通りに更新

        // フィルタ名の変更を左ペインのフィルタ一覧に直接反映
        const filterListUl = document.getElementById('filter-list');
        // data-filter-id を使って該当要素を特定
        const selectedItemButton = filterListUl.querySelector(`.item[data-filter-id="${currentFilter.id}"] button`);
        if (selectedItemButton) {
            // フィルタ名が空の場合はデフォルト名を表示
            selectedItemButton.textContent = currentFilter.name || chrome.i18n.getMessage('managerFilterListUnnamed');
            console.log(`Left pane filter name updated to: "${selectedItemButton.textContent}"`);
        }
    }
}

// 条件項目のDOM要素からフィルタデータを更新する関数
function updateFilterConditions(currentFilter) {
    document.querySelectorAll('.filter-condition-item').forEach(conditionItemElement => {
        const conditionType = conditionItemElement.dataset.conditionType;

        // AND/OR入力UIを持つ条件の場合
        const inputElement = conditionItemElement.querySelector('.app-form-input');
        const addAndButton = conditionItemElement.querySelector('.add-and-button');
        const addOrButton = conditionItemElement.querySelector('.add-or-button');
        const chipsDisplay = conditionItemElement.querySelector('.condition-chips-display');
        const inputAndButtonContainer = conditionItemElement.querySelector('.input-and-button-container');

        const hasAndOrElements = inputElement && addAndButton && addOrButton && chipsDisplay && inputAndButtonContainer;

        if (hasAndOrElements) {
            const conditionData = [];

            // 1. 入力フォーム内のチップと入力値からAND条件グループを構築（最初のORグループ）
            const currentAndGroup = [];

            // inputAndButtonContainer の子要素を順番に取得
            const inputContainerChildren = inputAndButtonContainer.childNodes;
            inputContainerChildren.forEach(child => {
                if (child.nodeType === Node.ELEMENT_NODE) { // 要素ノードの場合
                    if (child.classList.contains('chip')) {
                        const value = child.textContent.replace('✕', '').trim(); // チップのテキストから削除ボタンの✕を除去
                        if (child.classList.contains('address-chip')) {
                            currentAndGroup.push(value);
                        } else if (child.classList.contains('operator-chip') && value === 'AND') {
                            currentAndGroup.push('AND');
                        }
                    }
                } else if (child.nodeType === Node.TEXT_NODE) { // テキストノードの場合（入力フィールドの値）
                    const value = child.textContent.trim();
                    if (value !== '' && child === inputElement) { // 入力フィールド自体のテキストコンテンツ
                        // これは発生しないはずですが、念のため
                    }
                }
            });

            // 現在入力中のテキストをAND条件として追加
            const currentInputValue = inputElement.value.trim();
            if (currentInputValue !== '') {
                // 既存のチップがある場合、最後の要素がANDでなければANDを追加
                if (currentAndGroup.length > 0 && currentAndGroup[currentAndGroup.length - 1] !== 'AND') {
                    currentAndGroup.push('AND');
                }
                currentAndGroup.push(currentInputValue);
            }

            // 構築した最初のAND条件グループを conditionData に追加（ORグループの最初の要素）
            if (currentAndGroup.length > 0) {
                conditionData.push(currentAndGroup);
            }

            // 2. 下部のチップ表示エリア（chipsDisplay）からORグループを取得
            // chipsDisplay の子要素（ORインジケーターとORグループ）を順番に取得
            const displayChildren = chipsDisplay.childNodes;
            let currentOrGroup = null;

            displayChildren.forEach(child => {
                if (child.nodeType === Node.ELEMENT_NODE) { // 要素ノードの場合
                    if (child.classList.contains('or-group')) {
                        // 新しいORグループの開始
                        currentOrGroup = [];
                        // ORグループ内のチップを取得（削除ボタン以外）
                        const chips = child.querySelectorAll('.chip:not(.remove-or-group-button)');
                        chips.forEach(chip => {
                            const value = chip.textContent.trim();
                            if (chip.classList.contains('address-chip')) {
                                currentOrGroup.push(value);
                            } else if (chip.classList.contains('operator-chip') && value === 'AND') {
                                currentOrGroup.push('AND');
                            }
                        });
                        if (currentOrGroup.length > 0) {
                            // ORグループの最後に不要なANDが残っていれば削除
                            if (currentOrGroup[currentOrGroup.length - 1] === 'AND') {
                                currentOrGroup.pop();
                            }
                            conditionData.push(currentOrGroup);
                        }
                        currentOrGroup = null; // ORグループの処理完了
                    } else if (child.classList.contains('or-indicator')) {
                        // ORインジケーターはデータの区切りとして認識するが、データ構造には追加しない
                        // ここでは特に何もしなくても良い
                    }
                }
            });

            // 構築した条件データをフィルタデータに反映
            currentFilter.conditions[conditionType] = conditionData;
        } else if (conditionType === 'size') {
            // サイズ条件の状態を取得してデータに反映
            const sizeOperatorSelect = conditionItemElement.querySelector('#condition-size-operator');
            const sizeValueInput = conditionItemElement.querySelector('#condition-size-value-input');
            const sizeUnitSelect = conditionItemElement.querySelector('#condition-size-unit');
            if (sizeOperatorSelect && sizeValueInput && sizeUnitSelect) {
                currentFilter.conditions.size.operator = sizeOperatorSelect.value;
                currentFilter.conditions.size.value = parseInt(sizeValueInput.value, 10) || null; // 数値に変換、無効な場合はnull
                currentFilter.conditions.size.unit = sizeUnitSelect.value;
            }
        } else if (conditionType === 'has-attachment') {
            // 添付ファイルあり条件の状態を取得してデータに反映
            const hasAttachmentCheckbox = conditionItemElement.querySelector('#condition-has-attachment');
            if (hasAttachmentCheckbox) {
                currentFilter.conditions.hasAttachment = hasAttachmentCheckbox.checked;
            }
        }
    });
}

// フィルタアクション（処理）のDOM要素からフィルタデータを更新する関数
function updateFilterActions(currentFilter) {
    // 受信トレイをスキップ
    const skipInboxCheckbox = document.getElementById('process-skip-inbox');
    if (skipInboxCheckbox) {
        currentFilter.actions.skipInbox = skipInboxCheckbox.checked;
    }

    // 既読にする
    const markAsReadCheckbox = document.getElementById('process-mark-as-read');
    if (markAsReadCheckbox) {
        currentFilter.actions.markAsRead = markAsReadCheckbox.checked;
    }

    // スターを付ける
    const starCheckbox = document.getElementById('process-star');
    if (starCheckbox) {
        currentFilter.actions.star = starCheckbox.checked;
    }

    // ラベルを付ける
    const applyLabelCheckbox = document.getElementById('process-apply-label');
    const applyLabelInput = document.getElementById('process-label-name');
    if (applyLabelCheckbox && applyLabelInput) {
        currentFilter.actions.applyLabel.enabled = applyLabelCheckbox.checked;
        currentFilter.actions.applyLabel.labelName = applyLabelInput.value.trim();
    }

    // 転送する
    const forwardCheckbox = document.getElementById('process-forward');
    const forwardInput = document.getElementById('process-forward-address');
    if (forwardCheckbox && forwardInput) {
        currentFilter.actions.forward.enabled = forwardCheckbox.checked;
        currentFilter.actions.forward.forwardAddress = forwardInput.value.trim();
    }

    // 削除する
    const deleteCheckbox = document.getElementById('process-delete');
    if (deleteCheckbox) {
        currentFilter.actions.delete = deleteCheckbox.checked;

        // 削除機能が無効で、チェックがオンの場合の視覚的フィードバック
        if (currentFilter.actions.delete && !window.appSettings.enableDeleteAction) {
            const deleteLabel = deleteCheckbox.closest('label');
            if (deleteLabel) {
                deleteLabel.classList.add('warning-state');
            }
        } else {
            const deleteLabel = deleteCheckbox.closest('label');
            if (deleteLabel) {
                deleteLabel.classList.remove('warning-state');
            }
        }
    }

    // 迷惑メールにしない
    const notSpamCheckbox = document.getElementById('process-not-spam');
    if (notSpamCheckbox) {
        currentFilter.actions.notSpam = notSpamCheckbox.checked;
    }

    // 重要度設定
    const alwaysImportantCheckbox = document.getElementById('process-always-important');
    if (alwaysImportantCheckbox) {
        currentFilter.actions.alwaysImportant = alwaysImportantCheckbox.checked;
    }

    const neverImportantCheckbox = document.getElementById('process-never-important');
    if (neverImportantCheckbox) {
        currentFilter.actions.neverImportant = neverImportantCheckbox.checked;
    }

    // カテゴリ設定
    const applyCategoryCheckbox = document.getElementById('process-apply-category');
    const applyCategorySelect = document.getElementById('process-apply-category-select');
    if (applyCategoryCheckbox && applyCategorySelect) {
        currentFilter.actions.applyCategory.enabled = applyCategoryCheckbox.checked;

        // チェックボックスがオンの場合のみ値を保存
        if (applyCategoryCheckbox.checked) {
            currentFilter.actions.applyCategory.category = applyCategorySelect.value.trim();
        } else {
            // チェックがオフの場合は空に
            currentFilter.actions.applyCategory.category = '';
        }

        console.log(`カテゴリを設定: enabled=${applyCategoryCheckbox.checked}, category=${currentFilter.actions.applyCategory.category}`);
    }
}

// アプリ設定を保存する関数
function saveAppSettings() {
    if (isExtensionEnvironment()) {
        chrome.storage.sync.set({ 'appSettings': window.appSettings }, function () {
            if (chrome.runtime.lastError) {
                console.error('アプリ設定の同期ストレージへの保存に失敗:', chrome.runtime.lastError);
            } else {
                console.log('アプリ設定が保存されました（chrome.storage.sync）');
            }
        });
    } else {
        try {
            localStorage.setItem('gmail_filter_app_settings', JSON.stringify(window.appSettings));
            console.log('アプリ設定が保存されました（localStorage）');
        } catch (e) {
            console.error('アプリ設定の保存に失敗しました：', e);
        }
    }
}

// アプリ設定を読み込む
// 変更後
function loadAppSettings() {
    console.log("Loading app settings from storage.");
    if (isExtensionEnvironment()) {
        chrome.storage.sync.get('appSettings', function(syncResult) {
            if (chrome.runtime.lastError) {
                console.error('アプリ設定（sync）の読み込み失敗:', chrome.runtime.lastError);
                return;
            }

            if (syncResult.appSettings) {
                window.appSettings = syncResult.appSettings;
                console.log("App settings loaded from sync storage:", window.appSettings);
            } else {
                // 同期ストレージにない場合、ローカルから移行を試みる
                chrome.storage.local.get('appSettings', function(localResult) {
                    if (localResult.appSettings) {
                        console.log("ローカルからアプリ設定を検出し、同期ストレージへ移行します。");
                        window.appSettings = localResult.appSettings;
                        // 移行
                        saveAppSettings();
                    } else {
                        // どちらにもない場合はデフォルト設定を保存
                        console.log(chrome.i18n.getMessage('managerAppSettingsNotFound'));
                        saveAppSettings();
                    }
                });
            }
        });
    } else {
        // 開発環境のロジック
        const settings = localStorage.getItem('gmail_filter_app_settings');
        if (settings) {
            window.appSettings = JSON.parse(settings);
            console.log("App settings loaded from localStorage:", window.appSettings);
        } else {
            saveAppSettings();
        }
    }
}

//----------------------------------------------------------------------
// 4. UI表示/描画関連
//----------------------------------------------------------------------

// フィルタ一覧を更新する関数
function renderFilterList() {
    console.log("Rendering filter list...");
    const filterListUl = document.getElementById('filter-list');
    if (!filterListUl) {
        console.error("Filter list UL element not found!");
        return;
    }

    // 既存のフィルタ項目をクリア（「＋ フィルタを追加」ボタン以外）
    filterListUl.querySelectorAll('.item:not(#add-new-filter-item)').forEach(item => item.remove());

    // レンダリング前にIDの一意性をチェック
    const usedIds = new Set();
    let hasFixedIds = false;

    // filters 配列の各フィルタに対してリスト項目を作成
    filters.forEach((filter, index) => {
        // ID値のログと存在チェック
        console.log(`フィルタ #${index} ID: ${filter.id}, 名前: ${filter.name || "無題"}`);

        // IDがない、または既に使用されているIDの場合は新しいIDを生成
        if (!filter.id || usedIds.has(filter.id)) {
            const oldId = filter.id || '(未設定)';
            filter.id = Date.now().toString() + "_" + index + "_" +
                Math.random().toString(36).substring(2, 10);
            console.log(`ID重複または未設定を検出! "${oldId}" → 新ID "${filter.id}" を生成しました`);
            hasFixedIds = true;
        }

        // 使用済みIDとして記録
        usedIds.add(filter.id);

        const listItem = document.createElement('li');
        listItem.classList.add('item');

        // データ属性としてフィルタのIDとインデックスを保持
        listItem.dataset.filterId = filter.id;
        listItem.dataset.filterIndex = index;

        const button = document.createElement('button');
        button.textContent = filter.name || chrome.i18n.getMessage('managerFilterListUnnamed');
        button.classList.add('filter-list-button');
        button.type = 'button';

        // クリックイベントでフィルタを選択状態にする
        button.addEventListener('click', () => {
            selectFilterById(filter.id);
        });

        // ドラッグハンドルを追加（右側に配置）
        const dragHandle = document.createElement('span');
        dragHandle.classList.add('drag-handle');
        dragHandle.innerHTML = '&#8942;&#8942;'; // 縦に並んだ6点（2つの縦3点リーダー）

        // 現在選択されているフィルタであれば、アクティブなスタイルを適用
        if (currentFilterIndex !== -1 &&
            currentFilterIndex < filters.length &&
            filter.id === filters[currentFilterIndex].id) {
            listItem.classList.add('active');
        }

        // 子要素を追加（ボタンが先、ドラッグハンドルが後）
        listItem.appendChild(button);
        listItem.appendChild(dragHandle);

        // 「＋ フィルタを追加」ボタンの li 要素の前に挿入
        const addNewFilterItem = filterListUl.querySelector('#add-new-filter-item');
        if (addNewFilterItem) {
            addNewFilterItem.before(listItem);
        } else {
            filterListUl.appendChild(listItem);
        }
    });

    // IDを修正した場合はストレージに保存
    if (hasFixedIds) {
        console.log("フィルタIDを修正したため、変更を保存します");
        saveFiltersToStorage();
    }

    console.log("Filter list rendering complete.");
}

// 選択されたフィルタのデータを右ペインに表示する関数
function displayFilterDetails(filter) {
    console.log("Displaying filter details:", filter);
    // 右ペインの要素をクリアする処理 (元のコードのまま)
    const filterNameInput = document.getElementById('filter-name-input');

    // フィルタ名入力欄の表示制御
    if (filterNameInput) {
        // フィルタデータが存在し、かつフィルタ名がデフォルト値の場合は空欄にする
        // "無題のフィルタ" を多言語化キーで比較
        if (filter && filter.name === chrome.i18n.getMessage('managerFilterListUnnamed')) { // ★ 多言語化 ★
            filterNameInput.value = ''; // 空文字列を設定
            console.log("Filter name is default, showing placeholder.");
        } else {
            // それ以外のフィルタ名の場合はその値を設定
            filterNameInput.value = filter ? filter.name : '';
            if (filter) {
                console.log(`Displaying filter name: "${filter.name}"`);
            }
        }
    }

    // フィルタデータがない場合の処理 (元のコードのまま)
    if (!filter) {
        console.warn("No filter data to display.");
        // フィルタデータがない場合は条件表示エリアも非表示にする (元のコードのまま)
        document.querySelectorAll('.filter-condition-item').forEach(conditionItemElement => {
            updateDisplayVisibilityOfCondition(conditionItemElement); // Assuming this function exists
        });
        // フィルタ名入力欄もクリア（既に上で処理済みですが念のため） (元のコードのまま)
        if (filterNameInput) {
            filterNameInput.value = '';
        }

        // フィルタデータがない場合もUIの状態を更新する必要があるかもしれないので、ここで呼び出す
        // 例: 削除機能が無効なら、フィルタがない状態でも削除関連UIは無効のまま表示されるべき場合など
        if (typeof updateUIBasedOnSettings === 'function') {
            updateUIBasedOnSettings(); // ★ フィルタがない場合も呼び出す ★
        } else {
            console.error("updateUIBasedOnSettings function not found!");
        }

        return; // フィルタデータがない場合はここで終了 (元のコードのまま)
    }

    // 全ての入力要素をクリア (Assuming this function exists)
    clearAllInputElements();

    // フィルタ名入力欄にデータを反映 (この部分は上の filterNameInput 制御と重複しているように見えるが、元のコードを維持)
    if (filterNameInput) {
        filterNameInput.value = filter.name;
    }

    // 各フィルタ条件のデータを右ペインに反映 (Assuming these functions exist)
    renderCondition('from', filter.conditions.from);
    renderCondition('to', filter.conditions.to);
    renderCondition('subject', filter.conditions.subject);
    renderCondition('includes', filter.conditions.includes);
    renderCondition('excludes', filter.conditions.excludes);

    // サイズ条件の反映 (元のコードのまま)
    const sizeOperatorSelect = document.getElementById('condition-size-operator');
    const sizeValueInput = document.getElementById('condition-size-value-input');
    const sizeUnitSelect = document.getElementById('condition-size-unit');
    if (sizeOperatorSelect && sizeValueInput && sizeUnitSelect) {
        sizeOperatorSelect.value = filter.conditions.size.operator;
        sizeValueInput.value = filter.conditions.size.value !== null ? filter.conditions.size.value : '';
        sizeUnitSelect.value = filter.conditions.size.unit;
    }

    // 添付ファイルあり条件の反映 (元のコードのまま)
    const hasAttachmentCheckbox = document.getElementById('condition-has-attachment');
    if (hasAttachmentCheckbox) {
        hasAttachmentCheckbox.checked = filter.conditions.hasAttachment;
    }

    // フィルタ処理（アクション）のデータを反映 (Assuming this function exists and populates action UI)
    displayFilterActions(filter); // <-- この関数がアクションUIを生成/更新するはずです

    // ★★★ ここに updateUIBasedOnSettings() の呼び出しを追加 ★★★
    // displayFilterActions が完了し、削除チェックボックスがDOMにある後に実行
    if (typeof updateUIBasedOnSettings === 'function') {
        updateUIBasedOnSettings(); // ★ フィルタデータがある場合に呼び出す ★
    } else {
        console.error("updateUIBasedOnSettings function not found!");
    }


    console.log("Filter details displayed."); // このログがあればその直前に追加
}

// 全ての入力要素をクリアする関数
function clearAllInputElements() {
    // 各条件入力エリアのチップと入力フィールドをクリア
    document.querySelectorAll('.filter-condition-item').forEach(conditionItemElement => {
        const chipsDisplay = conditionItemElement.querySelector('.condition-chips-display');
        const inputAndButtonContainer = conditionItemElement.querySelector('.input-and-button-container');
        const inputElement = conditionItemElement.querySelector('.app-form-input');

        if (chipsDisplay) chipsDisplay.innerHTML = '';
        if (inputAndButtonContainer) inputAndButtonContainer.querySelectorAll('.chip').forEach(chip => chip.remove());
        if (inputElement) inputElement.value = '';

        // OR接続テキストも非表示に戻す
        const orConnector = conditionItemElement.querySelector('.condition-or-connector');
        if (orConnector) orConnector.style.display = 'none';
    });

    // フィルタ処理のチェックボックス、入力欄、プルダウンをデフォルト状態に戻す
    document.querySelectorAll('.filter-process-item input[type="checkbox"]').forEach(checkbox => checkbox.checked = false);
    document.querySelectorAll('.filter-process-item input[type="text"]').forEach(input => {
        input.value = '';
        input.disabled = true;
    });
    document.querySelectorAll('.filter-process-item select').forEach(select => {
        select.value = '';
        select.disabled = true;
    });
}

// フィルタアクション（処理）のデータを右ペインに反映する関数
function displayFilterActions(filter) {
    const actions = filter.actions;

    // 受信トレイをスキップ
    const skipInboxCheckbox = document.getElementById('process-skip-inbox');
    if (skipInboxCheckbox) {
        skipInboxCheckbox.checked = actions.skipInbox;
    }

    // 既読にする
    const markAsReadCheckbox = document.getElementById('process-mark-as-read');
    if (markAsReadCheckbox) {
        markAsReadCheckbox.checked = actions.markAsRead;
    }

    // スターを付ける
    const starCheckbox = document.getElementById('process-star');
    if (starCheckbox) {
        starCheckbox.checked = actions.star;
    }

    // ラベルを付ける
    const applyLabelCheckbox = document.getElementById('process-apply-label');
    const applyLabelInput = document.getElementById('process-label-name');
    if (applyLabelCheckbox && applyLabelInput) {
        applyLabelCheckbox.checked = actions.applyLabel.enabled;
        applyLabelInput.value = actions.applyLabel.labelName;
        applyLabelInput.disabled = !actions.applyLabel.enabled;
    }

    // 転送する
    const forwardCheckbox = document.getElementById('process-forward');
    const forwardInput = document.getElementById('process-forward-address');
    if (forwardCheckbox && forwardInput) {
        forwardCheckbox.checked = actions.forward.enabled;
        forwardInput.value = actions.forward.forwardAddress;
        forwardInput.disabled = !actions.forward.enabled;
    }

    // 削除する
    const deleteCheckbox = document.getElementById('process-delete');
    if (deleteCheckbox) {
        deleteCheckbox.checked = actions.delete;
    }

    // 迷惑メールにしない
    const notSpamCheckbox = document.getElementById('process-not-spam');
    if (notSpamCheckbox) {
        notSpamCheckbox.checked = actions.notSpam;
    }

    // 常に重要マークを付ける
    const alwaysImportantCheckbox = document.getElementById('process-always-important');
    if (alwaysImportantCheckbox) {
        alwaysImportantCheckbox.checked = actions.alwaysImportant;
    }

    // 重要マークを付けない
    const neverImportantCheckbox = document.getElementById('process-never-important');
    if (neverImportantCheckbox) {
        neverImportantCheckbox.checked = actions.neverImportant;
    }

    // カテゴリを適用
    const applyCategoryCheckbox = document.getElementById('process-apply-category');
    const applyCategorySelect = document.getElementById('process-apply-category-select');
    if (applyCategoryCheckbox && applyCategorySelect) {
        applyCategoryCheckbox.checked = actions.applyCategory.enabled;

        if (actions.applyCategory.category) {
            applyCategorySelect.value = actions.applyCategory.category;
        } else {
            applyCategorySelect.value = '';
        }

        applyCategorySelect.disabled = !actions.applyCategory.enabled;

        console.log(`カテゴリを表示: enabled=${applyCategoryCheckbox.checked}, category=${applyCategorySelect.value}`);
    }
}

// フィルタデータの conditions 部分を右ペインの条件入力エリアのチップ表示に反映する関数
function renderCondition(conditionType, conditionData) {
    console.log(`Rendering condition: ${conditionType}`, conditionData);
    const conditionItemElement = document.querySelector(`.filter-condition-item[data-condition-type="${conditionType}"]`);
    if (!conditionItemElement) {
        console.warn(`Condition item element not found for type: ${conditionType}.`);
        return;
    }

    const chipsDisplay = conditionItemElement.querySelector('.condition-chips-display');
    const inputAndButtonContainer = conditionItemElement.querySelector('.input-and-button-container');
    const inputElement = conditionItemElement.querySelector('.app-form-input');

    // 既存のチップ表示と入力フォームを全てクリア
    if (chipsDisplay) {
        console.log('Clearing chips display.');
        chipsDisplay.innerHTML = '';
    }
    if (inputAndButtonContainer) {
        console.log('Clearing input form chips.');
        inputAndButtonContainer.querySelectorAll('.chip').forEach(chip => chip.remove());
    }
    if (inputElement) {
        console.log('Clearing input element value.');
        inputElement.value = '';
    }

    // OR接続テキストも非表示に戻す
    const orConnector = conditionItemElement.querySelector('.condition-or-connector');
    if (orConnector) orConnector.style.display = 'none';

    if (!conditionData || conditionData.length === 0) {
        // データがない場合は表示エリアを非表示にする
        updateDisplayVisibilityOfCondition(conditionItemElement);
        return;
    }

    // conditionData (Array<Array<string>>) を解析し、チップを生成して配置
    conditionData.forEach((orGroup, orIndex) => {
        // 最初のORグループの場合
        if (orIndex === 0) {
            renderFirstOrGroup(orGroup, inputElement);
        } else {
            // 2番目以降のORグループの場合
            renderAdditionalOrGroup(orGroup, chipsDisplay);
        }
    });

    // 表示エリアの表示/非表示を更新
    updateDisplayVisibilityOfCondition(conditionItemElement);
    console.log(`Finished rendering condition: ${conditionType}`);
}

// 最初のORグループを入力フォームに表示する関数
function renderFirstOrGroup(orGroup, inputElement) {
    if (orGroup.length > 0) {
        const lastValue = orGroup[orGroup.length - 1]; // 最後の要素を取得

        // 最後の要素を入力フォームに設定
        if (inputElement) {
            inputElement.value = lastValue;
        }

        // 最後の要素より前の要素を入力フォーム内のチップとして追加
        for (let i = 0; i < orGroup.length - 1; i++) {
            const item = orGroup[i];
            if (item === 'AND') {
                const operatorChip = createChip('AND', 'operator-chip');
                if (inputElement) inputElement.before(operatorChip);
            } else {
                const valueChip = createChip(item, 'address-chip');
                addRemoveButtonToInputChip(valueChip);
                if (inputElement) inputElement.before(valueChip);
            }
        }
    }
}

// 2番目以降のORグループを下部表示エリアに表示する関数
function renderAdditionalOrGroup(orGroup, chipsDisplay) {
    if (chipsDisplay) {
        // 既存のORグループが存在する場合のみ、ORインジケーターを追加
        if (chipsDisplay.querySelectorAll('.or-group').length > 0) {
            const orIndicator = createOrGroupIndicator();
            chipsDisplay.appendChild(orIndicator);
        }

        // ORグループ全体のコンテナを作成
        const orGroupContainer = document.createElement('div');
        orGroupContainer.classList.add('or-group');

        orGroup.forEach(item => {
            if (item === 'AND') {
                // AND演算子チップ
                const operatorChip = createChip('AND', 'operator-chip');
                orGroupContainer.appendChild(operatorChip);
            } else {
                // 値チップ
                const valueChip = createChip(item, 'address-chip');
                orGroupContainer.appendChild(valueChip);
            }
        });

        // ORグループ削除ボタンを追加
        const orGroupRemoveButton = createOrGroupRemoveButton();
        orGroupContainer.appendChild(orGroupRemoveButton);

        // ORグループコンテナを下部表示エリアに追加
        chipsDisplay.appendChild(orGroupContainer);
    }
}

// 条件項目の表示/非表示を更新するヘルパー関数
function updateDisplayVisibilityOfCondition(conditionItemElement) {
    const chipsDisplay = conditionItemElement.querySelector('.condition-chips-display');
    const orConnector = conditionItemElement.querySelector('.condition-or-connector');

    // AND/OR入力UIがない条件項目では、表示制御は不要
    const inputElement = conditionItemElement.querySelector('.app-form-input');
    const addAndButton = conditionItemElement.querySelector('.add-and-button');
    const addOrButton = conditionItemElement.querySelector('.add-or-button');
    const inputAndButtonContainer = conditionItemElement.querySelector('.input-and-button-container');
    const hasAndOrElements = inputElement && addAndButton && addOrButton && chipsDisplay && inputAndButtonContainer;

    if (!hasAndOrElements) {
        return;
    }

    if (chipsDisplay) {
        const orGroupCount = chipsDisplay.querySelectorAll('.or-group').length;
        if (orGroupCount === 0) {
            chipsDisplay.style.display = 'none';
            if (orConnector) {
                orConnector.style.display = 'none';
            }
        } else {
            chipsDisplay.style.display = 'flex';
            if (orConnector) {
                orConnector.style.display = 'block';
            }
        }
    }
}

// 削除ボタンの状態を更新する関数
function updateDeleteButtonState() {
    const deleteFilterButton = document.getElementById('delete-this-filter');
    if (deleteFilterButton) {
        // フィルタが1件以下の場合は削除ボタンを無効化
        if (filters.length <= 1) {
            deleteFilterButton.disabled = true;
            // ツールチップを多言語化
            deleteFilterButton.title = chrome.i18n.getMessage('managerActionDeleteTooltip');
            deleteFilterButton.classList.add('disabled-button');
        } else {
            deleteFilterButton.disabled = false;
            // ツールチップを多言語化
            deleteFilterButton.title = chrome.i18n.getMessage('managerActionDelete');
            deleteFilterButton.classList.remove('disabled-button');
        }
    }
}


// フィルタリストを最下部にスクロールする関数
function scrollFilterListToBottom() {
    const filterListContainer = document.querySelector('.filter-list .items');
    if (filterListContainer) {
        // スムーズなスクロールでリストの最下部に移動
        filterListContainer.scrollTo({
            top: filterListContainer.scrollHeight,
            behavior: 'smooth'
        });

        console.log("Scrolled filter list to bottom");
    }
}

// 設定に基づいてUIを更新する関数
function updateUIBasedOnSettings() {
    // 削除チェックボックスの状態を更新
    // チェックボックスのIDが 'process-delete' である前提
    const deleteCheckbox = document.getElementById('process-delete');
    if (deleteCheckbox) {
        // 削除機能が無効なら、チェックボックスを無効化
        // window.appSettings がグローバルに定義されている前提
        deleteCheckbox.disabled = !window.appSettings.enableDeleteAction;

        // 削除アクションのラベルスタイルを更新
        const deleteLabel = deleteCheckbox.closest('label');
        if (deleteLabel) {
            if (!window.appSettings.enableDeleteAction) { // ★ window.appSettings を参照 ★
                deleteLabel.classList.add('disabled-action');
                // 無効時の説明を追加
                // クラス名 'info-text' のspan要素を探す前提
                let infoSpan = deleteLabel.querySelector('.info-text');
                if (!infoSpan) {
                    infoSpan = document.createElement('span');
                    infoSpan.className = 'info-text'; // 元のクラス名を使用
                    infoSpan.style.marginLeft = '10px'; // スタイルも元のコードに合わせる
                    infoSpan.style.fontSize = '0.8em'; // スタイルも元のコードに合わせる
                    infoSpan.style.color = '#888'; // スタイルも元のコードに合わせる
                    deleteLabel.appendChild(infoSpan); // ラベル要素の子要素として追加
                }
                // 説明テキストを多言語化
                infoSpan.textContent = chrome.i18n.getMessage('managerProcessDeleteDisabledInfo'); // ★ 多言語化 ★

            } else {
                deleteLabel.classList.remove('disabled-action');
                // 有効時は説明を削除
                const infoSpan = deleteLabel.querySelector('.info-text'); // クラス名 'info-text' のspan要素を探す
                if (infoSpan) {
                    infoSpan.remove();
                }
            }
        }
    }
    // updateDeleteButtonState 関数を呼び出して、左側の削除ボタンの状態も更新
    updateDeleteButtonState(); // この関数が manager.js 内に定義されている前提
}

//----------------------------------------------------------------------
// 5. イベントハンドラと機能実装
//----------------------------------------------------------------------

// フィルタを選択し、右ペインに表示する関数 (IDで選択)
function selectFilterById(filterId) {
    console.log(`Attempting to select filter with ID: ${filterId}`);
    const index = filters.findIndex(filter => filter.id === filterId);
    if (index !== -1) {
        selectFilter(index);
    } else {
        console.error(`Filter with ID ${filterId} not found.`);
        // 見つからなかった場合は、選択状態を解除する
        currentFilterIndex = -1;
        renderFilterList(); // 選択状態解除を反映
        displayFilterDetails(null); // 右ペインをクリアする
    }
}

// フィルタを選択し、右ペインに表示する関数 (インデックスで選択)
function selectFilter(index) {
    console.log(`Selecting filter by index: ${index}`);

    // インデックスが範囲外の場合は調整
    if (index < 0 || index >= filters.length) {
        if (filters.length > 0) {
            // 有効な範囲内の最大値に調整
            index = Math.min(Math.max(0, index), filters.length - 1);
        } else {
            currentFilterIndex = -1;
            displayFilterDetails(null);
            return;
        }
    }

    // 既存の選択状態を解除
    const filterListUl = document.getElementById('filter-list');
    if (filterListUl) {
        filterListUl.querySelectorAll('.item').forEach(item => item.classList.remove('active'));
    }

    // 選択状態を設定
    currentFilterIndex = index;
    const selectedItem = filterListUl.querySelector(`.item[data-filter-index="${index}"]`);
    if (selectedItem) {
        selectedItem.classList.add('active');
    }

    // 選択されたフィルタのデータを右ペインに表示する前にチェック
    if (currentFilterIndex >= 0 && currentFilterIndex < filters.length) {
        displayFilterDetails(filters[currentFilterIndex]);
    } else {
        displayFilterDetails(null);
    }

    // 選択されたフィルタのデータを右ペインに表示する
    displayFilterDetails(filters[currentFilterIndex]);

    console.log(`Selected filter index: ${currentFilterIndex}`);

    // 削除ボタンの状態を更新
    updateDeleteButtonState();
}

// フィルタの処理を複製する関数
function duplicateCurrentProcess() {
    console.log("Attempting to duplicate current filter.");
    if (currentFilterIndex === -1) {
        console.warn("No filter selected to duplicate.");
        return; // 選択されているフィルタがない場合は何もしない
    }

    const originalFilter = filters[currentFilterIndex];

    // 新しいフィルタ作成時の conditions の初期値を定義
    // これを複製したフィルタの conditions に適用する
    const initialConditionsForNewFilter = {
        from: [],
        to: [],
        subject: [],
        includes: [],
        excludes: [],
        size: {
            operator: 'larger_than', // デフォルト値
            value: null,
            unit: 's_smb' // デフォルト値
        },
        hasAttachment: false
    };

    // フィルタデータのディープコピーを作成
    const duplicatedFilter = {
        id: Date.now().toString(),  // 新しい一意なIDを生成
        name: `${originalFilter.name} (Copied)`, // 名前に "(コピー)" を追加
        conditions: JSON.parse(JSON.stringify(initialConditionsForNewFilter)), // conditionsをディープコピーして初期状態にリセット
        actions: JSON.parse(JSON.stringify(originalFilter.actions || {})), // originalFilterからactionsをディープコピー
    }

    console.log("Original filter:", originalFilter);
    console.log("Duplicated filter:", duplicatedFilter);

    // 複製したフィルタを filters 配列に追加
    filters.push(duplicatedFilter);

    console.log("Duplicated filter added. Current filters:", filters);

    // フィルタ一覧を再描画
    renderFilterList();

    // 複製されたフィルタを選択状態にする
    selectFilterById(duplicatedFilter.id);

    console.log("Filter duplicated and new filter selected.");

    // 変更を保存
    saveFiltersToStorage();
}

// フィルタを複製する関数
function duplicateCurrentFilter() {
    console.log("Attempting to duplicate current filter.");
    if (currentFilterIndex === -1) {
        console.warn("No filter selected to duplicate.");
        return; // 選択されているフィルタがない場合は何もしない
    }

    const originalFilter = filters[currentFilterIndex];

    // フィルタデータのディープコピーを作成
    const duplicatedFilter = JSON.parse(JSON.stringify(originalFilter));

    // 複製したフィルタに新しいIDと名前を設定
    duplicatedFilter.id = Date.now().toString(); // 新しい一意なIDを生成
    duplicatedFilter.name = `${originalFilter.name} (Copied)`; // 名前に "(コピー)" を追加

    console.log("Original filter:", originalFilter);
    console.log("Duplicated filter:", duplicatedFilter);

    // 複製したフィルタを filters 配列に追加
    filters.push(duplicatedFilter);

    console.log("Duplicated filter added. Current filters:", filters);

    // フィルタ一覧を再描画
    renderFilterList();

    // 複製されたフィルタを選択状態にする
    selectFilterById(duplicatedFilter.id);

    console.log("Filter duplicated and new filter selected.");

    // 変更を保存
    saveFiltersToStorage();
}

// フィルタを削除する関数
function deleteCurrentFilter() {
    console.log("Attempting to delete current filter.");
    if (currentFilterIndex === -1) {
        console.warn("No filter selected to delete.");
        return; // 選択されているフィルタがない場合は何もしない
    }

    // フィルタが1件しかない場合は処理を中断
    if (filters.length <= 1) {
        console.warn("Cannot delete the last filter.");
        return;
    }

    // 確認ダイアログを表示
    const filterName = filters[currentFilterIndex].name;
    const isConfirmed = confirm(`フィルタ "${filterName}" を削除してもよろしいですか？\nこの操作は元に戻せません。`);

    if (!isConfirmed) {
        console.log("Filter deletion cancelled by user.");
        return; // ユーザーがキャンセルした場合
    }

    // ここで削除後に選択するインデックスを先に計算しておく
    const deleteIndex = currentFilterIndex;
    const newIndexToSelect = Math.min(currentFilterIndex, filters.length - 2);

    // 選択状態をクリアしてから削除する - この順番が重要！
    currentFilterIndex = -1;

    console.log(`Deleting filter at index: ${deleteIndex}`);
    filters.splice(deleteIndex, 1);
    console.log("Filter deleted. Remaining filters:", filters);

    // レンダリング（この時点でcurrentFilterIndex = -1なのでエラーは起きない）
    renderFilterList();

    // 削除後の選択状態を決定
    if (filters.length === 0) {
        displayFilterDetails(null);
        console.log("All filters deleted. Right pane cleared.");
    } else {
        selectFilter(newIndexToSelect);
        console.log(`Filter deleted. Selecting filter at new index: ${newIndexToSelect}`);
    }

    // 削除ボタンの状態を更新
    updateDeleteButtonState();

    // 変更を保存
    saveFiltersToStorage();
}

// フィルタリストのドラッグ＆ドロップソート機能を設定する関数
function setupFilterListSorting() {
    const filterListUl = document.getElementById('filter-list');
    if (!filterListUl) {
        console.error("Filter list UL element not found for sorting!");
        return;
    }

    // Sortable.jsライブラリが読み込まれているか確認
    if (typeof Sortable !== 'undefined') {
        console.log("Initializing Sortable.js for filter list");

        new Sortable(filterListUl, {
            animation: 150,
            handle: '.drag-handle', // ドラッグハンドルのみドラッグ可能に
            draggable: '.item:not(#add-new-filter-item)', // 「＋ フィルタを追加」ボタン以外をドラッグ可能に
            filter: '.filter-list-button', // ボタン自体はドラッグの開始エリアとしない
            onStart: function (evt) {
                console.log("Drag started", evt);
            },
            onEnd: function (evt) {
                console.log("Drag ended", evt);
                // ドラッグ終了時に配列の順序を更新
                const oldIndex = evt.oldIndex;
                const newIndex = evt.newIndex;

                console.log(`Moving filter from index ${oldIndex} to ${newIndex}`);

                // 配列の順序を更新
                reorderFilters(oldIndex, newIndex);
            }
        });

        console.log("Sortable.js initialized for filter list");
    } else {
        console.warn('Sortable.js not loaded - drag & drop ordering unavailable');
    }
}

// filters配列の順序を更新する関数
function reorderFilters(oldIndex, newIndex) {
    console.log(`Reordering filters: ${oldIndex} -> ${newIndex}`);

    // 範囲チェック
    if (oldIndex >= filters.length || newIndex >= filters.length || oldIndex < 0 || newIndex < 0) {
        console.error(`Invalid indices for reordering: oldIndex=${oldIndex}, newIndex=${newIndex}, filters.length=${filters.length}`);
        return;
    }

    // 現在選択中のフィルタのIDを保存
    const currentFilterId = filters[currentFilterIndex]?.id;
    console.log(`Current active filter ID before reordering: ${currentFilterId}`);

    // 配列の要素を移動
    const movedFilter = filters.splice(oldIndex, 1)[0];
    filters.splice(newIndex, 0, movedFilter);

    console.log("Filters after reordering:", filters.map(f => `${f.id}:${f.name || "無題"}`));

    // currentFilterIndexを更新（IDで一致するフィルタを検索）
    if (currentFilterId) {
        const newIndex = filters.findIndex(filter => filter.id === currentFilterId);
        if (newIndex !== -1) {
            currentFilterIndex = newIndex;
            console.log(`Updated currentFilterIndex to ${currentFilterIndex} for filter ID ${currentFilterId}`);
        }
    }

    // 新しい順序でフィルタ一覧を再描画
    renderFilterList();

    console.log("Filters reordered successfully");

    // 変更を保存
    saveFiltersToStorage();
}

// 各条件項目にロジックを設定する関数
function setupConditionItem(conditionItemElement) {
    const inputElement = conditionItemElement.querySelector('.app-form-input');
    const addAndButton = conditionItemElement.querySelector('.add-and-button');
    const addOrButton = conditionItemElement.querySelector('.add-or-button');
    const chipsDisplay = conditionItemElement.querySelector('.condition-chips-display');
    const orConnector = conditionItemElement.querySelector('.condition-or-connector');
    const inputAndButtonContainer = conditionItemElement.querySelector('.input-and-button-container');

    const conditionType = conditionItemElement.dataset.conditionType;
    console.log(`Setting up logic for condition type: ${conditionType}`);

    // この条件項目がAND/OR入力UIを持つかどうかの判定に必要な要素
    const hasAndOrElements = inputElement && addAndButton && addOrButton && chipsDisplay && inputAndButtonContainer;

    // +OR ボタンのイベントリスナー設定
    setupOrButtonListener(addOrButton, inputElement, chipsDisplay, inputAndButtonContainer, conditionType, hasAndOrElements);

    // +AND ボタンのイベントリスナー設定
    setupAndButtonListener(addAndButton, inputElement, inputAndButtonContainer, conditionType, hasAndOrElements);

    // 入力フォーム内のチップ削除ボタンのイベントリスナー設定
    setupChipRemoveListener(inputAndButtonContainer, conditionType);

    // ORグループ削除ボタンのイベントリスナー設定
    setupOrGroupRemoveListener(chipsDisplay, conditionType);

    // 条件入力要素の変更イベントリスナー設定
    setupConditionChangeListeners(conditionItemElement, conditionType, hasAndOrElements, inputElement);

    // 初期表示状態を設定
    if (hasAndOrElements) {
        updateDisplayVisibilityOfCondition(conditionItemElement);
    }
}

// +OR ボタンのイベントリスナー設定
function setupOrButtonListener(addOrButton, inputElement, chipsDisplay, inputAndButtonContainer, conditionType, hasAndOrElements) {
    if (addOrButton && inputElement && chipsDisplay && inputAndButtonContainer && hasAndOrElements) {
        addOrButton.addEventListener('click', () => {
            const currentInput = inputElement.value.trim();
            const confirmedChips = inputAndButtonContainer.querySelectorAll('.chip');

            if (confirmedChips.length === 0 && currentInput === '') {
                console.log(`${conditionType}: Input form is empty, not adding OR condition.`);
                return;
            }

            // 入力フォーム内のチップと入力値をまとめて一つのAND条件グループとして取得
            const currentAndGroup = collectInputFormAndGroup(inputAndButtonContainer, inputElement);

            // 確定したAND条件グループを下部表示エリアに新しいORグループとして追加
            if (currentAndGroup.length > 0) {
                addOrGroupToDisplayArea(chipsDisplay, currentAndGroup);

                // 入力フォーム内をクリア
                clearInputForm(inputAndButtonContainer, inputElement);

                // OR条件が追加されたらフィルタデータを更新
                updateCurrentFilterData();

                console.log(`${conditionType}: OR condition added to display area.`);
            }
        });
    } else {
        console.log(`OR button or related elements not found for ${conditionType}. Skipping OR listener setup.`);
    }
}

// 入力フォーム内のAND条件グループを収集する関数
function collectInputFormAndGroup(inputAndButtonContainer, inputElement) {
    const currentAndGroup = [];
    // inputAndButtonContainer の子要素を順番に取得
    const inputContainerChildren = inputAndButtonContainer.childNodes;

    inputContainerChildren.forEach(child => {
        if (child.nodeType === Node.ELEMENT_NODE && child.classList.contains('chip')) {
            const value = child.textContent.replace('✕', '').trim();
            if (child.classList.contains('address-chip')) {
                currentAndGroup.push(value);
            } else if (child.classList.contains('operator-chip') && value === 'AND') {
                currentAndGroup.push('AND');
            }
        }
    });

    const currentInputValue = inputElement.value.trim();
    if (currentInputValue !== '') {
        if (currentAndGroup.length > 0 && currentAndGroup[currentAndGroup.length - 1] !== 'AND') {
            currentAndGroup.push('AND');
        }
        currentAndGroup.push(currentInputValue);
    }

    // 最後のANDを削除
    if (currentAndGroup.length > 0 && currentAndGroup[currentAndGroup.length - 1] === 'AND') {
        currentAndGroup.pop();
    }

    return currentAndGroup;
}

// ORグループを下部表示エリアに追加する関数
function addOrGroupToDisplayArea(chipsDisplay, andGroup) {
    const conditionItemElement = chipsDisplay.closest('.filter-condition-item');
    const orConnector = conditionItemElement.querySelector('.condition-or-connector');

    // 既存のORグループが存在する場合のみ、ORインジケーターを追加
    if (chipsDisplay.querySelectorAll('.or-group').length > 0) {
        const orIndicator = createOrGroupIndicator();
        chipsDisplay.appendChild(orIndicator);
    }

    // ORグループ全体のコンテナを作成
    const orGroupContainer = document.createElement('div');
    orGroupContainer.classList.add('or-group');

    // ANDグループの各要素をORグループに追加
    andGroup.forEach(item => {
        if (item === 'AND') {
            const operatorChip = createChip('AND', 'operator-chip');
            orGroupContainer.appendChild(operatorChip);
        } else {
            const valueChip = createChip(item, 'address-chip');
            orGroupContainer.appendChild(valueChip);
        }
    });

    // ORグループ削除ボタンを追加
    const orGroupRemoveButton = createOrGroupRemoveButton();
    orGroupContainer.appendChild(orGroupRemoveButton);

    // ORグループコンテナを下部表示エリアに追加
    chipsDisplay.appendChild(orGroupContainer);

    // 表示状態を更新（OR接続テキストも含む）
    const orGroupCount = chipsDisplay.querySelectorAll('.or-group').length;
    if (orGroupCount > 0) {
        chipsDisplay.style.display = 'flex';
        if (orConnector) {
            orConnector.style.display = 'block';
        }
    } else {
        chipsDisplay.style.display = 'none';
        if (orConnector) {
            orConnector.style.display = 'none';
        }
    }
}

// 入力フォームをクリアする関数
function clearInputForm(inputAndButtonContainer, inputElement) {
    inputAndButtonContainer.querySelectorAll('.chip').forEach(chip => chip.remove());
    inputElement.value = '';
}

// +AND ボタンのイベントリスナー設定
function setupAndButtonListener(addAndButton, inputElement, inputAndButtonContainer, conditionType, hasAndOrElements) {
    if (addAndButton && inputElement && inputAndButtonContainer && hasAndOrElements) {
        addAndButton.addEventListener('click', () => {
            const value = inputElement.value.trim(); // 入力された値を取得
            if (value) {
                // 入力フォーム内でのAND条件追加ロジック
                const existingChips = inputAndButtonContainer.querySelectorAll('.chip');

                // 既存のチップが1つ以上あり、かつ最後のチップがAND演算子でない場合にAND演算子を追加
                if (existingChips.length > 0 && !existingChips[existingChips.length - 1].classList.contains('operator-chip')) {
                    const operatorChip = createChip('AND', 'operator-chip'); // AND演算子チップを作成
                    inputElement.before(operatorChip); // 入力フィールドの直前にANDチップを挿入
                }

                // 新しい値のチップを作成（入力フォーム内用は削除ボタン付き）
                const valueChip = createChip(value, 'address-chip');
                addRemoveButtonToInputChip(valueChip); // 削除ボタンを追加

                // 入力フィールドの直前に新しい値のチップを挿入
                inputElement.before(valueChip);

                // 入力フィールドの値はクリアする
                inputElement.value = '';

                // AND条件が追加されたらフィルタデータを更新
                updateCurrentFilterData();

                console.log(`${conditionType}: AND condition added within the input form.`);
            }
        });
    } else {
        console.log(`AND button or related elements not found for ${conditionType}. Skipping AND listener setup.`);
    }
}

// 入力フォーム内のチップ削除ボタンのイベントリスナー設定
function setupChipRemoveListener(inputAndButtonContainer, conditionType) {
    if (inputAndButtonContainer) {
        inputAndButtonContainer.addEventListener('click', (event) => {
            const removeButton = event.target.closest('button.remove-chip');

            if (removeButton) {
                const chipToRemove = removeButton.parentElement;

                if (chipToRemove && inputAndButtonContainer.contains(chipToRemove)) {
                    const isOperatorChip = chipToRemove.classList.contains('operator-chip');

                    if (!isOperatorChip) {
                        // 値のチップの場合、直後の要素がAND演算子チップであれば、それも削除
                        const nextElement = chipToRemove.nextElementSibling;
                        if (nextElement && nextElement.classList.contains('operator-chip')) {
                            nextElement.remove();
                        }
                    } else {
                        // 演算子チップの場合、直前の要素（値のチップ）も削除
                        const prevElement = chipToRemove.previousElementSibling;
                        if (prevElement && prevElement.classList.contains('chip') && inputAndButtonContainer.contains(prevElement)) {
                            prevElement.remove();
                        }
                    }

                    // チップをDOMから削除
                    chipToRemove.remove();

                    // チップが全てなくなった後に、最後にANDが残ってしまっている場合は削除
                    const remainingChips = inputAndButtonContainer.querySelectorAll('.chip');
                    const lastRemainingChip = remainingChips[remainingChips.length - 1];
                    if (lastRemainingChip && lastRemainingChip.classList.contains('operator-chip')) {
                        // 最後のチップがAND演算子かつ、その前に値のチップがない場合（ANDだけが残った場合）に削除
                        const prevElement = lastRemainingChip.previousElementSibling;
                        if (!prevElement || !prevElement.classList.contains('chip')) {
                            lastRemainingChip.remove();
                        }
                    }

                    // チップが削除されたらフィルタデータを更新
                    updateCurrentFilterData();

                    console.log(`${conditionType}: Chip removed from input form.`);
                }
            }
        });
    } else {
        console.log(`Input and button container not found for ${conditionType}. Skipping input chip remove listener setup.`);
    }
}

// ORグループ削除ボタンのイベントリスナー設定
function setupOrGroupRemoveListener(chipsDisplay, conditionType) {
    if (chipsDisplay) {
        chipsDisplay.addEventListener('click', (event) => {
            const removeButton = event.target.closest('button.remove-or-group-button');

            if (removeButton) {
                const orGroupContainer = removeButton.closest('.or-group');

                if (orGroupContainer) {
                    // 削除対象のORグループの前の要素がORインジケーターか確認
                    const prevElement = orGroupContainer.previousElementSibling;

                    // ORグループをDOMから削除
                    orGroupContainer.remove();

                    // もし前の要素がORインジケーターであれば、それも削除
                    if (prevElement && prevElement.classList.contains('or-indicator')) {
                        prevElement.remove();
                    }

                    // 表示状態を更新
                    updateDisplayVisibilityOfCondition(chipsDisplay.closest('.filter-condition-item'));

                    // ORグループが削除されたらフィルタデータを更新
                    updateCurrentFilterData();

                    console.log(`${conditionType}: OR group removed from display area.`);
                }
            }
        });
    } else {
        console.log(`Chips display area not found for ${conditionType}. Skipping OR group remove listener setup.`);
    }
}

// 条件入力要素の変更イベントリスナー設定
function setupConditionChangeListeners(conditionItemElement, conditionType, hasAndOrElements, inputElement) {
    if (conditionType === 'size') {
        // サイズ条件の入力要素
        const sizeOperatorSelect = conditionItemElement.querySelector('#condition-size-operator');
        const sizeValueInput = conditionItemElement.querySelector('#condition-size-value-input');
        const sizeUnitSelect = conditionItemElement.querySelector('#condition-size-unit');

        if (sizeOperatorSelect) sizeOperatorSelect.addEventListener('change', updateCurrentFilterData);
        if (sizeValueInput) sizeValueInput.addEventListener('input', updateCurrentFilterData);
        if (sizeUnitSelect) sizeUnitSelect.addEventListener('change', updateCurrentFilterData);
    } else if (conditionType === 'has-attachment') {
        // 添付ファイルあり条件のチェックボックス
        const hasAttachmentCheckbox = conditionItemElement.querySelector('#condition-has-attachment');
        if (hasAttachmentCheckbox) {
            hasAttachmentCheckbox.addEventListener('change', updateCurrentFilterData);
        }
    } else if (hasAndOrElements && inputElement) {
        // AND/OR入力UIを持つ条件項目の入力フィールド
        inputElement.addEventListener('input', updateCurrentFilterData); // 入力中にデータ更新
    }
}

//----------------------------------------------------------------------
// 6. XML処理関連
//----------------------------------------------------------------------

// フィルタのエクスポート処理を行う関数
function exportFilters(mode = 'all') {
    console.log(`Exporting filters in ${mode} mode.`);

    // 表示中のフィルタのみモードの場合のチェック
    if (mode === 'current' && currentFilterIndex === -1) {
        console.warn("No filter selected to export.");
        alert("エクスポートするフィルタが選択されていません。");
        return; // 選択されているフィルタがない場合は何もしない
    }

    // エクスポート対象のフィルタ配列を取得
    let filtersToExport;
    let fileNamePrefix = 'gmailfilter';

    if (mode === 'current') {
        // 表示中のフィルタのみを対象にする
        const currentFilter = filters[currentFilterIndex];
        filtersToExport = [currentFilter];

        // ファイル名にフィルタ名を含める（特殊文字を置換）
        const safeFilterName = currentFilter.name
            ? currentFilter.name.replace(/[\\\/\:\*\?\"\<\>\|]/g, '_').substring(0, 30)
            : "unnamed";
        fileNamePrefix = `gmailfilter_${safeFilterName}`;
    } else {
        // すべてのフィルタを対象にする
        filtersToExport = filters;
        fileNamePrefix = 'gmailfilter_all';
    }

    // XMLデータを生成
    const xmlContent = generateGmailFilterXML(filtersToExport);

    // 現在の日時を取得してファイル名を生成
    const now = new Date();
    const dateStr = now.getFullYear() +
        ('0' + (now.getMonth() + 1)).slice(-2) +
        ('0' + now.getDate()).slice(-2);
    const timeStr = ('0' + now.getHours()).slice(-2) +
        ('0' + now.getMinutes()).slice(-2) +
        ('0' + now.getSeconds()).slice(-2);
    const fileName = `${fileNamePrefix}_${dateStr}_${timeStr}.xml`;

    // XMLをダウンロード
    const blob = new Blob([xmlContent], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();

    // クリーンアップ
    setTimeout(function () {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    }, 0);

    const filterCount = filtersToExport.length;
    console.log(`Exported ${filterCount} filter(s) successfully.`);
}
// インポートダイアログを表示する関数
function showImportDialog() {
    // ファイル選択ダイアログを表示
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xml';

    input.onchange = function (event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function (e) {
            const xmlContent = e.target.result;
            const count = importFiltersFromXML(xmlContent);
            if (count > 0) {
                alert(`${count}個のフィルタを正常にインポートしました。`);
            }
        };
        reader.onerror = function () {
            alert("ファイルの読み込み中にエラーが発生しました。");
        };
        reader.readAsText(file);
    };

    input.click();
}

// Gmail互換のXMLフィルタを生成する関数
function generateGmailFilterXML(filtersArray) {
    // XMLのヘッダー
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<feed xmlns="http://www.w3.org/2005/Atom" xmlns:apps="http://schemas.google.com/apps/2006">\n';
    xml += '  <title>Mail Filters</title>\n';

    // 各フィルタをXMLエントリに変換
    filtersArray.forEach(filter => {
        xml += '  <entry>\n';
        xml += '    <category term="filter"></category>\n';
        xml += `    <title><!-- ${filter.name} --></title>\n`; // フィルタ名をXMLコメントとして埋め込み
        xml += '    <content></content>\n';

        // フィルタ条件をXMLに変換
        const conditions = filter.conditions;

        // From条件
        if (conditions.from && conditions.from.length > 0) {
            xml += generateFromConditionXML(conditions.from);
        }

        // To条件
        if (conditions.to && conditions.to.length > 0) {
            xml += generateToConditionXML(conditions.to);
        }

        // 件名条件
        if (conditions.subject && conditions.subject.length > 0) {
            xml += generateSubjectConditionXML(conditions.subject);
        }

        // メール内容に含むキーワード条件
        if (conditions.includes && conditions.includes.length > 0) {
            xml += generateHasTheWordConditionXML(conditions.includes);
        }

        // メール内容に含まないキーワード条件
        if (conditions.excludes && conditions.excludes.length > 0) {
            xml += generateDoesNotHaveTheWordConditionXML(conditions.excludes);
        }

        // サイズ条件
        if (conditions.size && conditions.size.value !== null) {
            xml += generateSizeConditionXML(conditions.size);
        }

        // 添付ファイルあり条件
        if (conditions.hasAttachment) {
            xml += '    <apps:property name="hasAttachment" value="true"/>\n';
        }

        // フィルタ処理アクションをXMLに変換
        xml += generateActionXML(filter.actions);

        xml += '  </entry>\n';
    });

    xml += '</feed>';
    return xml;
}

// フィルタアクションをXML形式に変換する関数
function generateActionXML(actions) {
    let xml = '';

    // 受信トレイをスキップ
    if (actions.skipInbox) {
        xml += '    <apps:property name="shouldArchive" value="true"/>\n';
    }

    // 既読にする
    if (actions.markAsRead) {
        xml += '    <apps:property name="shouldMarkAsRead" value="true"/>\n';
    }

    // スターを付ける
    if (actions.star) {
        xml += '    <apps:property name="shouldStar" value="true"/>\n';
    }

    // ラベルを付ける
    if (actions.applyLabel && actions.applyLabel.enabled && actions.applyLabel.labelName) {
        xml += `    <apps:property name="label" value="${escapeXml(actions.applyLabel.labelName)}"/>\n`;
    }

    // 転送する
    if (actions.forward && actions.forward.enabled && actions.forward.forwardAddress) {
        xml += `    <apps:property name="forwardTo" value="${escapeXml(actions.forward.forwardAddress)}"/>\n`;
    }

    // 削除する
    if (actions.delete && window.appSettings.enableDeleteAction) {
        xml += '    <apps:property name="shouldTrash" value="true"/>\n';
    } else if (actions.delete && !window.appSettings.enableDeleteAction) {
        // 削除アクションがチェックされているが機能無効の場合、コメントで残す
        xml += '    <!-- 削除機能が無効のため、shouldTrashアクションは無視されます -->\n';
    }


    // 迷惑メールにしない
    if (actions.notSpam) {
        xml += '    <apps:property name="shouldNeverSpam" value="true"/>\n';
    }

    // 重要度設定
    if (actions.alwaysImportant) {
        xml += '    <apps:property name="shouldAlwaysMarkAsImportant" value="true"/>\n';
    }

    if (actions.neverImportant) {
        xml += '    <apps:property name="shouldNeverMarkAsImportant" value="true"/>\n';
    }

    // カテゴリ設定
    if (actions.applyCategory && actions.applyCategory.enabled && actions.applyCategory.category) {
        xml += `    <apps:property name="smartLabelToApply" value="${escapeXml(actions.applyCategory.category)}"/>\n`;
    }

    return xml;
}

// 条件をXML形式に変換する共通関数
function generateConditionXML(conditions, propertyName) {
    if (!conditions || conditions.length === 0) return '';

    let xml = '';

    // 複数のORグループがある場合は複合条件として処理
    if (conditions.length > 1) {
        // OR条件グループをフォーマット
        const conditionParts = conditions.map(orGroup => {
            // ANDキーワードを除去して実際の値だけを取得
            const values = orGroup.filter(item => item !== 'AND');
            if (values.length === 1) {
                // 単一値の場合はそのまま
                return escapeXml(values[0]);
            } else {
                // 複数値（AND条件）の場合は括弧でグループ化
                const andCondition = values.map(v => escapeXml(v)).join(' AND ');
                return `(${andCondition})`;
            }
        });

        // すべてのOR条件を組み合わせる
        const combinedQuery = conditionParts.join(' OR ');
        xml += `    <apps:property name="${propertyName}" value="${escapeXml(combinedQuery)}"/>\n`;
    } else if (conditions.length === 1) {
        // 単一のORグループの場合
        const orGroup = conditions[0];
        // ANDキーワードを除去して実際の値だけを取得
        const values = orGroup.filter(item => item !== 'AND');

        if (values.length === 1) {
            // 単一のキーワードの場合
            xml += `    <apps:property name="${propertyName}" value="${escapeXml(values[0])}"/>\n`;
        } else {
            // 複数キーワード（AND条件）の場合
            const andCondition = values.map(v => escapeXml(v)).join(' AND ');
            xml += `    <apps:property name="${propertyName}" value="${escapeXml(andCondition)}"/>\n`;
        }
    }

    return xml;
}

// FROM条件をXML形式に変換する関数
function generateFromConditionXML(fromConditions) {
    return generateConditionXML(fromConditions, 'from');
}

// TO条件をXML形式に変換する関数
function generateToConditionXML(toConditions) {
    return generateConditionXML(toConditions, 'to');
}

// 件名条件をXML形式に変換する関数
function generateSubjectConditionXML(subjectConditions) {
    return generateConditionXML(subjectConditions, 'subject');
}

// 含むキーワード条件をXML形式に変換する関数
function generateHasTheWordConditionXML(includesConditions) {
    return generateConditionXML(includesConditions, 'hasTheWord');
}

// 含まないキーワード条件をXML形式に変換する関数
function generateDoesNotHaveTheWordConditionXML(excludesConditions) {
    return generateConditionXML(excludesConditions, 'doesNotHaveTheWord');
}

// サイズ条件をXML形式に変換する関数
function generateSizeConditionXML(sizeCondition) {
    let xml = '';

    if (sizeCondition && (sizeCondition.value !== null && sizeCondition.value !== undefined)) {
        // Gmailフィルタ形式のサイズプロパティ名
        if (sizeCondition.operator === 'larger_than') {
            xml += `    <apps:property name="size" value="${sizeCondition.value}"/>\n`;
            xml += `    <apps:property name="sizeOperator" value="s_sl"/>\n`;
            xml += `    <apps:property name="sizeUnit" value="${sizeCondition.unit}"/>\n`;
        } else {
            // smaller_than の場合
            xml += `    <apps:property name="size" value="${sizeCondition.value}"/>\n`;
            xml += `    <apps:property name="sizeOperator" value="s_ss"/>\n`;
            xml += `    <apps:property name="sizeUnit" value="${sizeCondition.unit}"/>\n`;
        }
    }

    return xml;
}

// 条件文字列を解析して条件データ構造に変換する関数
function parseConditionString(conditionStr) {
    console.log(`条件文字列を解析: "${conditionStr}"`);

    // 空の条件文字列の場合は空配列を返す
    if (!conditionStr || conditionStr.trim() === '') {
        return [];
    }

    // 結果を格納する配列（OR条件ごとのグループの配列）
    const result = [];

    try {
        // OR で分割（正規表現ではなく、スペースを考慮して分割）
        // 括弧内のORは分割しないように注意
        let inParentheses = false;
        let currentPart = '';
        let orParts = [];

        for (let i = 0; i < conditionStr.length; i++) {
            const char = conditionStr[i];

            if (char === '(') {
                inParentheses = true;
                currentPart += char;
            } else if (char === ')') {
                inParentheses = false;
                currentPart += char;
            } else if (!inParentheses &&
                conditionStr.substring(i, i + 4) === ' OR ' &&
                (i === 0 || conditionStr[i - 1] !== '(') &&
                (i + 4 >= conditionStr.length || conditionStr[i + 4] !== ')')) {
                orParts.push(currentPart);
                currentPart = '';
                i += 3; // ' OR ' の残りをスキップ
            } else {
                currentPart += char;
            }
        }

        if (currentPart) {
            orParts.push(currentPart);
        }

        if (orParts.length === 0) {
            orParts = [conditionStr]; // 分割に失敗した場合は全体を1つの条件として扱う
        }

        console.log(`OR分割結果:`, orParts);

        orParts.forEach(orPart => {
            // 括弧を除去して整形
            const cleanPart = orPart.replace(/^\s*\(|\)\s*$/g, '').trim();
            console.log(`整形済み部分: "${cleanPart}"`);

            if (cleanPart.includes(' AND ')) {
                // AND条件の場合
                // 括弧内のANDは分割しないように注意
                let inParentheses = false;
                let currentPart = '';
                let andParts = [];

                for (let i = 0; i < cleanPart.length; i++) {
                    const char = cleanPart[i];

                    if (char === '(') {
                        inParentheses = true;
                        currentPart += char;
                    } else if (char === ')') {
                        inParentheses = false;
                        currentPart += char;
                    } else if (!inParentheses &&
                        cleanPart.substring(i, i + 5) === ' AND ' &&
                        (i === 0 || cleanPart[i - 1] !== '(') &&
                        (i + 5 >= cleanPart.length || cleanPart[i + 5] !== ')')) {
                        andParts.push(currentPart.trim());
                        currentPart = '';
                        i += 4; // ' AND ' の残りをスキップ
                    } else {
                        currentPart += char;
                    }
                }

                if (currentPart) {
                    andParts.push(currentPart.trim());
                }

                if (andParts.length === 0) {
                    andParts = [cleanPart]; // 分割に失敗した場合は全体を1つの条件として扱う
                }

                const andGroup = [];

                // 最初の値を追加
                andGroup.push(andParts[0]);

                // 残りの値はAND演算子を間に挟んで追加
                for (let i = 1; i < andParts.length; i++) {
                    andGroup.push('AND');
                    andGroup.push(andParts[i]);
                }

                console.log(`ANDグループ:`, andGroup);
                result.push(andGroup);
            } else {
                // 単一条件の場合
                console.log(`単一条件: "${cleanPart}"`);
                result.push([cleanPart]);
            }
        });
    } catch (error) {
        console.error(`条件文字列の解析中にエラー: ${error.message}`, error);
        // エラー時には単一条件として処理
        if (conditionStr && conditionStr.trim() !== '') {
            result.push([conditionStr]);
        }
    }

    console.log(`解析結果:`, result);
    return result;
}

// Gmailフィルタ形式のXMLからフィルタを読み込む関数
function importFiltersFromXML(xmlContent) {
    try {
        console.log("XMLのインポートを開始します");
        // XMLパーサーを作成
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlContent, "application/xml");

        // XMLパースエラーをチェック
        const parserError = xmlDoc.querySelector('parsererror');
        if (parserError) {
            throw new Error("XML解析エラー: " + parserError.textContent);
        }

        // 全エントリを取得
        const entries = xmlDoc.querySelectorAll('entry');
        console.log(`${entries.length}個のフィルタエントリを検出しました`);

        const importedFilters = [];

        // 各エントリーを処理
        entries.forEach((entry, entryIndex) => {
            console.log(`フィルタエントリ #${entryIndex + 1} の処理を開始`);

            // 新しいフィルタオブジェクトを作成
            const filter = createNewFilterData();

            // 一意性を保証するため、現在時刻 + インデックス + ランダム文字列を使用
            filter.id = Date.now().toString() + "_" + entryIndex + "_" +
                Math.random().toString(36).substring(2, 10);

            console.log(`フィルタに一意のID "${filter.id}" を割り当てました`);

            // フィルタ名を取得
            extractFilterName(entry, filter);

            // 各プロパティを取得
            const properties = getPropertiesFromEntry(entry);
            console.log(`${properties.length}個のプロパティを検出しました`);

            // 各プロパティを処理
            properties.forEach(property => {
                processPropertyForImport(property, filter);
            });

            console.log("インポートされたフィルタデータ:", JSON.stringify(filter, null, 2));
            importedFilters.push(filter);
        });

        // インポートされたフィルタの処理
        handleImportedFilters(importedFilters);

        return importedFilters.length;
    } catch (error) {
        console.error("フィルタのインポート中にエラーが発生しました:", error);
        alert("フィルタのインポート中にエラーが発生しました: " + error.message);
        return 0;
    }
}

// XMLエントリからフィルタ名を抽出する関数
function extractFilterName(entry, filter) {
    const titleElement = entry.querySelector('title');
    if (titleElement) {
        const titleContent = titleElement.innerHTML || '';
        const nameMatch = titleContent.match(/<!--\s*(.*?)\s*-->/);
        if (nameMatch && nameMatch[1]) {
            filter.name = unescapeXml(nameMatch[1].trim());
            console.log(`フィルタ名を検出: "${filter.name}"`);
        }
    }
}

// XMLエントリからプロパティ要素を取得する関数
function getPropertiesFromEntry(entry) {
    // 複数の方法でプロパティ要素を取得（互換性対応）
    let properties = entry.querySelectorAll('apps\\:property');
    if (properties.length === 0) {
        // 名前空間を無視して試行
        properties = entry.querySelectorAll('property');
    }
    if (properties.length === 0) {
        // 完全修飾名で試行
        properties = entry.querySelectorAll('*[name]');
    }
    return properties;
}

// プロパティ要素を処理する関数
function processPropertyForImport(property, filter) {
    const name = property.getAttribute('name');
    let value = property.getAttribute('value');

    // XMLエスケープ文字列をデコード
    value = unescapeXml(value);

    console.log(`プロパティ: ${name} = ${value}`);

    try {
        switch (name) {
            // 条件プロパティの処理
            case 'from':
                filter.conditions.from = parseConditionString(value);
                console.log(`From条件を設定: `, filter.conditions.from);
                break;
            case 'to':
                filter.conditions.to = parseConditionString(value);
                console.log(`To条件を設定: `, filter.conditions.to);
                break;
            case 'subject':
                filter.conditions.subject = parseConditionString(value);
                console.log(`Subject条件を設定: `, filter.conditions.subject);
                break;
            case 'hasTheWord':
                filter.conditions.includes = parseConditionString(value);
                console.log(`Contains条件を設定: `, filter.conditions.includes);
                break;
            case 'doesNotHaveTheWord':
                filter.conditions.excludes = parseConditionString(value);
                console.log(`Excludes条件を設定: `, filter.conditions.excludes);
                break;
            // 添付ファイルあり条件
            case 'hasAttachment':
                filter.conditions.hasAttachment = (value === 'true');
                console.log(`HasAttachment条件を設定: hasAttachment=${filter.conditions.hasAttachment}`);
                break;
            // サイズ条件
            case 'size':
                if (!filter.conditions.size) {
                    filter.conditions.size = { operator: 'larger_than', value: null, unit: 's_smb' };
                }
                filter.conditions.size.value = parseInt(value, 10);
                console.log(`Size条件を設定: value=${filter.conditions.size.value}`);
                break;
            case 'sizeOperator':
                if (!filter.conditions.size) {
                    filter.conditions.size = { operator: 'larger_than', value: null, unit: 's_smb' };
                }
                // Gmail形式のオペレータを内部形式に変換
                filter.conditions.size.operator = (value === 's_sl') ? 'larger_than' : 'smaller_than';
                console.log(`SizeOperator条件を設定: operator=${filter.conditions.size.operator}`);
                break;
            case 'sizeUnit':
                if (!filter.conditions.size) {
                    filter.conditions.size = { operator: 'larger_than', value: null, unit: 's_smb' };
                }
                filter.conditions.size.unit = value;
                console.log(`SizeUnit条件を設定: unit=${filter.conditions.size.unit}`);
                break;
            // アクションプロパティの処理
            case 'label':
                filter.actions.applyLabel.enabled = true;
                filter.actions.applyLabel.labelName = value;
                console.log(`Label処理を設定: enabled=${filter.actions.applyLabel.enabled}, name=${filter.actions.applyLabel.labelName}`);
                break;
            case 'forwardTo':
                filter.actions.forward.enabled = true;
                filter.actions.forward.forwardAddress = value;
                console.log(`Forward処理を設定: enabled=${filter.actions.forward.enabled}, address=${filter.actions.forward.forwardAddress}`);
                break;
            // アーカイブ（受信トレイをスキップ）
            case 'shouldArchive':
                filter.actions.skipInbox = (value === 'true');
                console.log(`Archive処理を設定: skipInbox=${filter.actions.skipInbox}`);
                break;
            // 既読にする
            case 'shouldMarkAsRead':
                filter.actions.markAsRead = (value === 'true');
                console.log(`MarkAsRead処理を設定: markAsRead=${filter.actions.markAsRead}`);
                break;
            // スターを付ける
            case 'shouldStar':
                filter.actions.star = (value === 'true');
                console.log(`Star処理を設定: star=${filter.actions.star}`);
                break;
            // 削除する
            case 'shouldTrash':
                filter.actions.delete = (value === 'true');
                console.log(`Delete処理を設定: delete=${filter.actions.delete}`);
                break;
            // 迷惑メールにしない
            case 'shouldNeverSpam':
                filter.actions.notSpam = (value === 'true');
                console.log(`NotSpam処理を設定: notSpam=${filter.actions.notSpam}`);
                break;
            // 常に重要
            case 'shouldAlwaysMarkAsImportant':
                filter.actions.alwaysImportant = (value === 'true');
                console.log(`AlwaysImportant処理を設定: alwaysImportant=${filter.actions.alwaysImportant}`);
                break;
            // 常に重要でない
            case 'shouldNeverMarkAsImportant':
                filter.actions.neverImportant = (value === 'true');
                console.log(`NeverImportant処理を設定: neverImportant=${filter.actions.neverImportant}`);
                break;
            // カテゴリを適用
            case 'smartLabelToApply':
                filter.actions.applyCategory.enabled = true;
                filter.actions.applyCategory.category = value;
                console.log(`Category処理を設定: enabled=${filter.actions.applyCategory.enabled}, category=${filter.actions.applyCategory.category}`);
                break;
            default:
                console.log(`未処理のプロパティ: ${name} = ${value}`);
        }
    } catch (error) {
        console.error(`プロパティ ${name} の処理中にエラー: ${error.message}`, error);
    }
}

// インポートされたフィルタの処理
function handleImportedFilters(importedFilters) {
    // 既存のフィルタと結合するか、置き換えるか確認
    if (filters.length > 0 && importedFilters.length > 0) {
        if (confirm(`${importedFilters.length}個のフィルタを読み込みました。既存の${filters.length}個のフィルタと統合しますか？「キャンセル」を選択すると、既存のフィルタを全て置き換えます。`)) {
            // 統合する場合
            const currentIds = new Set(filters.map(f => f.id));

            // 既存のIDと重複しないようにする
            importedFilters.forEach(filter => {
                // 既にIDが存在する場合は新しいIDを生成
                if (currentIds.has(filter.id)) {
                    const newId = Date.now().toString() + "_" +
                        Math.random().toString(36).substring(2, 10);
                    console.log(`ID重複を検出: "${filter.id}" → 新ID "${newId}"`);
                    filter.id = newId;
                }
                currentIds.add(filter.id);
            });

            filters = filters.concat(importedFilters);
        } else {
            // 置き換える場合
            filters = importedFilters;
        }
    } else {
        // 既存のフィルタがない場合は置き換え
        filters = importedFilters;
    }

    // 変更を保存
    saveFiltersToStorage();

    // フィルタ一覧を更新
    renderFilterList();

    // 最初のフィルタを選択
    if (filters.length > 0) {
        selectFilter(0);
    } else {
        currentFilterIndex = -1;
        displayFilterDetails(null);
    }

    console.log(`${importedFilters.length}個のフィルタを正常にインポートしました`);
}