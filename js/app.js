// Глобальные переменные
let sheets = [];
let details = [];
let optimizationResults = null;
let currentSheetIndex = 0;
let editingDetailId = null;

// Стандартные размеры листов
const SHEET_PRESETS = [
    { name: 'Фанера 2500×1250', length: 2500, width: 1250, cost: 1000 },
    { name: 'ДСП 2500×1250', length: 2500, width: 1250, cost: 800 },
    { name: 'МДФ 2750×1830', length: 2750, width: 1830, cost: 1200 },
    { name: 'Листовой металл 2000×1000', length: 2000, width: 1000, cost: 2000 },
    { name: 'Пластик 2400×1200', length: 2400, width: 1200, cost: 600 },
    { name: 'Стекло 3000×2000', length: 3000, width: 2000, cost: 3000 },
    { name: 'Кастрюля 1500×1500', length: 1500, width: 1500, cost: 500 }
];

// Стратегии оптимизации
const STRATEGIES = [
    { id: 'area', name: 'По площади', description: 'Сортировка по площади детали (больше сначала)' },
    { id: 'long_side', name: 'По длинной стороне', description: 'Сортировка по самой длинной стороне детали' },
    { id: 'best_fit', name: 'Лучший размещение', description: 'Выбор позиции с минимальными отходами' }
];

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function () {
    document.getElementById('addSheetBtn').addEventListener('click', addSheet);
    document.getElementById('addDetailBtn').addEventListener('click', addOrUpdateDetail);
    document.getElementById('optimizeBtn').addEventListener('click', optimizeLayout);
    document.getElementById('printBtn').addEventListener('click', printLayout);
    document.getElementById('presetsBtn').addEventListener('click', loadPresetsModal);

    // Добавить лист по умолчанию
    addSheet();

    // Загрузить пример данных для демонстрации
    loadExampleData();
});


// ===== УПРАВЛЕНИЕ ЛИСТАМИ =====

function addSheet() {
    const sheetId = Date.now();
    const sheet = {
        id: sheetId,
        length: 2500,
        width: 1250,
        cost: 1000
        //,margin: 2
    };

    sheets.push(sheet);
    currentSheetIndex = sheets.length - 1;
    renderSheets();
}

function removeSheet(id) {
    sheets = sheets.filter(s => s.id !== id);
    if (currentSheetIndex >= sheets.length) {
        currentSheetIndex = sheets.length - 1;
    }
    if (currentSheetIndex < 0) addSheet();
    renderSheets();
}

function selectSheet(index) {
    currentSheetIndex = index;
    renderSheets();
}

function updateSheet(id, field, value) {
    const sheet = sheets.find(s => s.id === id);
    if (sheet) {
        sheet[field] = value;
        renderSheets();
    }
}

function renderSheets() {
    const container = document.getElementById('sheetsContainer');
    container.innerHTML = '';

    sheets.forEach((sheet, index) => {
        const isActive = index === currentSheetIndex;
        const div = document.createElement('div');
        div.className = `sheet-card ${isActive ? 'active' : ''}`;
        div.innerHTML = `
            <div class="sheet-remove-btn" onclick="removeSheet(${sheet.id})" title="Удалить">✕</div>
            <div class="sheet-info" onclick="selectSheet(${index})" style="cursor: pointer;">
                Лист ${index + 1}
            </div>
            <div class="mb-2">
                <small class="form-text">
                    <label class="form-label">Длина листа (мм)</label>
                    <input type="number" class="form-control form-control-sm mb-1" 
                        placeholder="Длина" value="${sheet.length}"
                        onchange="updateSheet(${sheet.id}, 'length', parseInt(this.value))">
                    <label class="form-label">Ширина листа (мм)</label>
                    <input type="number" class="form-control form-control-sm mb-1" 
                        placeholder="Ширина" value="${sheet.width}"
                        onchange="updateSheet(${sheet.id}, 'width', parseInt(this.value))">
                    <label class="form-label">Стоимость листа (руб.)</label>
                    <input type="number" class="form-control form-control-sm mb-1" 
                        placeholder="Стоимость" value="${sheet.cost}" step="0.01"
                        onchange="updateSheet(${sheet.id}, 'cost', parseFloat(this.value))">
                    <!-- <label class="form-label">Припуск при резке (мм)</label>
                     <input type="number" class="form-control form-control-sm" 
                         placeholder="Припуск" value="${sheet.margin}"
                         onchange="updateSheet(${sheet.id}, 'margin', parseInt(this.value))">-->
                </small>
            </div>
        `;
        container.appendChild(div);
    });
}

