// Глобальные переменные
let details = [];
let optimizationResult = null;

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('addDetailBtn').addEventListener('click', addDetail);
    document.getElementById('optimizeBtn').addEventListener('click', optimizeLayout);
    
    // Пример данных для демонстрации
    loadExampleData();
});

// Добавить деталь в список
function addDetail() {
    const length = parseInt(document.getElementById('detailLength').value);
    const width = parseInt(document.getElementById('detailWidth').value);
    const quantity = parseInt(document.getElementById('detailQuantity').value);
    
    if (!length || !width || !quantity) {
        alert('Заполните все поля!');
        return;
    }
    
    const detail = {
        id: Date.now(),
        length: length,
        width: width,
        quantity: quantity
    };
    
    details.push(detail);
    updateDetailsTable();
    
    // Очистить форму
    document.getElementById('detailForm').reset();
}

// Обновить таблицу деталей
function updateDetailsTable() {
    const tbody = document.getElementById('detailsTableBody');
    tbody.innerHTML = '';
    
    details.forEach(detail => {
        const row = document.createElement('tr');
        const area = detail.length * detail.width;
        row.innerHTML = `
            <td>${detail.length}</td>
            <td>${detail.width}</td>
            <td>${detail.quantity}</td>
            <td>${area}</td>
            <td>
                <button class="btn btn-sm btn-danger" onclick="removeDetail(${detail.id})">
                    ✕
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// Удалить деталь
function removeDetail(id) {
    details = details.filter(d => d.id !== id);
    updateDetailsTable();
}

// Основная функция оптимизации раскроя
function optimizeLayout() {
    if (details.length === 0) {
        alert('Добавьте детали для раскроя!');
        return;
    }
    
    const sheetLength = parseInt(document.getElementById('sheetLength').value);
    const sheetWidth = parseInt(document.getElementById('sheetWidth').value);
    const materialCost = parseFloat(document.getElementById('materialCost').value);
    const margin = parseInt(document.getElementById('margin').value);
    
    // Отправить данные на сервер для оптимизации
    const formData = new FormData();
    formData.append('action', 'optimize');
    formData.append('sheet_length', sheetLength);
    formData.append('sheet_width', sheetWidth);
    formData.append('material_cost', materialCost);
    formData.append('margin', margin);
    formData.append('details', JSON.stringify(details));
    
    fetch('api.php', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            console.log(data);
            optimizationResult = data.result;
            displayResults(data);
        } else {
            alert('Ошибка оптимизации: ' + data.error);
        }
    })
    .catch(error => {
        console.error('Error:', error);
        alert('Ошибка соединения с сервером');
    });
}

// Вывести результаты оптимизации
function displayResults(result) {
    console.log(result);
    const container = document.getElementById('resultsContainer');
    
    let html = `
        <div class="row">
            <div class="col-md-6">
                <div class="stats-card">
                    <h6>Листов требуется</h6>
                    <div class="display-value">${result.sheets_needed}</div>
                </div>
            </div>
            <div class="col-md-6">
                <div class="stats-card">
                    <h6>Стоимость материала</h6>
                    <div class="display-value">${(result.total_cost).toFixed(2)} руб.</div>
                </div>
            </div>
        </div>
        
        <div class="row mt-3">
            <div class="col-md-6">
                <div class="stats-card">
                    <h6>Использовано материала</h6>
                    <div class="display-value">${(result.material_used).toFixed(1)}%</div>
                </div>
            </div>
            <div class="col-md-6">
                <div class="stats-card">
                    <h6>Отходы</h6>
                    <div class="display-value">${(result.waste).toFixed(1)}%</div>
                </div>
            </div>
        </div>
        
        <div class="card mt-4">
            <div class="card-header bg-warning">
                <h5 class="mb-0">Схемы раскроя</h5>
            </div>
            <div class="card-body">
    `;
    
    result.patterns.forEach((pattern, index) => {
        html += `
            <div class="pattern-item">
                <h6>Схема ${index + 1}</h6>
                <p class="mb-2">Деталей: ${pattern.details.length}</p>
        `;
        
        pattern.details.forEach(detail => {
            html += `<span class="badge bg-primary me-2">${detail.length}×${detail.width}</span>`;
        });
        
        html += `
                <canvas id="canvas${index}" width="400" height="300" style="border: 1px solid #ddd; margin-top: 1rem; display: block;"></canvas>
            </div>
        `;
    });
    
    html += `
            </div>
        </div>
    `;
    
    container.innerHTML = html;
    
    // Отрисовать схемы раскроя на canvas
    result.patterns.forEach((pattern, index) => {
        drawPattern(index, pattern, result.sheet_length, result.sheet_width, result.margin);
    });
}

// Отрисовать схему на canvas
function drawPattern(index, pattern, sheetLength, sheetWidth, margin) {
    const canvas = document.getElementById(`canvas${index}`);
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const scale = Math.min(400 / sheetLength, 300 / sheetWidth) * 0.8;
    
    // Отрисовать фон листа
    ctx.fillStyle = '#e8f4f8';
    ctx.fillRect(10, 10, sheetLength * scale, sheetWidth * scale);
    
    // Отрисовать границу листа
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.strokeRect(10, 10, sheetLength * scale, sheetWidth * scale);
    
    // Отрисовать детали
    const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#f9ca24', '#6c5ce7', '#a29bfe'];
    
    pattern.details.forEach((detail, i) => {
        const x = 10 + detail.x * scale;
        const y = 10 + detail.y * scale;
        const w = detail.length * scale;
        const h = detail.width * scale;
        
        // Отрисовать деталь
        ctx.fillStyle = colors[i % colors.length];
        ctx.fillRect(x, y, w, h);
        
        // Граница детали
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, w, h);
        
        // Текст размеров
        ctx.fillStyle = '#000';
        ctx.font = 'bold 10px Arial';
        ctx.fillText(`${detail.length}×${detail.width}`, x + 5, y + 15);
    });
}

// Загрузить примеры данных
function loadExampleData() {
    // Пример 1: 3 детали 600x300
    details.push({
        id: 1,
        length: 600,
        width: 300,
        quantity: 5
    });
    
    // Пример 2: 2 детали 400x400
    details.push({
        id: 2,
        length: 400,
        width: 400,
        quantity: 3
    });
    
    updateDetailsTable();
}