function loadPresetsModal() {
    const container = document.getElementById('presetsContainer');
    container.innerHTML = '';

    SHEET_PRESETS.forEach(preset => {
        const div = document.createElement('div');
        div.className = 'mb-2';
        div.innerHTML = `
            <button type="button" class="btn btn-outline-primary w-100 text-start" 
                onclick="applyPreset(${preset.length}, ${preset.width}, ${preset.cost})">
                <strong>${preset.name}</strong><br>
                <small>${preset.length} × ${preset.width} мм | ${preset.cost} руб</small>
            </button>
        `;
        container.appendChild(div);
    });
}

function applyPreset(length, width, cost) {
    if (sheets.length > 0) {
        updateSheet(sheets[currentSheetIndex].id, 'length', length);
        updateSheet(sheets[currentSheetIndex].id, 'width', width);
        updateSheet(sheets[currentSheetIndex].id, 'cost', cost);
        const modal = bootstrap.Modal.getInstance(document.getElementById('presetsModal'));
        modal.hide();
    }
}

// ===== УПРАВЛЕНИЕ ДЕТАЛЯМИ =====

function addOrUpdateDetail() {
    const length = parseInt(document.getElementById('detailLength').value);
    const width = parseInt(document.getElementById('detailWidth').value);
    const quantity = parseInt(document.getElementById('detailQuantity').value);
    const rotation = document.getElementById('detailRotation').value;

    if (!length || !width || !quantity) {
        alert('Заполните все поля!');
        return;
    }

    if (editingDetailId !== null) {
        // Обновить существующую деталь
        const detail = details.find(d => d.id === editingDetailId);
        if (detail) {
            detail.length = length;
            detail.width = width;
            detail.quantity = quantity;
            detail.rotation = rotation;
        }
        editingDetailId = null;
        document.getElementById('addDetailBtn').innerHTML = 'Добавить деталь';
    } else {
        // Добавить новую деталь
        const detail = {
            id: Date.now(),
            length: length,
            width: width,
            quantity: quantity,
            rotation: rotation
        };
        details.push(detail);
    }

    updateDetailsTable();

    // Очистить форму
    document.getElementById('detailForm').reset();
    document.getElementById('detailRotation').value = 'free';
}

function removeDetail(id) {
    details = details.filter(d => d.id !== id);
    updateDetailsTable();
    if (editingDetailId === id) {
        editingDetailId = null;
        document.getElementById('addDetailBtn').innerHTML = 'Добавить деталь';
        document.getElementById('detailForm').reset();
        document.getElementById('detailRotation').value = 'free';
    }
}

function editDetail(id) {
    const detail = details.find(d => d.id === id);
    if (detail) {
        document.getElementById('detailLength').value = detail.length;
        document.getElementById('detailWidth').value = detail.width;
        document.getElementById('detailQuantity').value = detail.quantity;
        document.getElementById('detailRotation').value = detail.rotation;
        editingDetailId = id;
        document.getElementById('addDetailBtn').innerHTML = 'Сохранить изменения';
        document.getElementById('detailLength').focus();
    }
}

function updateDetailsTable() {
    const tbody = document.getElementById('detailsTableBody');
    tbody.innerHTML = '';

    details.forEach(detail => {
        const row = document.createElement('tr');
        const area = detail.length * detail.width * detail.quantity;
        const rotationLabel = detail.rotation === 'free' ? 'Свобод.' : 'Фиксир.';
        row.innerHTML = `
            <td>${detail.length}</td>
            <td>${detail.width}</td>
            <td>${detail.quantity}</td>
            <td><span class="badge ${detail.rotation === 'free' ? 'bg-info' : 'bg-warning'}">${rotationLabel}</span></td>
            <td>${area}</td>
            <td>
                <button class="btn btn-sm btn-primary" onclick="editDetail(${detail.id})" title="Редактировать">
                    ✎
                </button>
                <button class="btn btn-sm btn-danger" onclick="removeDetail(${detail.id})">
                    ✕
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// ===== ОПТИМИЗАЦИЯ =====

function optimizeLayout() {
    if (sheets.length === 0) {
        alert('Добавьте листы!');
        return;
    }

    if (details.length === 0) {
        alert('Добавьте детали для раскроя!');
        return;
    }

    document.getElementById('optimizeBtn').disabled = true;
    document.getElementById('optimizeBtn').innerHTML = '⏳ Обработка...';

    // Отправить запросы для всех стратегий
    const sheetsData = sheets.map(sheet => ({
        length: sheet.length,
        width: sheet.width,
        cost: sheet.cost
    }));

    const margin = document.getElementById("sheet_margin").value;// sheets[0].margin;
    let completedRequests = 0;
    let allResults = {};

    STRATEGIES.forEach(strategy => {
        const formData = new FormData();
        formData.append('action', 'optimize');
        formData.append('sheets', JSON.stringify(sheetsData));
        formData.append('margin', margin);
        formData.append('details', JSON.stringify(details));
        formData.append('strategy', strategy.id);

        fetch('api.php', {
            method: 'POST',
            body: formData
        })
            .then(response => response.json())
            .then(data => {
                completedRequests++;

                if (data.success) {
                    allResults[strategy.id] = data;
                } else {
                    console.error(`Ошибка для стратегии ${strategy.id}:`, data.error);
                }

                // Когда все запросы завершены
                if (completedRequests === STRATEGIES.length) {
                    document.getElementById('optimizeBtn').disabled = false;
                    document.getElementById('optimizeBtn').innerHTML = '🚀 Оптимизировать раскрой';

                    if (Object.keys(allResults).length > 0) {
                        optimizationResults = allResults;
                        displayResults(allResults);
                        document.getElementById('printBtn').style.display = 'block';
                    } else {
                        alert('Не удалось выполнить оптимизацию ни по одной из стратегий');
                    }
                }
            })
            .catch(error => {
                completedRequests++;
                console.error(`Ошибка для стратегии ${strategy.id}:`, error);

                if (completedRequests === STRATEGIES.length) {
                    document.getElementById('optimizeBtn').disabled = false;
                    document.getElementById('optimizeBtn').innerHTML = '🚀 Оптимизировать раскрой';
                    alert('Ошибка соединения с сервером');
                }
            });
    });
}

// ===== ОТОБРАЖЕНИЕ РЕЗУЛЬТАТОВ =====

function displayResults(allResults) {
    const container = document.getElementById('resultsContainer');

    // Определить лучший результат
    let bestStrategy = null;
    let bestCost = Infinity;
    Object.keys(allResults).forEach(strategyId => {
        if (allResults[strategyId].total_cost < bestCost) {
            bestCost = allResults[strategyId].total_cost;
            bestStrategy = strategyId;
        }
    });

    let html = `
        <div class="card mt-4">
            <div class="card-header bg-primary text-white">
                <h5 class="mb-0">📊 Результаты оптимизации</h5>
            </div>
            <div class="card-body">
                <div class="alert alert-info">
                    <strong>Рекомендуется:</strong> Стратегия "<strong>${STRATEGIES.find(s => s.id === bestStrategy).name}</strong>" с минимальной стоимостью ${bestCost.toFixed(2)} руб.
                </div>
                
                <ul class="nav nav-tabs" role="tablist">
    `;

    STRATEGIES.forEach((strategy, index) => {
        if (allResults[strategy.id]) {
            const isActive = strategy.id === bestStrategy ? 'active' : '';
            html += `
                <li class="nav-item" role="presentation">
                    <button class="nav-link ${isActive}" id="tab-${strategy.id}" data-bs-toggle="tab" 
                        data-bs-target="#content-${strategy.id}" type="button" role="tab">
                        ${strategy.name} ${strategy.id === bestStrategy ? '✓' : ''}
                    </button>
                </li>
            `;
        }
    });

    html += `
                </ul>
                
                <div class="tab-content mt-3">
    `;

    STRATEGIES.forEach(strategy => {
        if (allResults[strategy.id]) {
            const result = allResults[strategy.id];
            const isActive = strategy.id === bestStrategy ? 'show active' : '';

            html += `
                <div class="tab-pane fade ${isActive}" id="content-${strategy.id}" role="tabpanel">
                    <div class="row">
                        <div class="col-md-3">
                            <div class="stats-card">
                                <h6>Листов используется</h6>
                                <div class="display-value">${result.sheets_used}</div>
                            </div>
                        </div>
                        <div class="col-md-3">
                            <div class="stats-card">
                                <h6>Стоимость материала</h6>
                                <div class="display-value">${(result.total_cost).toFixed(2)} руб.</div>
                            </div>
                        </div>
                        <div class="col-md-3">
                            <div class="stats-card">
                                <h6>Использовано</h6>
                                <div class="display-value">${(result.material_used).toFixed(1)}%</div>
                            </div>
                        </div>
                        <div class="col-md-3">
                            <div class="stats-card">
                                <h6>Отходы</h6>
                                <div class="display-value">${(result.waste).toFixed(1)}%</div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="card mt-3">
                        <div class="card-header bg-warning">
                            <h5 class="mb-0">📋 Схемы раскроя</h5>
                        </div>
                        <div class="card-body">
            `;

            // Не размещенные
            if (result.remaining_details.length > 0) {
                html += `
                    <div class="pattern-item">
                        <p class="mb-2">
                            Не размещено деталей: <strong>${result.remaining_details.length}</strong> 
                        </p>
                `;
                result.remaining_details.forEach((detail, index) => {
                    html += `<span class="badge me-2" style="background-color: ${colors[detail['detail_num'] % colors.length]};">${detail.length}×${detail.width}</span>`;
                });
                html += `
                        </div>
                `;
            }

            result.patterns.forEach((pattern, index) => {
                html += `
                    <div class="pattern-item">
                        <h6>Схема ${index + 1} - Лист ${pattern.sheet_index + 1} (${pattern.sheet_length}×${pattern.sheet_width} мм)</h6>
                        <p class="mb-2">
                            Деталей: <strong>${pattern.details.length}</strong> | 
                            Использовано: <strong>${(pattern.used_area / (pattern.sheet_length * pattern.sheet_width) * 100).toFixed(1)}%</strong>
                        </p>
                `;

                pattern.details.forEach(detail => {
                    html += `<span class="badge me-2" style="background-color: ${colors[detail['detail_num'] % colors.length]};">${detail.length}×${detail.width}</span>`;
                });

                html += `
                    <div class="canvas-container">        
                    <canvas class="myCanvas" id="canvas-${strategy.id}-${index}" style="border: 1px solid #ddd; margin-top: 1rem; "></canvas>
                    </div>
                        </div>
                `;
            });

            html += `
                        </div>
                    </div>
                </div>
            `;
        }
    });

    html += `
                </div>
            </div>
        </div>
    `;

    container.innerHTML = html;

    // // Отрисовать схемы раскроя на canvas для каждой стратегии
    // STRATEGIES.forEach(strategy => {
    //     if (allResults[strategy.id]) {
    //         const result = allResults[strategy.id];
    //         result.patterns.forEach((pattern, index) => {
    //             const canvasId = `canvas-${strategy.id}-${index}`;
    //             setTimeout(() => {
    //                 drawPattern(canvasId, pattern);
    //             }, 100);
    //         });
    //     }
    // });
    // Синхронная отрисовка — элементы уже имеют правильный размер в DOM
    STRATEGIES.forEach(strategy => {
        if (allResults[strategy.id]) {
            const result = allResults[strategy.id];
            result.patterns.forEach((pattern, index) => {
                const canvasId = `canvas-${strategy.id}-${index}`;
                drawPattern(canvasId, pattern);

                //сделать возможность перетаскивания
                let canvas = document.getElementById(canvasId);
                // console.log(canvas);
                canvas.addEventListener('mousedown', (e) => {
                    const mouse = getMousePos(canvas, e);
                    // console.log("mouse: " + JSON.stringify(mouse));
                    for (let i = pattern.details.length - 1; i >= 0; i--) {
                        const r = pattern.details[i];
                        // console.log(r);
                        if (mouse.x >= r.x && mouse.x <= r.x + r.length &&
                            mouse.y >= r.y && mouse.y <= r.y + r.width) {
                            selectedRect = r;
                            // console.log("selected: " + JSON.stringify(selectedRect));
                            // console.log(pattern);
                            // Запоминаем начальную точку на случай возврата
                            startX = r.x;
                            startY = r.y;

                            offsetX = mouse.x - r.x;
                            offsetY = mouse.y - r.y;
                            break;
                        }
                    }
                    drawPattern(canvasId, pattern);
                });

                canvas.addEventListener('mousemove', (e) => {
                    if (!selectedRect) return;
                    const mouse = getMousePos(canvas, e);

                    selectedRect.x = mouse.x - offsetX;
                    selectedRect.y = mouse.y - offsetY;

                    drawPattern(canvasId, pattern);
                });

                // canvas.addEventListener('mouseup', () => {
                //     if (!selectedRect) return;
                //     sheet = { x: 0, y: 0, width:pattern.sheet_width , height: pattern.sheet_length };
                //     // Если после отпускания мыши позиция некорректна — возвращаем на место
                //     // console.log(pattern.details);
                //     if (!isPositionValid(selectedRect,sheet,pattern.details)) {
                //     selectedRect.x = startX;
                //     selectedRect.y = startY;
                //     }

                //     selectedRect = null;
                //     drawPattern(canvasId, pattern);
                // });

                canvas.addEventListener('mouseup', () => {
                    if (!selectedRect) return;
                    sheet = { x: 0, y: 0, width: pattern.sheet_width, height: pattern.sheet_length };
                    let margin = Number(document.getElementById("sheet_margin").value);
                    // Ищем, с какими деталями пересекается перетаскиваемый объект
                    rectangles = pattern.details;
                    let overlappingRects = rectangles.filter(rect =>
                        rect.id !== selectedRect.id && isOverlapping(selectedRect, rect)
                    );

                    if (overlappingRects.length > 0) {
                        // Берем первое найденное пересечение (или можно перебрать все)
                        let obstacle = overlappingRects[0];

                        // Вычисляем, насколько нужно сдвинуть деталь, чтобы выровнять по краям препятствия
                        let snapToRight = obstacle.x + obstacle.length; // Координата X правого края препятствия
                        let snapToBottom = obstacle.y + obstacle.width; // Координата Y нижнего края препятствия

                        // Считаем расстояния (насколько глубоко зашли за правый/нижний край)
                        let distToRight = Math.abs(selectedRect.x - snapToRight);
                        let distToBottom = Math.abs(selectedRect.y - snapToBottom);

                        // Запоминаем текущую позицию перед попыткой выравнивания
                        let targetX = selectedRect.x;
                        let targetY = selectedRect.y;

                        // Выбираем ближайший край для выравнивания
                        if (distToRight < distToBottom) {
                            targetX = snapToRight; // Выравниваем по правому краю
                        } else {
                            targetY = snapToBottom; // Выравниваем по низу
                        }

                        // Временный объект для проверки валидности новой позиции
                        let testRect = { ...selectedRect, x: targetX, y: targetY };

                        if (isPositionValid(testRect, sheet, pattern.details)) {
                            //console.log(margin)
                            selectedRect.x = targetX + margin;
                            selectedRect.y = targetY + margin;
                        } else {
                            // Если выравнивание всё равно нарушает правила (например, вылет за лист), возвращаем в начало
                            selectedRect.x = startX;
                            selectedRect.y = startY;
                        }
                    } else if (!isInsideSheet(selectedRect, sheet)) {
                        // Если пересечений нет, но деталь просто вылетела за границы листа
                        selectedRect.x = startX;
                        selectedRect.y = startY;
                    }

                    selectedRect = null;
                    drawPattern(canvasId, pattern);
                });

            });
        }
    });

}

// Отрисовать детали
    const colors = ['#ff6b6b', '#4ecdc4', '#f9ca24','#6c5ce7','#fd79a8','#a29bfe', '#fdcb6e','#45b7d1'];
// ===== ОТРИСОВКА CANVAS =====
function drawPattern(canvasId, pattern) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    // Внутренняя система координат canvas теперь СТРОГО в миллиметрах
    canvas.width = pattern.sheet_length;
    canvas.height = pattern.sheet_width;


// 2. РАСЧЕТ ЕДИНОГО МАСШТАБА ДЛЯ ЭКРАНА (Физические пиксели)
    // Определяем, сколько пикселей экрана занимает 1 мм.
    // Чтобы на разных canvas детали были ОДИНАКОВЫМИ, scaleMM должен быть общим.
    // Например, зафиксируем, что 1000 мм листа всегда равны 400 пикселям на экране.
    // Или можно рассчитывать динамически: 
    // const scaleMM = window.innerWidth / 3000;
    // const scaleMM = 0.35; // 1 мм = 0.35 пикселя на экране. Подберите под свой дизайн.
    const scaleMM = 0.45; // 1 мм = 0.35 пикселя на экране. Подберите под свой дизайн.

    // 3. Устанавливаем ФИЗИЧЕСКИЙ размер canvas на экране через CSS-стили
    // Теперь холст 2500мм займет 2500 * 0.35 = 875px на экране.
    // А холст 1200мм займет 1200 * 0.35 = 420px. Детали на них будут РАВНЫМИ!
    canvas.style.width = `${pattern.sheet_length * scaleMM}px`;
    canvas.style.height = `${pattern.sheet_width * scaleMM}px`;

    const ctx = canvas.getContext('2d');

    // Очистить canvas (заливаем весь внутренний размер листа)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Отрисовать фон листа (координаты 0, 0, так как холст равен листу)
    ctx.fillStyle = '#e8f4f8';
    ctx.fillRect(0, 0, pattern.sheet_length, pattern.sheet_width);

    // Отрисовать границу листа
    ctx.strokeStyle = '#333';
    // Толщина линии в мм. Если лист большой (например 2500мм), 
    // сделайте линию толще (например, 5 или 10), чтобы её было видно на экране.
    ctx.lineWidth = 4;
    ctx.strokeRect(0, 0, pattern.sheet_length, pattern.sheet_width);

    

    pattern.details.forEach((detail, i) => {
        // Координаты и размеры берутся НАПРЯМУЮ в мм, без scale и offset!
        const x = detail.x;
        const y = detail.y;
        const w = detail.length;
        const h = detail.width;

        // ctx.fillStyle = colors[i % colors.length];
        // console.log(detail['detail_num']);
        ctx.fillStyle = colors[detail['detail_num'] % colors.length];
        ctx.fillRect(x, y, w, h);

        // Граница детали
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2; // толщина в мм
        ctx.strokeRect(x, y, w, h);

        // Текст размеров
        ctx.fillStyle = '#000';

        // Размер шрифта подбирайте в мм. 
        // Если детали мелкие (например 100мм), 14px (мм) будет много.
        // Оптимально взять процент от размера детали или фиксированные ~20-30мм для читаемости.
        ctx.font = `bold ${Math.min(w, h, 30)}px Arial`;

        const textX = x + w / 2;
        const textY = y + h / 2;

        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${detail.length}×${detail.width}`, textX, textY);
        ctx.restore();
    });
}

// ===== ПЕЧАТЬ =====

function printLayout() {
    if (!optimizationResults) {
        alert('Сначала выполните оптимизацию!');
        return;
    }

    // Печатать результаты лучшей стратегии
    // let bestStrategy = null;
    // let bestCost = Infinity;
    // Object.keys(optimizationResults).forEach(strategyId => {
    //     if (optimizationResults[strategyId].total_cost < bestCost) {
    //         bestCost = optimizationResults[strategyId].total_cost;
    //         bestStrategy = strategyId;
    //     }
    // });

    // const result = optimizationResults[bestStrategy];
    // const strategyName = STRATEGIES.find(s => s.id === bestStrategy).name;

    let bestStrategy = document.querySelector('.active[role="tabpanel"]').id.replace('content-', '');
    const result = optimizationResults[bestStrategy];
    //const strategyName=document.querySelector('.active[role="tabpanel"]').id.replace('content-', '');
    const strategyName = STRATEGIES.find(s => s.id === bestStrategy).name;



    const printWindow = window.open('', '_blank');

    let html = `
    <!DOCTYPE html>
    <html lang="ru">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Схемы раскроя</title>
        <style>
            body {
                font-family: Arial, sans-serif;
                margin: 0;
                padding: 10mm;
                background: white;
            }
            .header {
                text-align: center;
                margin-bottom: 20px;
                border-bottom: 2px solid #000;
                padding-bottom: 10px;
            }
            .header h1 {
                margin: 0;
                font-size: 24px;
            }
            .header p {
                margin: 5px 0;
                font-size: 12px;
                color: #666;
            }
            .stats {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 10px;
                margin-bottom: 20px;
            }
            .stat-box {
                border: 1px solid #000;
                padding: 10px;
                text-align: center;
            }
            .stat-label {
                font-size: 12px;
                font-weight: bold;
                color: #666;
            }
            .stat-value {
                font-size: 20px;
                font-weight: bold;
                margin-top: 5px;
            }
            .pattern {
                margin-bottom: 30px;
                page-break-inside: avoid;
            }
            .pattern h3 {
                margin: 0 0 10px 0;
                font-size: 16px;
                border-left: 3px solid #0066cc;
                padding-left: 10px;
            }
            .pattern-info {
                margin-bottom: 10px;
                font-size: 12px;
                color: #666;
            }
            canvas {
                max-width: 100%;
                height: auto;
                border: 1px solid #ccc;
                display: block;
                margin-bottom: 10px;
            }
            .footer {
                margin-top: 30px;
                padding-top: 10px;
                border-top: 1px solid #ccc;
                font-size: 10px;
                color: #999;
                text-align: center;
            }
            @media print {
                body {
                    margin: 0;
                    padding: 0;
                }
            }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>Оптимизация раскроя листового материала</h1>
            <p>Стратегия: ${strategyName}</p>
            <p>Дата создания: ${new Date().toLocaleDateString('ru-RU')} ${new Date().toLocaleTimeString('ru-RU')}</p>
        </div>
        
        <div class="stats">
            <div class="stat-box">
                <div class="stat-label">Листов используется</div>
                <div class="stat-value">${result.sheets_used}</div>
            </div>
            <div class="stat-box">
                <div class="stat-label">Стоимость материала</div>
                <div class="stat-value">${(result.total_cost).toFixed(0)} руб</div>
            </div>
            <div class="stat-box">
                <div class="stat-label">Использовано материала</div>
                <div class="stat-value">${(result.material_used).toFixed(1)}%</div>
            </div>
            <div class="stat-box">
                <div class="stat-label">Отходы</div>
                <div class="stat-value">${(result.waste).toFixed(1)}%</div>
            </div>
        </div>
    `;

    result.patterns.forEach((pattern, index) => {
        html += `
            <div class="pattern">
                <h3>Схема раскроя ${index + 1} - Лист ${pattern.sheet_index + 1}</h3>
                <div class="pattern-info">
                    Размер листа: ${pattern.sheet_length} × ${pattern.sheet_width} мм | 
                    Деталей: ${pattern.details.length} | 
                    Использовано: ${(pattern.used_area / (pattern.sheet_length * pattern.sheet_width) * 100).toFixed(1)}%
                </div>
                <canvas id="printCanvas${index}" width="800" height="600"></canvas>
            </div>
        `;
    });

    html += `
        <div class="footer">
            <p>Выполнено: ${new Date().toLocaleString('ru-RU')}</p>
        </div>
    </body>
    </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();

    // Отрисовать canvas после загрузки
    printWindow.onload = function () {
        result.patterns.forEach((pattern, index) => {
            const canvas = printWindow.document.getElementById(`printCanvas${index}`);
            drawPatternForPrint(canvas, pattern);
        });

        setTimeout(() => {
            printWindow.print();
        }, 500);
    };
}

function drawPatternForPrint(canvas, pattern) {
    const ctx = canvas.getContext('2d');
    const scale = Math.min(800 / pattern.sheet_length, 600 / pattern.sheet_width) * 0.9;
    const offsetX = 20;
    const offsetY = 20;

    // Отрисовать фон листа
    ctx.fillStyle = '#f5f5f5';
    ctx.fillRect(offsetX, offsetY, pattern.sheet_length * scale, pattern.sheet_width * scale);

    // Отрисовать границу листа
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.strokeRect(offsetX, offsetY, pattern.sheet_length * scale, pattern.sheet_width * scale);

    // Размеры листа
    ctx.fillStyle = '#000';
    ctx.font = 'bold 14px Arial';
    ctx.fillText(`${pattern.sheet_length}×${pattern.sheet_width} мм`, offsetX + 10, offsetY - 10);

    // Отрисовать детали
    // const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#f9ca24', '#6c5ce7', '#a29bfe'];

    pattern.details.forEach((detail, i) => {
        const x = offsetX + detail.x * scale;
        const y = offsetY + detail.y * scale;
        const w = detail.length * scale;
        const h = detail.width * scale;

        // ctx.fillStyle = colors[i % colors.length];
        // console.log(detail['detail_num']);
        ctx.fillStyle = colors[detail['detail_num'] % colors.length];
        ctx.fillRect(x, y, w, h);
        

        // Граница детали
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, w, h);

        // Текст размеров
        ctx.fillStyle = '#000';
        ctx.font = 'bold 12px Arial';
        const textX = x + w / 2;
        const textY = y + h / 2;

        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${detail.length}×${detail.width}`, textX, textY);
        ctx.restore();
    });
}

// ===== ПРИМЕРЫ ДАННЫХ =====
function loadExampleData() {
    // Примеры деталей
    details.push({
        id: 1,
        length: 600,
        width: 300,
        quantity: 5,
        rotation: 'free'
    });

    details.push({
        id: 2,
        length: 400,
        width: 400,
        quantity: 3,
        rotation: 'free'
    });

    details.push({
        id: 3,
        length: 800,
        width: 200,
        quantity: 2,
        rotation: 'fixed'
    });

    updateDetailsTable();
}

//== ПЕРЕТАСКИВАНИЕ ==

let sheet = {};
let selectedRect = null;
let offsetX = 0;
let offsetY = 0;

// Переменные для хранения позиции до начала перетаскивания
let startX = 0;
let startY = 0;

function getMousePos(canvas, e) {
    const rect = canvas.getBoundingClientRect();
    // 1. Получаем координаты клика относительно самого canvas на экране
    const clientX = event.clientX - rect.left;
    const clientY = event.clientY - rect.top;

    // 2. Масштабируем под внутреннее разрешение холста
    const canvasX = clientX * (canvas.width / rect.width);
    const canvasY = clientY * (canvas.height / rect.height);

    return { x: canvasX, y: canvasY };
}
// Проверка пересечения двух прямоугольников
function isOverlapping(rect1, rect2) {
    // console.log("selected: " + JSON.stringify(rect1));
    // console.log("rect: " + JSON.stringify(rect2));
    return rect1.x < rect2.x + rect2.length &&
        rect1.x + rect1.length > rect2.x &&
        rect1.y < rect2.y + rect2.width &&
        rect1.y + rect1.width > rect2.y;
}

// Проверка, находится ли прямоугольник строго ВНУТРИ листа
function isInsideSheet(rect, sheet) {
    // console.log("selected: " + JSON.stringify(rect));
    // console.log("selected: " + JSON.stringify(sheet));
    return rect.x >= sheet.x &&
        rect.x + rect.length <= sheet.x + sheet.height &&
        rect.y >= sheet.y &&
        rect.y + rect.width <= sheet.y + sheet.width;
}

// Комплексная проверка позиции прямоугольника
function isPositionValid(currentRect, sheet, rectangles) {
    // 1. Проверяем выход за границы листа
    if (!isInsideSheet(currentRect, sheet)) return false;

    // 2. Проверяем пересечение с другими деталями
    for (let rect of rectangles) {
        if (rect.id === currentRect.id) continue; // Пропускаем сами себя
        if (isOverlapping(currentRect, rect)) return false;
    }

    return true;
}

//подогнать под экран



